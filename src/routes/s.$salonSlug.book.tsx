import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Sparkles, PhoneCall, Repeat, X, Zap } from "lucide-react";
import { employeesForType, servicesForType, depositFor, requiresDeposit } from "@/lib/mock/salon";
import type { Appointment, Client, Employee, EmployeeId, Service } from "@/lib/mock/types";
import { useSalonStore, isSlotTaken } from "@/lib/store";
import { useBusinessType, useDisplayProfile } from "@/lib/use-display-profile";
import {
  categoryOrderOf,
  professionalWord,
  showsRealPhotos,
  type BusinessType,
} from "@/lib/business-type";
import { findClientWithPenalty, findClientByPhone } from "@/lib/no-show";
import {
  toDateKey,
  hourOccupancyPct,
  offeredCloseMin,
  lastOfferedHours,
  isBusyHour,
  pickAlternativeSlots,
  isPriorityTime,
  findNextAvailableSlot,
  type SpreadSlot,
} from "@/lib/reparto";
import { StylistAvatar } from "@/components/StylistAvatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { es } from "date-fns/locale";
import heroImg from "@/assets/hero-salon.jpg";
import { registerBookingClient } from "@/lib/api/clients.functions";
import { checkClientPenalty } from "@/lib/api/salons.functions";
import { sumServices } from "@/lib/appointment-services";
import { FluidSteps } from "@/components/twentyfirst/fluid-steps";
import { eur } from "@/lib/copy";
import { DEMO_PARAM, decodeDemoProfile, esUnicoProfesional } from "@/lib/demo-profile";

/** "45 min" / "1 h" / "1 h 30" — sin ceros ni "0 h" cuando sobra. */
function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

/**
 * Rango orientativo de duración cuando el salón decide la duración final
 * (caso PeluChic: peluquería de novias/eventos). Regla: de la duración de
 * catálogo hasta +50%, redondeada al cuarto de hora más cercano — un
 * servicio de catálogo de 90 min se enseña como "1 h 30 – 2 h 15".
 */
function flexDurationRange(catalogMin: number): { lo: number; hi: number } {
  const hi = Math.round((catalogMin * 1.5) / 15) * 15;
  return { lo: catalogMin, hi: Math.max(hi, catalogMin) };
}

/** "1 minuto"/"45 minutos"/"1 hora" — para el aviso de recargo por retraso. */
function formatRetrasoMinutos(min: number): string {
  if (min === 60) return "1 hora";
  if (min % 60 === 0) return `${min / 60} horas`;
  return `${min} minutos`;
}

/** Texto del aviso de recargo por retraso (caso Adam: 45 % si llega +60 min tarde). */
function recargoRetrasoTexto(recargo: { pct: number; minutos: number }): string {
  return `Si llegas con más de ${formatRetrasoMinutos(recargo.minutos)} de retraso se aplica un recargo del ${recargo.pct} % del precio del servicio.`;
}

export const Route = createFileRoute("/s/$salonSlug/book")({
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
  component: BookingWizard,
});

function resolveEmployee(
  stylistChoice: EmployeeId | "any" | undefined,
  date: string,
  time: string,
  durationMin: number,
  appointments: Appointment[],
  employees: Employee[],
): EmployeeId {
  if (stylistChoice && stylistChoice !== "any") return stylistChoice;
  const startISO = new Date(`${date}T${time}:00`).toISOString();
  const weekday = new Date(`${date}T00:00`).getDay();
  const candidate = employees.find((e) => {
    const sched = e.schedule[weekday];
    if (!sched) return false;
    return !isSlotTaken(appointments, e.id, startISO, durationMin);
  });
  return candidate?.id ?? employees[0].id;
}

/** `?service=corte` o `?service=corte,barba`: solo cuentan los ids que existen en este catálogo. */
function parseServiceIds(
  param: string | undefined,
  serviceMap: Record<string, Service>,
): string[] {
  return (param ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id && serviceMap[id]);
}

/* --------------------------------------------------------------------------
 * "Repetir mi última cita" (patrón Booksy, sin cuentas — mejora B1 de la
 * investigación externa). Se guarda lo MÍNIMO en localStorage, por salón,
 * para poder ofrecer un atajo de un toque la próxima vez que alguien reserve
 * desde este mismo navegador: qué servicios y con quién, nunca datos
 * personales (el nombre/teléfono ya viven, si acaso, en Supabase del lado del
 * salón — no aquí). Con forma de borrarlo: el aviso trae una "x".
 * ---------------------------------------------------------------------- */

interface LastBooking {
  serviceIds: string[];
  employeeId: string;
  savedAt: number;
}

function lastBookingKey(salonSlug: string): string {
  return `trimly-last-booking:${salonSlug}`;
}

function readLastBooking(salonSlug: string): LastBooking | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lastBookingKey(salonSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastBooking>;
    if (!Array.isArray(parsed.serviceIds) || parsed.serviceIds.length === 0) return null;
    if (typeof parsed.employeeId !== "string" || !parsed.employeeId) return null;
    return {
      serviceIds: parsed.serviceIds.filter((id): id is string => typeof id === "string"),
      employeeId: parsed.employeeId,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeLastBooking(salonSlug: string, booking: LastBooking) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lastBookingKey(salonSlug), JSON.stringify(booking));
  } catch {
    // localStorage bloqueado (modo privado, cuota llena): la próxima visita
    // simplemente no verá el atajo, no es un error que deba interrumpir la
    // reserva que se acaba de confirmar.
  }
}

function clearLastBooking(salonSlug: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lastBookingKey(salonSlug));
  } catch {
    // Ver comentario de writeLastBooking.
  }
}

/** "hoy a las 12:00" / "mañana a las 12:00" / "jueves 24 a las 12:00". */
function formatSlotLabel(dateKey: string, time: string): string {
  const date = new Date(`${dateKey}T00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((+date - +today) / 86_400_000);
  const dia =
    diffDays === 0
      ? "hoy"
      : diffDays === 1
        ? "mañana"
        : date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });
  return `${dia} a las ${time}`;
}

type WizardData = {
  /** En el orden en que se eligieron; el precio y la duración son la suma. */
  serviceIds: string[];
  employeeId?: EmployeeId | "any";
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  name?: string;
  phone?: string;
  email?: string;
  note?: string;
  acceptedPolicy?: boolean;
};

function BookingWizard() {
  const { salonSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  // v2: "Cualquier profesional" preseleccionado (cambio priorizado #2 del
  // informe) — en v1 el paso 2 sigue sin preselección, igual que siempre.
  // El parser de búsqueda de TanStack Router convierte "2" en el NÚMERO 2, no
  // en la cadena "2" — de ahí el `String(...)` antes de comparar.
  const isV2 = useRouterState({
    select: (s) => String((s.location.search as Record<string, unknown>)?.v) === "2",
  });

  // `recargoRetraso`/`duracionFlexible` son personalización de demo pura
  // (no viven en `SalonProfile`, ver demo-profile.ts), así que no salen de
  // `useDisplayProfile` — se leen directamente del mismo enlace `?d=`.
  const demoParamRaw = useRouterState({
    select: (s) => {
      const sp = s.location.search as Record<string, unknown> | undefined;
      return typeof sp?.[DEMO_PARAM] === "string" ? (sp[DEMO_PARAM] as string) : undefined;
    },
  });
  const demoPersonalizacion = useMemo(() => decodeDemoProfile(demoParamRaw), [demoParamRaw]);
  // Si esta URL no trae `?d=` (caso normal: se llegó pulsando "Reservar
  // cita" desde la portada, que no lo reenvía), cae a lo que el layout
  // `s.$salonSlug.tsx` ya guardó en el store al abrir la portada con el
  // enlace. Así la personalización sobrevive a la navegación interna sin
  // depender de que cada enlace del sitio arrastre el parámetro.
  const storedRecargoRetraso = useSalonStore((s) => s.salonProfile.recargoRetraso);
  const storedDuracionFlexible = useSalonStore((s) => s.salonProfile.duracionFlexible);
  const recargoRetraso = demoPersonalizacion?.recargoRetraso ?? storedRecargoRetraso;
  const duracionFlexibleDemo = demoPersonalizacion
    ? !!demoPersonalizacion.duracionFlexible
    : !!storedDuracionFlexible;

  // Catálogo y equipo, calculados a partir del tipo de negocio deducido del
  // enlace de esta demo — no del equipo/catálogo "activo" mutado en
  // mock/salon.ts, que solo se pone al día tras un efecto de cliente. Así el
  // primer render (incluido el del servidor) ya sale en el idioma correcto,
  // igual que ya hacía `useDisplayProfile` con el resto del perfil. Si el
  // enlace trae carta o equipo reales, sustituyen a los de ejemplo del tipo.
  const profile = useDisplayProfile();
  const tipo = useBusinessType();
  const services = useMemo(() => servicesForType(tipo, profile.menu), [tipo, profile.menu]);
  const serviceMap = useMemo(
    () => Object.fromEntries(services.map((s) => [s.id, s])) as Record<string, Service>,
    [services],
  );
  const employees = useMemo(() => employeesForType(tipo, profile.team), [tipo, profile.team]);
  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])) as Record<string, Employee>,
    [employees],
  );

  // Salón con un solo profesional (caso Adam): no tiene sentido preguntar a
  // quién quiere ver — se asigna directamente y el asistente pasa del
  // servicio a la fecha, sin el paso 2.
  const single = esUnicoProfesional(profile);
  const soloEmployeeId = single ? employees[0]?.id : undefined;

  const [data, setData] = useState<WizardData>(() => ({
    serviceIds: parseServiceIds(search.service, serviceMap),
    employeeId: soloEmployeeId ?? (isV2 ? "any" : undefined),
  }));
  const [step, setStep] = useState<1 | 2 | 3 | 4>(data.serviceIds.length ? (single ? 3 : 2) : 1);

  // Si el equipo pasa a tener un único profesional después del primer
  // render (por ejemplo, la carta/equipo llega tarde por el enlace `?d=`),
  // se asigna igualmente sin que haga falta pasar por el paso 2.
  useEffect(() => {
    if (single && soloEmployeeId && data.employeeId !== soloEmployeeId) {
      setData((d) => ({ ...d, employeeId: soloEmployeeId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single, soloEmployeeId]);
  const appointments = useSalonStore((s) => s.appointments);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const clients = useSalonStore((s) => s.clients);

  // Política de plantón (ver lib/no-show.ts): mientras el teléfono tecleado
  // coincida con un cliente que debe una penalización, se bloquea el envío —
  // se recalcula en cada tecla, no solo al perder el foco.
  const penalizedLocal = useMemo(
    () => findClientWithPenalty(clients, data.phone),
    [clients, data.phone],
  );

  // En un salón REAL la ficha del cliente vive en Supabase, no en el navegador
  // de quien reserva: la comprobación la hace el servidor y solo devuelve el
  // importe, nunca la lista de clientes del salón. Va con retardo porque se
  // dispara mientras se teclea el teléfono.
  const realSlug = useSalonStore((s) => s.realSalonSlug);
  const [penalizedRemote, setPenalizedRemote] = useState<Client | null>(null);
  useEffect(() => {
    if (!realSlug) {
      setPenalizedRemote(null);
      return;
    }
    const phone = data.phone ?? "";
    let cancelado = false;
    const t = setTimeout(() => {
      checkClientPenalty({ data: { slug: realSlug, phone } })
        .then((r) => {
          if (!cancelado) setPenalizedRemote(r.client);
        })
        .catch((err) => console.error("No se pudo comprobar la penalización:", err));
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [realSlug, data.phone]);

  const penalizedClient = realSlug ? penalizedRemote : penalizedLocal;

  const selectedServices = data.serviceIds.map((id) => serviceMap[id]).filter(Boolean);
  const serviceNames = selectedServices.map((s) => s.name);
  // Precio y duración de la cita son la suma: el hueco que se reserva y el
  // umbral del depósito miran el total, no el primer servicio.
  const { durationMin: totalMin, priceEur: total } = sumServices(selectedServices);
  const stylistChoice = data.employeeId;
  const employeeName =
    stylistChoice === "any"
      ? "Cualquiera disponible"
      : stylistChoice
        ? employeeMap[stylistChoice]?.name
        : undefined;
  const depositEur = depositFor(total, totalMin);

  // Mejora B1 (grounding externo, patrón Booksy): "Repetir mi última cita".
  // Se lee una sola vez al montar el wizard — si se aplica y el cliente sigue
  // adelante, no debe reaparecer a media reserva.
  const [lastBooking, setLastBooking] = useState<LastBooking | null>(null);
  useEffect(() => {
    setLastBooking(readLastBooking(salonSlug));
  }, [salonSlug]);

  const repeatServices = lastBooking?.serviceIds.map((id) => serviceMap[id]).filter(Boolean) ?? [];
  // Válido solo si TODOS los servicios y el profesional siguen existiendo en
  // el catálogo actual: una carta que cambió entre visitas no debe ofrecer
  // un "repetir" con un servicio que ya no se hace.
  const repeatValid =
    !!lastBooking &&
    repeatServices.length === lastBooking.serviceIds.length &&
    !!employeeMap[lastBooking.employeeId];
  const repeatDuration = repeatValid ? sumServices(repeatServices).durationMin : 0;
  const repeatNextSlot = useMemo(() => {
    if (!repeatValid || !lastBooking) return undefined;
    return findNextAvailableSlot(employees, appointments, repeatDuration, lastBooking.employeeId, {
      lastSlotBufferMin: profile.lastSlotBufferMin ?? 0,
    });
  }, [repeatValid, lastBooking, employees, appointments, repeatDuration, profile.lastSlotBufferMin]);
  const showRepeatBanner =
    step === 1 && data.serviceIds.length === 0 && repeatValid && !!repeatNextSlot && !!lastBooking;
  const repeatServiceNames = repeatServices.map((s) => s.name).join(" + ");
  const repeatEmployeeName = lastBooking ? employeeMap[lastBooking.employeeId]?.name : undefined;

  function applyRepeat() {
    if (!repeatValid || !repeatNextSlot || !lastBooking) return;
    setData((d) => ({
      ...d,
      serviceIds: lastBooking.serviceIds,
      employeeId: lastBooking.employeeId as EmployeeId,
      date: repeatNextSlot.dateKey,
      time: repeatNextSlot.time,
    }));
    setStep(4);
  }

  function dismissRepeat() {
    clearLastBooking(salonSlug);
    setLastBooking(null);
  }

  function toggleService(id: string) {
    setData((d) => ({
      ...d,
      serviceIds: d.serviceIds.includes(id)
        ? d.serviceIds.filter((x) => x !== id)
        : [...d.serviceIds, id],
      // Al cambiar los servicios cambia la duración y la hora elegida puede
      // dejar de caber: se vuelve a pedir.
      date: undefined,
      time: undefined,
    }));
  }

  // Con un único profesional el paso 2 (elegir a quién) no existe: del
  // servicio se pasa directo a la fecha, y de vuelta.
  function next() {
    setStep((s) => {
      if (single && s === 1) return 3;
      return Math.min(4, s + 1) as 1 | 2 | 3 | 4;
    });
  }
  function prev() {
    setStep((s) => {
      if (single && s === 3) return 1;
      return Math.max(1, s - 1) as 1 | 2 | 3 | 4;
    });
  }

  function confirm() {
    if (
      !selectedServices.length ||
      !data.date ||
      !data.time ||
      !data.name ||
      !data.phone ||
      !data.acceptedPolicy
    )
      return;
    const serviceIds = selectedServices.map((s) => s.id);
    const employeeId = resolveEmployee(
      stylistChoice,
      data.date,
      data.time,
      schedulingDurationMin,
      appointments,
      employees,
    );
    const startISO = new Date(`${data.date}T${data.time}:00`).toISOString();
    // Una clienta que repite y teclea su teléfono (con espacios, guiones o
    // prefijo distintos a la vez anterior) tiene que quedar enlazada a SU
    // ficha, no a una "walk-in" nueva: si no, el historial no la reconoce y
    // avisos como la duración recordada (derive.ts) nunca le llegan viniendo
    // de la reserva pública. Si no hay ficha con ese teléfono, se crea una
    // nueva walk-in, exactamente como hasta ahora.
    const clienteExistente = findClientByPhone(clients, data.phone);
    const clientId = clienteExistente?.id ?? `c-walkin-${Date.now()}`;
    // El nombre de la ficha ya existente manda: si esta vez lo escribió de
    // otra forma ("Mari" en vez de "María García"), no se pisa el que el
    // salón ya conocía.
    const clientName = clienteExistente?.name ?? data.name;
    // Mejora B1: se guarda AQUÍ (reserva ya validada, no en cada tecla) lo
    // mínimo para poder ofrecer "repetir" la próxima vez desde este mismo
    // navegador — nunca nombre ni teléfono, que ya viven donde corresponde.
    writeLastBooking(salonSlug, { serviceIds, employeeId, savedAt: Date.now() });
    addAppointment(
      {
        clientId,
        clientName,
        serviceIds,
        employeeId,
        start: startISO,
        // Con duración flexible se bloquea el extremo alto del rango, para
        // que la agenda no ofrezca a la siguiente clienta un hueco que en la
        // práctica no cabe.
        duration: schedulingDurationMin,
        priceEur: total,
        // Las reservas de la web pública entran como solicitud: las confirma,
        // cambia o rechaza el salón desde el panel. Las citas creadas a mano
        // desde el panel (NewAppointmentDialog) siguen naciendo confirmadas.
        status: "pending",
        note: data.note,
      },
      // En un salón real esto es lo que crea (o reconoce) la ficha del cliente
      // en Supabase y engancha la cita: la store lo sube sola. En una demo de
      // venta `realSalonSlug` es null y estos datos no salen del navegador.
      { name: clientName, phone: data.phone, email: data.email },
    );
    if (!realSlug) {
      // Demo de venta: se conserva tal cual estaba — la reserva queda
      // registrada en Supabase como lead, con el status "confirmed" de
      // siempre. En un salón real no se llama, porque `addAppointment` ya ha
      // subido la MISMA cita con su estado "pending" y se duplicaría.
      registerBookingClient({
        data: {
          salonSlug,
          name: data.name,
          phone: data.phone,
          email: data.email,
          serviceIds,
          employeeId,
          startISO,
          durationMin: totalMin,
          priceEur: total,
          note: data.note,
        },
      }).catch((err) =>
        console.error("Supabase sync failed (booking still confirmed locally):", err),
      );
    }
    toast.success("Solicitud enviada", {
      description: `${serviceNames.join(" + ")} · ${data.date} a las ${data.time}`,
    });
    navigate({
      to: "/s/$salonSlug/confirmation",
      params: { salonSlug },
      search: {
        service: serviceIds.join(","),
        employeeId,
        date: data.date,
        time: data.time,
        name: data.name,
        // Sin esto la confirmación pierde la personalización de esta demo
        // (recargo por retraso, duración flexible, equipo…): el tipo de
        // negocio y el perfil que pinta esa página vuelven a los de
        // ejemplo en cuanto se sale de esta ruta.
        ...(demoParamRaw ? { [DEMO_PARAM]: demoParamRaw } : {}),
      },
    });
  }

  const ctaDisabled =
    step === 1
      ? selectedServices.length === 0
      : step === 2
        ? !data.employeeId
        : step === 3
          ? !data.date || !data.time
          : !data.name || !data.phone || !data.acceptedPolicy || !!penalizedClient;

  // Con un único profesional el paso 2 no existe: 3 pasos, no 4.
  const totalSteps = single ? 3 : 4;
  const displayStep = single ? (step === 1 ? 1 : step === 3 ? 2 : 3) : step;

  const ctaLabel = step < 4 ? "Continuar" : `Confirmar reserva — ${eur(total)}`;

  function onCta() {
    if (step < 4) next();
    else confirm();
  }

  // Duración orientativa cuando el salón decide la duración final (caso
  // PeluChic, clave "df" del enlace de demo). El precio y el hueco que se
  // reserva siguen calculándose sobre `totalMin`/`total`: esto es solo lo
  // que se ENSEÑA, salvo en la búsqueda de huecos de más abajo, donde se usa
  // el extremo alto del rango para no ofrecer horas que luego no quepan.
  const flexible = duracionFlexibleDemo;
  const flexRange = flexible ? flexDurationRange(totalMin) : null;
  const durationLabel =
    flexRange && totalMin > 0
      ? `aprox. ${formatMinutes(flexRange.lo)} – ${formatMinutes(flexRange.hi)}`
      : `${totalMin} min`;
  const flexNota = flexible
    ? `La duración final la confirma ${profile.name || "el salón"} al aceptar tu solicitud.`
    : undefined;
  // Duración con la que se buscan y filtran huecos: con duración flexible se
  // reserva el extremo alto del rango para no ofrecer citas que luego no
  // quepan en la agenda.
  const schedulingDurationMin = flexRange ? flexRange.hi : totalMin;

  const recargoTexto = recargoRetraso ? recargoRetrasoTexto(recargoRetraso) : undefined;

  const dateLabel = data.date
    ? new Date(`${data.date}T00:00`).toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : undefined;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-28 pt-10 md:py-16 lg:pb-16">
      <StepIndicator step={displayStep} totalSteps={totalSteps} single={single} />

      {/* Mejora B1: atajo de un toque para quien ya reservó antes en este
          salón desde este mismo navegador (patrón Booksy, sin cuentas). */}
      {showRepeatBanner && repeatNextSlot && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <button type="button" onClick={applyRepeat} className="min-w-0 flex-1 text-left">
            <p className="text-sm font-medium">
              Repetir: {repeatServiceNames}
              {repeatEmployeeName ? ` con ${repeatEmployeeName}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Próximo hueco: {formatSlotLabel(repeatNextSlot.dateKey, repeatNextSlot.time)}
            </p>
          </button>
          <button
            type="button"
            onClick={dismissRepeat}
            aria-label="Descartar sugerencia de repetir cita"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {step === 1 && (
            <ServiceStep
              selected={data.serviceIds}
              totalMin={totalMin}
              durationLabel={durationLabel}
              flexNota={flexible ? flexNota : undefined}
              onToggle={toggleService}
              tipo={tipo}
              services={services}
            />
          )}

          {!single && step === 2 && (
            <StylistStep
              selected={data.employeeId}
              onSelect={(id) => setData((d) => ({ ...d, employeeId: id }))}
              tipo={tipo}
              employees={employees}
            />
          )}

          {step === 3 && selectedServices.length > 0 && (
            <DateTimeStep
              durationMin={schedulingDurationMin}
              stylistChoice={data.employeeId ?? "any"}
              appointments={appointments}
              selectedDate={data.date}
              selectedTime={data.time}
              onPick={(date, time) => setData((d) => ({ ...d, date, time }))}
              employees={employees}
              smartSpread={!!profile.smartSpread}
              lastSlotBufferMin={profile.lastSlotBufferMin ?? 0}
              priorityHours={profile.priorityHours ?? []}
              durationLabel={durationLabel}
              flexNota={flexNota}
              recargoTexto={recargoTexto}
            />
          )}

          {step === 4 && (
            <Step title="Tus datos">
              <div className="max-w-xl space-y-5">
                {/* Auditoría de UX, hallazgo C8: antes no se repetían fecha,
                    hora ni profesional justo antes de confirmar — en móvil
                    el resumen de la barra lateral ni siquiera se ve (está
                    "hidden lg:block"), así que se confirmaba "a ciegas". Este
                    resumen sale en TODOS los tamaños, completo y sin cortes. */}
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                    Resumen de tu reserva
                  </p>
                  <div className="space-y-2 text-sm">
                    {serviceNames.length > 1 ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Servicios</span>
                        <ul className="text-right font-medium">
                          {serviceNames.map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <SummaryRow label="Servicio" value={serviceNames[0] ?? "—"} />
                    )}
                    <SummaryRow
                      label={serviceNames.length > 1 ? "Duración total" : "Duración"}
                      value={durationLabel}
                    />
                    {/* Con un único profesional no se enseña como si se
                        hubiera elegido: se informa de quién atiende. */}
                    {!single && (
                      <SummaryRow label={cap(professionalWord(tipo))} value={employeeName ?? "—"} />
                    )}
                    <SummaryRow label="Fecha" value={dateLabel ?? "—"} />
                    <SummaryRow label="Hora" value={data.time ?? "—"} />
                  </div>
                  <div className="my-3 border-t border-dashed border-border" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-display text-xl">{eur(total)}</span>
                  </div>
                  {depositEur > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Incluye depósito de {eur(depositEur)} a pagar en el salón.
                    </p>
                  )}
                  {single && employeeName && (
                    <p className="mt-1 text-xs text-muted-foreground">Te atiende {employeeName}.</p>
                  )}
                  {flexible && flexNota && (
                    <p className="mt-3 text-sm font-medium text-foreground">{flexNota}</p>
                  )}
                  {recargoTexto && (
                    <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      {recargoTexto}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    value={data.name ?? ""}
                    onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Nombre y apellidos"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={data.phone ?? ""}
                    onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))}
                    placeholder="600 000 000"
                  />
                </div>

                {penalizedClient && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <p>
                      Tienes pendiente una penalización de {eur(profile.noShowFeeEur ?? 0)} por una
                      cita a la que no pudiste venir sin avisar. Abónala en {profile.name} y podrás
                      volver a reservar.
                    </p>
                    {profile.phone && (
                      <Button asChild size="sm" variant="outline" className="mt-3 gap-1.5">
                        <a href={`tel:${profile.phone.replace(/\s+/g, "")}`}>
                          <PhoneCall className="h-3.5 w-3.5" />
                          Llamar
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={data.email ?? ""}
                    onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))}
                    placeholder="tunombre@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">Nota para el salón (opcional)</Label>
                  <Textarea
                    id="note"
                    rows={3}
                    value={data.note ?? ""}
                    onChange={(e) => setData((d) => ({ ...d, note: e.target.value }))}
                    placeholder="Alguna preferencia o detalle que debamos saber"
                  />
                </div>

                {requiresDeposit(totalMin) && (
                  <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary">
                    Esta reserva requiere un depósito de {eur(depositEur)} que se cobrará en el
                    salón.
                  </div>
                )}

                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Checkbox
                    className="mt-0.5"
                    checked={data.acceptedPolicy ?? false}
                    onCheckedChange={(v) => setData((d) => ({ ...d, acceptedPolicy: v === true }))}
                  />
                  <span>
                    Acepto la política de cancelación: gratuita hasta{" "}
                    {(profile.noShowFeeEur ?? 0) > 0 ? `${profile.noShowNoticeHours ?? 2} h` : "24 h"}{" "}
                    antes de la cita.
                  </span>
                </label>

                {(profile.noShowFeeEur ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Si no puedes venir, avísanos con {profile.noShowNoticeHours ?? 2} h de
                    antelación; si no, la siguiente reserva lleva {eur(profile.noShowFeeEur ?? 0)} de
                    penalización.
                  </p>
                )}
                {profile.depositEnabled && (profile.depositAmountEur ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Para confirmar la cita, {profile.name} te pedirá por WhatsApp una señal de{" "}
                    {eur(profile.depositAmountEur ?? 0)} por Bizum, que se descuenta del precio del
                    servicio.
                  </p>
                )}
              </div>
            </Step>
          )}

          <div className="mt-10 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={prev}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Atrás
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>

        <BookingSummary
          variant="sidebar"
          serviceNames={serviceNames}
          durationLabel={durationLabel}
          employeeName={employeeName}
          showEmployeeRow={!single}
          dateLabel={dateLabel}
          timeLabel={data.time}
          total={total}
          depositEur={depositEur}
          ctaLabel={ctaLabel}
          ctaDisabled={ctaDisabled}
          onCta={onCta}
        />
      </div>

      <BookingSummary
        variant="bar"
        serviceNames={serviceNames}
        durationLabel={durationLabel}
        employeeName={employeeName}
        showEmployeeRow={!single}
        dateLabel={dateLabel}
        timeLabel={data.time}
        total={total}
        depositEur={depositEur}
        ctaLabel={ctaLabel}
        ctaDisabled={ctaDisabled}
        onCta={onCta}
      />
    </section>
  );
}

function cap(w: string) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function StepIndicator({
  step,
  totalSteps,
  single,
}: {
  step: 1 | 2 | 3 | 4;
  totalSteps: number;
  single: boolean;
}) {
  // «Barbero» en barberías, «Profesional» en unisex: el rótulo del paso no
  // puede contradecir al título «Elige tu barbero» de la propia pantalla.
  // Con un único profesional el paso de elegir a quién no existe.
  const tipo = useBusinessType();
  const labels = single
    ? ["Servicio", "Fecha y hora", "Tus datos"]
    : ["Servicio", cap(professionalWord(tipo)), "Fecha y hora", "Tus datos"];
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <FluidSteps step={step} total={totalSteps} />
        <span className="text-xs text-muted-foreground">
          Paso {step} de {totalSteps}
        </span>
      </div>
      <span className="text-sm font-medium text-foreground">{labels[step - 1]}</span>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-8 font-display text-3xl md:text-4xl">{title}</h1>
      {children}
    </div>
  );
}

function ServiceStep({
  selected,
  totalMin,
  durationLabel,
  flexNota,
  onToggle,
  tipo,
  services,
}: {
  selected: string[];
  totalMin: number;
  /** "45 min" o, con duración flexible, "aprox. 1 h 30 – 2 h 15". */
  durationLabel: string;
  /** Frase «la duración final la confirma…», solo con duración flexible. */
  flexNota?: string;
  onToggle: (id: string) => void;
  tipo: BusinessType;
  services: Service[];
}) {
  const count = selected.length;
  const categoryOrder = categoryOrderOf(services);
  return (
    <Step title="Elige uno o varios servicios">
      <p
        className={cn("-mt-4 text-sm text-muted-foreground", count > 0 && flexNota ? "mb-2" : "mb-6")}
        aria-live="polite"
      >
        {count === 0
          ? "Puedes combinar varios en la misma cita."
          : `${count} ${count === 1 ? "servicio elegido" : "servicios elegidos"} · ${durationLabel} en total`}
      </p>
      {count > 0 && flexNota && (
        <p className="mb-6 text-sm font-medium text-foreground">{flexNota}</p>
      )}
      {/* `key`: cuando la carta llega del enlace después del primer render, las
          categorías cambian («Cortes» → «Servicios») y un defaultValue ya
          montado dejaría el acordeón cerrado sin ningún servicio a la vista. */}
      <Accordion
        key={categoryOrder.join("|")}
        type="single"
        collapsible
        defaultValue={categoryOrder[0]}
        className="divide-y divide-border/40"
      >
        {categoryOrder.map((cat) => {
          const items = services.filter((s) => s.active !== false && (s.category ?? "Otros") === cat);
          if (!items.length) return null;
          return (
            <AccordionItem key={cat} value={cat} className="border-b-0">
              <AccordionTrigger className="py-4 text-base font-display font-medium hover:no-underline">
                {cat}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {items.map((s) => {
                    const label = { name: s.name, description: s.description };
                    const isSelected = selected.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onToggle(s.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border/60 hover:border-primary/40 hover:bg-muted/30",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{label.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {s.durationMin} min
                            {requiresDeposit(s.durationMin) ? " · requiere depósito" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-display text-lg">{eur(s.priceEur)}</span>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Step>
  );
}

function StylistStep({
  selected,
  onSelect,
  tipo,
  employees,
}: {
  selected?: EmployeeId | "any";
  onSelect: (id: EmployeeId | "any") => void;
  tipo: BusinessType;
  employees: Employee[];
}) {
  return (
    <Step title={`Elige tu ${professionalWord(tipo)}`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => onSelect("any")}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-card px-4 py-6 text-center transition-colors",
            selected === "any"
              ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 ring-offset-background"
              : "border-border/60 hover:border-primary/40",
          )}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Cualquiera disponible</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Más rápido</p>
          </div>
        </button>
        {employees.map((e) => (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={cn(
              "flex flex-col items-center gap-3 rounded-2xl border bg-card px-4 py-6 text-center transition-colors",
              selected === e.id
                ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "border-border/60 hover:border-primary/40",
            )}
          >
            <StylistAvatar
              name={e.name}
              employeeId={e.id}
              photo={showsRealPhotos(tipo) ? e.photo : undefined}
              size="lg"
            />
            <div>
              <p className="text-sm font-medium">{e.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{e.specialty}</p>
            </div>
          </button>
        ))}
      </div>
    </Step>
  );
}

/** `SpreadSlot` + si cae dentro de una franja prioritaria del dueño — ver reparto.ts. */
type PrioritySlot = SpreadSlot & { priority: boolean };

/** Botón de una hora del paso 3. Se reutiliza en el bloque de franjas prioritarias y en las agrupadas. */
function TimeSlotButton({
  slot,
  selected,
  onClick,
}: {
  slot: PrioritySlot;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={!slot.available}
      onClick={onClick}
      title={slot.busy ? "Suele haber espera" : undefined}
      className={cn(
        "relative rounded-full border px-4 py-2 text-sm transition-colors",
        !slot.available &&
          "cursor-not-allowed border-border/40 text-muted-foreground/50 line-through",
        slot.available && selected && "border-primary bg-primary text-primary-foreground",
        slot.available &&
          !selected &&
          "border-border hover:border-primary/50 hover:bg-primary/5",
        slot.available && slot.busy && !selected && "border-amber-500/50",
      )}
    >
      {slot.time}
      {slot.busy && slot.available && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -right-0.5 -top-0.5 size-2 rounded-full",
            selected ? "bg-primary-foreground" : "bg-amber-500",
          )}
        />
      )}
    </button>
  );
}

function DateTimeStep({
  durationMin,
  stylistChoice,
  appointments,
  selectedDate,
  selectedTime,
  onPick,
  employees,
  smartSpread,
  lastSlotBufferMin,
  priorityHours,
  durationLabel,
  flexNota,
  recargoTexto,
}: {
  /** Duración con la que se busca hueco libre — con duración flexible ya es el extremo alto del rango. */
  durationMin: number;
  stylistChoice: EmployeeId | "any";
  appointments: Appointment[];
  selectedDate?: string;
  selectedTime?: string;
  onPick: (date: string, time: string) => void;
  employees: Employee[];
  /** Reparto de agenda (clave "k"): etiqueta huecos "con espera" y sugiere una hora más tranquila. */
  smartSpread: boolean;
  /** Minutos antes del cierre que dejan de ofertarse (clave "u"). 0 = como siempre. */
  lastSlotBufferMin: number;
  /** Franjas prioritarias del dueño (clave "y"). Vacío = como siempre, sin nada destacado. */
  priorityHours: string[];
  /** "45 min" o, con duración flexible, "aprox. 1 h 30 – 2 h 15". */
  durationLabel: string;
  /** Frase «la duración final la confirma…», solo con duración flexible (clave "df"). */
  flexNota?: string;
  /** Aviso de recargo por retraso (clave "rr"), o undefined si esta demo no lo tiene. */
  recargoTexto?: string;
}) {
  const relevantEmployees = useMemo(
    () => (stylistChoice === "any" ? employees : employees.filter((e) => e.id === stylistChoice)),
    [stylistChoice, employees],
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  function scheduleForWeekday(weekday: number) {
    return relevantEmployees.map((e) => e.schedule[weekday]).filter(Boolean) as {
      start: number;
      end: number;
    }[];
  }

  /**
   * Cierre "de verdad" del día: el del SALÓN, no el del profesional elegido —
   * Cardedal cierra a las 20:30 lleve quien lleve la caja, y el colchón de
   * cierre (`u`) se mide contra eso. Con "any" coincide con `scheduleForWeekday`.
   */
  function salonRangeForWeekday(weekday: number) {
    const opens = employees.map((e) => e.schedule[weekday]).filter(Boolean) as {
      start: number;
      end: number;
    }[];
    if (opens.length === 0) return null;
    return {
      openMin: Math.min(...opens.map((o) => o.start)) * 60,
      closeMin: Math.max(...opens.map((o) => o.end)) * 60,
    };
  }

  function isDayDisabled(date: Date) {
    if (date < today) return true;
    const weekday = date.getDay();
    const opens = scheduleForWeekday(weekday);
    if (opens.length === 0) return true;
    const dateKey = toDateKey(date);
    const start = Math.min(...opens.map((o) => o.start));
    const end = Math.max(...opens.map((o) => o.end));
    const salonRange = salonRangeForWeekday(weekday);
    const closeMinOffered = salonRange
      ? offeredCloseMin(salonRange.closeMin, lastSlotBufferMin)
      : end * 60;
    for (let h = start; h < end; h++) {
      for (const m of [0, 30]) {
        if (h * 60 + m >= closeMinOffered) continue;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const open = relevantEmployees.some((e) => {
          const sched = e.schedule[weekday];
          return sched && h >= sched.start && h + durationMin / 60 <= sched.end;
        });
        if (!open) continue;
        const iso = new Date(`${dateKey}T${timeStr}:00`).toISOString();
        const free = relevantEmployees.some(
          (e) => !isSlotTaken(appointments, e.id, iso, durationMin),
        );
        if (free) return false;
      }
    }
    return true;
  }

  const [activeDate, setActiveDateRaw] = useState<Date | undefined>(
    selectedDate ? new Date(`${selectedDate}T00:00`) : undefined,
  );
  // La tarjeta de sugerencia es del día que se está mirando: cambiar de día
  // sin cerrarla dejaría una sugerencia de ayer sobre una franja de hoy.
  const [pendingBusyTime, setPendingBusyTime] = useState<string | null>(null);
  function setActiveDate(d: Date) {
    setPendingBusyTime(null);
    setActiveDateRaw(d);
  }

  useEffect(() => {
    if (activeDate) return;
    const d = new Date(today);
    for (let i = 0; i < 60; i++) {
      if (!isDayDisabled(d)) {
        setActiveDateRaw(new Date(d));
        break;
      }
      d.setDate(d.getDate() + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slots = useMemo((): PrioritySlot[] => {
    if (!activeDate) return [];
    const dateKey = toDateKey(activeDate);
    const weekday = activeDate.getDay();
    const opens = scheduleForWeekday(weekday);
    if (opens.length === 0) return [];
    const start = Math.min(...opens.map((o) => o.start));
    const end = Math.max(...opens.map((o) => o.end));

    const salonRange = salonRangeForWeekday(weekday);
    const closeMinOffered = salonRange
      ? offeredCloseMin(salonRange.closeMin, lastSlotBufferMin)
      : end * 60;
    const lastHours = salonRange
      ? lastOfferedHours(salonRange.openMin, closeMinOffered)
      : [];

    const out: PrioritySlot[] = [];
    for (let h = start; h < end; h++) {
      const hourOccupancy = smartSpread
        ? hourOccupancyPct(appointments, dateKey, h, employees)
        : 0;
      const busy = smartSpread && isBusyHour(h, hourOccupancy, lastHours);
      for (const m of [0, 30]) {
        // "No ofrecer los últimos X minutos": el hueco ni se lista.
        if (h * 60 + m >= closeMinOffered) continue;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const open = relevantEmployees.some((e) => {
          const sched = e.schedule[weekday];
          return sched && h >= sched.start && h + durationMin / 60 <= sched.end;
        });
        if (!open) continue;
        const iso = new Date(`${dateKey}T${timeStr}:00`).toISOString();
        const available = relevantEmployees.some(
          (e) => !isSlotTaken(appointments, e.id, iso, durationMin),
        );
        out.push({ time: timeStr, available, busy, priority: isPriorityTime(timeStr, priorityHours) });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate, relevantEmployees, employees, appointments, durationMin, smartSpread, lastSlotBufferMin, priorityHours]);

  const groups = useMemo(() => {
    const morning = slots.filter((s) => Number(s.time.split(":")[0]) < 14);
    const afternoon = slots.filter((s) => {
      const h = Number(s.time.split(":")[0]);
      return h >= 14 && h < 19;
    });
    const evening = slots.filter((s) => Number(s.time.split(":")[0]) >= 19);
    return [
      { label: "Mañana", items: morning },
      { label: "Tarde", items: afternoon },
      { label: "Noche", items: evening },
    ].filter((g) => g.items.length > 0);
  }, [slots]);

  const activeDateKey = activeDate ? toDateKey(activeDate) : undefined;

  const alternatives = useMemo(
    () => (pendingBusyTime ? pickAlternativeSlots(slots, pendingBusyTime, 3) : []),
    [slots, pendingBusyTime],
  );

  // Mejora B3: primer hueco libre del día que ya se está mirando — como
  // `activeDate` se auto-selecciona en el primer día con hueco (efecto de
  // arriba), el primer slot disponible de este día ES el primer hueco libre
  // en todo el horizonte, sin tener que volver a recorrer 60 días aquí.
  const firstAvailable = useMemo(() => slots.find((s) => s.available), [slots]);

  // Mejora B2: franjas prioritarias del dueño — se muestran primero, con el
  // resto detrás de "Ver todas las horas" (nunca oculto del todo). Si el
  // dueño no ha marcado ninguna, o ninguna cae libre este día en concreto,
  // se enseña todo directamente, exactamente como antes de este cambio.
  const priorityAvailable = useMemo(
    () => slots.filter((s) => s.priority && s.available),
    [slots],
  );
  const hasPriorityBlock = priorityHours.length > 0 && priorityAvailable.length > 0;
  const [showAllHours, setShowAllHours] = useState(!hasPriorityBlock);
  useEffect(() => {
    setShowAllHours(!hasPriorityBlock);
  }, [hasPriorityBlock, activeDateKey]);

  function handleSlotClick(s: SpreadSlot) {
    if (!s.available || !activeDateKey) return;
    // Un hueco "con espera": se sugiere antes de reservarlo, nunca se impide.
    if (smartSpread && s.busy && pendingBusyTime !== s.time) {
      setPendingBusyTime(s.time);
      return;
    }
    onPick(activeDateKey, s.time);
    setPendingBusyTime(null);
  }

  function confirmPending(time: string) {
    if (!activeDateKey) return;
    onPick(activeDateKey, time);
    setPendingBusyTime(null);
  }

  return (
    <Step title="Fecha y hora">
      <div className="-mt-4 mb-6 space-y-1.5">
        <p className="text-sm text-muted-foreground">Duración: {durationLabel}</p>
        {flexNota && <p className="text-sm font-medium text-foreground">{flexNota}</p>}
        {recargoTexto && <p className="text-[11px] leading-snug text-muted-foreground">{recargoTexto}</p>}
      </div>
      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        <div className="self-start rounded-2xl border border-border/60 bg-card p-1">
          <Calendar
            mode="single"
            locale={es}
            selected={activeDate}
            onSelect={(d) => d && setActiveDate(d)}
            disabled={isDayDisabled}
          />
        </div>
        <div>
          {activeDate ? (
            <>
              <p className="mb-4 font-display text-lg capitalize">
                {activeDate.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay horas disponibles este día. Prueba con otra fecha.
                </p>
              )}

              {/* Mejora B3 (grounding externo): el primer hueco libre del día
                  que se está mirando, destacado y a un toque — sin tener que
                  leer toda la lista para encontrar "lo antes posible". */}
              {firstAvailable && !pendingBusyTime && (
                <button
                  type="button"
                  onClick={() => handleSlotClick(firstAvailable)}
                  className="mb-5 flex w-full items-center gap-2.5 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-left text-sm hover:bg-primary/10"
                >
                  <Zap className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="font-medium">Lo antes posible: </span>
                    {activeDateKey && formatSlotLabel(activeDateKey, firstAvailable.time)}
                  </span>
                </button>
              )}

              {pendingBusyTime && (
                <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-medium">
                    A esa hora suele haber espera. Te atendemos antes y sin esperar:
                  </p>
                  {alternatives.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {alternatives.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => confirmPending(t)}
                          className="rounded-full border border-primary/40 bg-card px-4 py-1.5 text-sm hover:bg-primary/10"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => confirmPending(pendingBusyTime)}
                    className="mt-2.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Prefiero las {pendingBusyTime}
                  </button>
                </div>
              )}

              {/* Mejora B2 (necesidad de Cardedal): franjas prioritarias del
                  dueño primero, con el resto detrás de "Ver todas las horas"
                  — nunca oculto del todo, para no perder la reserva. Sin
                  franjas configuradas (el caso de las ~54 demos), esto no
                  pinta nada y se va directo a la lista agrupada de siempre. */}
              {hasPriorityBlock && (
                <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="mb-2.5 text-sm font-medium">Te atendemos antes y sin esperar</p>
                  <div className="flex flex-wrap gap-2">
                    {priorityAvailable.map((s) => (
                      <TimeSlotButton
                        key={s.time}
                        slot={s}
                        selected={selectedDate === activeDateKey && selectedTime === s.time}
                        onClick={() => handleSlotClick(s)}
                      />
                    ))}
                  </div>
                  {!showAllHours && (
                    <button
                      type="button"
                      onClick={() => setShowAllHours(true)}
                      className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Ver todas las horas
                    </button>
                  )}
                </div>
              )}

              {showAllHours && (
                <div className="space-y-5">
                  {groups.map((g) => (
                    <div key={g.label}>
                      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                        {g.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {g.items.map((s) => (
                          <TimeSlotButton
                            key={s.time}
                            slot={s}
                            selected={selectedDate === activeDateKey && selectedTime === s.time}
                            onClick={() => handleSlotClick(s)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {smartSpread && slots.some((s) => s.busy && s.available) && (
                <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
                  Suele haber espera a esa hora
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Elige un día en el calendario para ver las horas disponibles.
            </p>
          )}
        </div>
      </div>
    </Step>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

function BookingSummary({
  variant,
  serviceNames,
  durationLabel,
  employeeName,
  showEmployeeRow = true,
  dateLabel,
  timeLabel,
  total,
  depositEur,
  ctaLabel,
  ctaDisabled,
  onCta,
}: {
  variant: "sidebar" | "bar";
  serviceNames: string[];
  /** "45 min" o, con duración flexible, "aprox. 1 h 30 – 2 h 15". */
  durationLabel: string;
  employeeName?: string;
  /** false con un único profesional: no se enseña como si se hubiera elegido. */
  showEmployeeRow?: boolean;
  dateLabel?: string;
  timeLabel?: string;
  total: number;
  depositEur: number;
  ctaLabel: string;
  ctaDisabled: boolean;
  onCta: () => void;
}) {
  const tipo = useBusinessType();
  const profile = useDisplayProfile();
  const salonName = profile.name;
  if (variant === "bar") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {serviceNames.length ? serviceNames.join(" + ") : "Elige un servicio"}
            </p>
            {/* `truncate` (auditoría de UX, hallazgo C8): con la etiqueta larga
                del paso 4 ("Confirmar reserva — 23,00 €") no quedaba sitio y
                "45 min" partía "45" y "min" en dos líneas. Con una sola línea
                que recorta con "…" si hace falta, nunca más partido a medias. */}
            <p className="truncate font-display text-lg">
              {eur(total)}
              {serviceNames.length > 0 && (
                <span className="ml-2 whitespace-nowrap text-xs font-normal text-muted-foreground">
                  {durationLabel}
                </span>
              )}
            </p>
          </div>
          {/* 44px de alto (auditoría de UX, hallazgo C9): el tamaño por
              defecto del botón son 36px, por debajo del mínimo táctil. */}
          <Button
            onClick={onCta}
            disabled={ctaDisabled}
            className="h-11 shrink-0 rounded-full px-6"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 rounded-2xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
            <img src={profile.heroImage || heroImg} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base">{salonName}</p>
            <p className="text-xs text-muted-foreground">Resumen de tu reserva</p>
          </div>
        </div>

        <div className="space-y-2.5 text-sm">
          {serviceNames.length > 1 ? (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Servicios</span>
              <ul className="text-right font-medium">
                {serviceNames.map((name) => (
                  <li key={name} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <SummaryRow label="Servicio" value={serviceNames[0] ?? "—"} />
          )}
          {serviceNames.length > 0 && (
            <SummaryRow
              label={serviceNames.length > 1 ? "Duración total" : "Duración"}
              value={durationLabel}
            />
          )}
          {showEmployeeRow && (
            <SummaryRow label={cap(professionalWord(tipo))} value={employeeName ?? "—"} />
          )}
          <SummaryRow label="Fecha" value={dateLabel ?? "—"} />
          <SummaryRow label="Hora" value={timeLabel ?? "—"} />
        </div>

        <Separator className="my-4" />

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-2xl">{eur(total)}</span>
        </div>
        {depositEur > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Incluye depósito de {eur(depositEur)} a pagar en el salón.
          </p>
        )}

        <Button
          onClick={onCta}
          disabled={ctaDisabled}
          className="mt-6 w-full rounded-full py-6 text-sm"
        >
          {ctaLabel}
        </Button>
      </div>
    </aside>
  );
}
