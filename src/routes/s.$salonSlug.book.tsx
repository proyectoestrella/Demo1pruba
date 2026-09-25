import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Sparkles, PhoneCall, Repeat, X, Zap } from "lucide-react";
import { employeesForType, servicesForType } from "@/lib/mock/salon";
import { importeSenal, reglaSenal, senalDeReservaNueva, servicioLlevaSenal, textoSenalPublico, type ReglaSenal } from "@/lib/senal";
import { huecosDeProfesionales, trabajaEn } from "@/lib/horario-equipo";
import { isoDelSalon, zonaDelSalon } from "@/lib/zona-horaria";
import type { Appointment, BookingAnswers, Client, Employee, EmployeeId, Service } from "@/lib/mock/types";
import { serializeBookingNote } from "@/lib/booking-answers";
import { limpiarRespuestas, obligatoriasSinResponder, preguntasAplicables, preguntasDelSalon } from "@/lib/preguntas-reserva";
import type { PreguntaReserva } from "@/lib/mock/types";
import { useSalonStore, isSlotTaken } from "@/lib/store";
import { duracionFlexibleActiva } from "@/lib/duracion-flexible";
import { recargoActivo } from "@/lib/recargo-activo";
import { useBusinessType, useDisplayProfile } from "@/lib/use-display-profile";
import {
  categoryOrderOf,
  professionalWord,
  showsRealPhotos,
  type BusinessType,
} from "@/lib/business-type";
import { findClientByPhone, isBookingBlocked } from "@/lib/no-show";
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
import { guardarReservaPublica } from "@/lib/salon-sync";
import { firmaReservaPublica, mensajeErrorReserva } from "@/lib/reserva-publica";
import { reintentarSalonPublico } from "@/lib/use-real-salon";
import { sumServices } from "@/lib/appointment-services";
import { FluidSteps } from "@/components/twentyfirst/fluid-steps";
import { capitalizar, eur, fechaLarga } from "@/lib/copy";
import { DEMO_PARAM, decodeDemoProfile } from "@/lib/demo-profile";
import {
  esSoloUnProfesional,
  pasoAnterior,
  pasoInicial,
  pasoVisible,
  rotulosDePaso,
  siguientePaso,
  totalPasos,
  type PasoReserva,
} from "@/lib/solo-profesional";

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
  timeZone: string,
): EmployeeId {
  if (stylistChoice && stylistChoice !== "any") return stylistChoice;
  const weekday = new Date(`${date}T00:00`).getDay();
  const [hh, mm] = time.split(":").map(Number);
  const startMin = hh * 60 + mm;
  const candidate = employees.find((e) => {
    if (!trabajaEn(e, weekday, startMin, durationMin)) return false;
    const startISO = isoDelSalon(date, time, timeZone);
    return !isSlotTaken(appointments, e.id, startISO, durationMin);
  });
  return candidate?.id ?? employees[0].id;
}

/** `?service=corte` o `?service=corte,barba`: solo cuentan los ids que existen en este catálogo. */
function parseServiceIds(param: string | undefined, serviceMap: Record<string, Service>): string[] {
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
  bookingAnswers?: BookingAnswers;
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
  const realSalonSlug = useSalonStore((s) => s.realSalonSlug);
  const duracionFlexibleDemo = duracionFlexibleActiva(
    { duracionFlexible: storedDuracionFlexible }, demoPersonalizacion, realSalonSlug === salonSlug,
  );

  // Catálogo y equipo, calculados a partir del tipo de negocio deducido del
  // enlace de esta demo — no del equipo/catálogo "activo" mutado en
  // mock/salon.ts, que solo se pone al día tras un efecto de cliente. Así el
  // primer render (incluido el del servidor) ya sale en el idioma correcto,
  // igual que ya hacía `useDisplayProfile` con el resto del perfil. Si el
  // enlace trae carta o equipo reales, sustituyen a los de ejemplo del tipo.
  const profile = useDisplayProfile();
  const conRecargo = recargoActivo(profile);
  const tipo = useBusinessType();
  // Preguntas del formulario: las del salón (o las de siempre), en su orden.
  // Las aplicables dependen de los servicios elegidos: se calculan más abajo.
  const preguntasSalon = useMemo(() => preguntasDelSalon(profile, tipo), [profile, tipo]);
  const services = useMemo(() => servicesForType(tipo, profile.menu), [tipo, profile.menu]);
  const serviceMap = useMemo(
    () => Object.fromEntries(services.map((s) => [s.id, s])) as Record<string, Service>,
    [services],
  );
  const employees = useMemo(() => employeesForType(tipo, profile.team, profile.teamHours, profile.openingHours, profile.teamIds), [tipo, profile.team, profile.teamHours, profile.openingHours, profile.teamIds]);
  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])) as Record<string, Employee>,
    [employees],
  );

  /**
   * Un solo profesional: no hay nada que elegir en el paso 2, así que se
   * salta y la reserva pasa a tener tres pasos. La cita se asigna igual —a la
   * única persona que hay— a través de `employeeId`, que se deja fijado desde
   * el principio. Con dos o más, todo sigue exactamente como antes.
   */
  const soloUno = esSoloUnProfesional(employees);

  const [data, setData] = useState<WizardData>(() => ({
    serviceIds: parseServiceIds(search.service, serviceMap),
    employeeId: soloUno ? employees[0]?.id : isV2 ? "any" : undefined,
  }));
  const preguntas = useMemo(() => preguntasAplicables(preguntasSalon, data.serviceIds), [preguntasSalon, data.serviceIds]);
  const showBookingQuestions = preguntas.length > 0;
  const requireBookingQuestions = preguntas.some((p) => p.obligatoria);
  const faltanRespuestas = obligatoriasSinResponder(preguntas, data.bookingAnswers);
  const [step, setStep] = useState<PasoReserva>(() =>
    pasoInicial(data.serviceIds.length > 0, soloUno),
  );

  // El equipo puede llegar después del primer render (un salón real se
  // resuelve contra Supabase tras montar): si resulta que solo hay una
  // persona, se fija como elegida y se sale del paso que ya no existe.
  useEffect(() => {
    if (!soloUno) return;
    const unico = employees[0]?.id;
    if (!unico) return;
    setData((d) => (d.employeeId === unico ? d : { ...d, employeeId: unico }));
    setStep((s) => (s === 2 ? 3 : s));
  }, [soloUno, employees]);
  const appointments = useSalonStore((s) => s.appointments);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const addSavedPublicAppointment = useSalonStore((s) => s.addSavedPublicAppointment);
  const clients = useSalonStore((s) => s.clients);
  // Reserva fiable (R5/R6): en un salón real no se dice «recibida» hasta que
  // el servidor ha guardado la cita, y mientras no se sepa si el slug es real
  // o demo no se envía nada. Ver `resolverSalonReal` y `guardarReservaPublica`.
  const resolution = useSalonStore((s) => s.publicBookingResolution);
  const resolutionStatus = resolution?.slug === salonSlug ? resolution.status : "resolviendo";
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const intentoRef = useRef<{ firma: string; cita: Appointment } | null>(null);

  // Bloqueo manual o deuda activa: se recalcula en cada tecla, no solo al
  // perder el foco. Sin recargo, la deuda antigua no bloquea.
  const blockedLocal = useMemo(
    () => {
      const matching = findClientByPhone(clients, data.phone);
      return isBookingBlocked(matching, profile) ? matching : undefined;
    },
    [clients, data.phone, profile],
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

  const blockedClient = realSlug
    ? isBookingBlocked(penalizedRemote, profile)
      ? penalizedRemote
      : null
    : blockedLocal;

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
  // Una sola señal: la que configure el salón (lib/senal.ts). La web pública
  // no sabe si la clienta es nueva: con la regla «solo nuevas» avisa «si es tu
  // primera visita».
  const reglaSen = reglaSenal(profile);
  const reservaSenal = { serviceIds: data.serviceIds, durationMin: totalMin, priceEur: total };
  const depositEur = importeSenal(reglaSen, reservaSenal);
  const textoSenal = textoSenalPublico(reglaSen, reservaSenal, profile.name, eur);

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
      timeZone: zonaDelSalon(profile),
    });
  }, [
    repeatValid,
    lastBooking,
    employees,
    appointments,
    repeatDuration,
    profile.lastSlotBufferMin,
    profile.timeZone,
  ]);
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
    setStep((s) => siguientePaso(s, soloUno));
  }
  function prev() {
    setStep((s) => pasoAnterior(s, soloUno));
  }

  async function confirm() {
    if (sendingRef.current) return;
    if (resolutionStatus === "resolviendo") return;
    if (resolutionStatus === "fallo") {
      // No se sabe si el salón es real: se reintenta la identificación en vez
      // de confirmar en local una cita que quizá debía ir al servidor.
      sendingRef.current = true;
      setSending(true);
      try {
        const resultado = await reintentarSalonPublico(salonSlug);
        setSendError(
          resultado === "fallo"
            ? "No hemos podido comprobar el salón. Tus datos siguen aquí; inténtalo de nuevo."
            : "Ya hemos conectado con el salón. Revisa tu reserva y vuelve a enviarla.",
        );
      } catch (error) {
        setSendError(mensajeErrorReserva(error));
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
      return;
    }
    if (
      !selectedServices.length ||
      !data.date ||
      !data.time ||
      !data.name ||
      !data.phone ||
      !data.acceptedPolicy ||
      faltanRespuestas.length > 0
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
      zonaDelSalon(profile),
    );
    const startISO = isoDelSalon(data.date, data.time, zonaDelSalon(profile));
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
    const citaSinId: Omit<Appointment, "id"> = {
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
      bookingAnswers: limpiarRespuestas(preguntas, data.bookingAnswers),
      // La señal con la que nace (en un salón real el servidor la recalcula
      // con su propia copia de la regla y manda la suya).
      ...senalDeReservaNueva(reglaSen, reservaSenal, startISO),
    };
    // En un salón real esto es lo que crea (o reconoce) la ficha del cliente
    // en Supabase y engancha la cita. En una demo de venta `realSalonSlug` es
    // null y estos datos no salen del navegador.
    const cliente = { name: clientName, phone: data.phone, email: data.email };
    if (resolutionStatus === "real") {
      // La misma solicitud conserva su id entre intentos; si el servidor
      // guardó la cita pero se perdió la respuesta, el reintento la reconoce.
      const firma = firmaReservaPublica(salonSlug, citaSinId, cliente);
      if (intentoRef.current?.firma !== firma) {
        intentoRef.current = { firma, cita: { ...citaSinId, id: `a-public-${crypto.randomUUID()}` } };
      }
      sendingRef.current = true;
      setSending(true);
      setSendError(null);
      try {
        await guardarReservaPublica(salonSlug, intentoRef.current.cita, cliente);
        addSavedPublicAppointment(intentoRef.current.cita);
      } catch (error) {
        setSendError(mensajeErrorReserva(error));
        return;
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    } else {
      addAppointment(citaSinId, cliente);
    }
    // Mejora B1: se guarda AQUÍ (reserva ya validada y, en un salón real, ya
    // guardada) lo mínimo para poder ofrecer "repetir" la próxima vez desde
    // este mismo navegador — nunca nombre ni teléfono, que ya viven donde corresponde.
    writeLastBooking(salonSlug, { serviceIds, employeeId, savedAt: Date.now() });
    if (!realSlug) {
      // Demo de venta: la reserva queda apuntada como lead en `leads_demo`,
      // fuera de las tablas reales. En un salón real no se llama (y el
      // servidor la rechazaría): la MISMA cita ya se ha guardado con su
      // estado "pending" por syncAppointment.
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
          note: serializeBookingNote(data.note, limpiarRespuestas(preguntas, data.bookingAnswers)),
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
          : !data.name || !data.phone || !data.acceptedPolicy || !!blockedClient ||
            faltanRespuestas.length > 0 ||
            sending || resolutionStatus === "resolviendo";

  const ctaLabel = step < 4 ? "Continuar" : `Confirmar reserva — ${eur(total)}`;

  function onCta() {
    if (step < 4) next();
    else void confirm();
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

  const recargoTexto = conRecargo && recargoRetraso ? recargoRetrasoTexto(recargoRetraso) : undefined;

  const dateLabel = data.date
    ? new Date(`${data.date}T00:00`).toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : undefined;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-28 pt-10 md:py-16 lg:pb-16">
      <StepIndicator step={step} soloUno={soloUno} />

      {/* Mejora B1: atajo de un toque para quien ya reservó antes en este
          salón desde este mismo navegador (patrón Booksy, sin cuentas). */}
      {showRepeatBanner && repeatNextSlot && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <button type="button" onClick={applyRepeat} className="min-w-0 flex-1 text-left">
            <p className="text-sm font-medium">
              Repetir: {repeatServiceNames}
              {!soloUno && repeatEmployeeName ? ` con ${repeatEmployeeName}` : ""}
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
              reglaSenal={reglaSen}
            />
          )}

          {!soloUno && step === 2 && (
            <StylistStep
              selected={data.employeeId}
              onSelect={(id) => setData((d) => ({ ...d, employeeId: id }))}
              tipo={tipo}
              employees={employees}
              esSalonReal={realSlug === salonSlug}
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
              timeZone={zonaDelSalon(profile)}
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
                    {/* Con un solo profesional, esta fila repetiría el nombre
                        del salón: no se enseña. */}
                    {!soloUno && (
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
                      Señal de {eur(depositEur)}, se descuenta del precio.
                    </p>
                  )}
                  {soloUno && employeeName && (
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

                {blockedClient && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {blockedClient.manualBlock ? (
                      <p>
                        Este salón ha bloqueado las reservas por internet para este número. Llámanos para
                        gestionarla.
                      </p>
                    ) : (
                      <p>
                        Tienes pendiente una penalización de {eur(profile.noShowFeeEur ?? 0)} por una
                        cita a la que no pudiste venir sin avisar. Abónala en {profile.name} y podrás
                        volver a reservar.
                      </p>
                    )}
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

                {(sendError || resolutionStatus === "fallo") && (
                  <p
                    role="alert"
                    className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                  >
                    {sendError ??
                      "No hemos podido comprobar el salón. Tus datos siguen aquí; inténtalo de nuevo."}
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={data.email ?? ""}
                    onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))}
                    placeholder="tunombre@correo.com"
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

                {showBookingQuestions && (
                  <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div>
                      <p className="text-sm font-medium">Para preparar tu cita</p>
                      <p className="text-xs text-muted-foreground">
                        {requireBookingQuestions ? "Las preguntas con * son obligatorias." : "Puedes dejar las preguntas sin responder."}
                      </p>
                    </div>
                    {preguntas.map((p) => (
                      <PreguntaDelFormulario
                        key={p.id}
                        pregunta={p}
                        respuestas={data.bookingAnswers}
                        onChange={(cambios) => setData((d) => ({ ...d, bookingAnswers: { ...d.bookingAnswers, ...cambios } }))}
                      />
                    ))}
                  </div>
                )}


                <p className="text-xs leading-relaxed text-muted-foreground">
                  Tus datos los trata {profile.name} para gestionar tu cita y el historial de tus servicios.{" "}
                  <Link to="/s/$salonSlug/privacidad" params={{ salonSlug }} search={(prev) => prev} className="font-medium text-primary underline-offset-2 hover:underline">Más información</Link>
                </p>

                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Checkbox
                    className="mt-0.5"
                    checked={data.acceptedPolicy ?? false}
                    onCheckedChange={(v) => setData((d) => ({ ...d, acceptedPolicy: v === true }))}
                  />
                  <span>
                    Acepto la política de cancelación: gratuita hasta{" "}
                    {conRecargo
                      ? `${profile.noShowNoticeHours ?? 2} h`
                      : "24 h"}{" "}
                    antes de la cita.
                  </span>
                </label>

                {conRecargo && (
                  <p className="text-xs text-muted-foreground">
                    Si no puedes venir, avísanos con {profile.noShowNoticeHours ?? 2} h de
                    antelación; si no, la siguiente reserva lleva {eur(profile.noShowFeeEur ?? 0)}{" "}
                    de penalización.
                  </p>
                )}
                {textoSenal && (
                  <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary">
                    {textoSenal}
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
          showEmployeeRow={!soloUno}
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
        showEmployeeRow={!soloUno}
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

function StepIndicator({ step, soloUno }: { step: PasoReserva; soloUno: boolean }) {
  // «Barbero» en barberías, «Profesional» en unisex: el rótulo del paso no
  // puede contradecir al título «Elige tu barbero» de la propia pantalla.
  // Con un solo profesional ese paso no existe: tres rótulos y "Paso 2 de 3".
  const tipo = useBusinessType();
  const labels = rotulosDePaso(professionalWord(tipo), soloUno);
  const visible = pasoVisible(step, soloUno);
  const total = totalPasos(soloUno);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <FluidSteps step={visible} total={total} />
        <span className="text-xs text-muted-foreground">
          Paso {visible} de {total}
        </span>
      </div>
      <span className="text-sm font-medium text-foreground">{labels[visible - 1]}</span>
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
  reglaSenal: reglaSenalSalon,
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
  /** Regla de señal del salón, para la etiqueta «con señal» de cada servicio. */
  reglaSenal: ReglaSenal;
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
          const items = services.filter(
            (s) => s.active !== false && (s.category ?? "Otros") === cat,
          );
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
                            {servicioLlevaSenal(reglaSenalSalon, s) ? " · con señal" : ""}
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
  esSalonReal,
}: {
  selected?: EmployeeId | "any";
  onSelect: (id: EmployeeId | "any") => void;
  tipo: BusinessType;
  employees: Employee[];
  /** En un salón real no se enseñan las fotos de stock. Ver `fotoDeProfesional`. */
  esSalonReal: boolean;
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
              photo={esSalonReal || !showsRealPhotos(tipo) ? undefined : e.photo}
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
        slot.available && !selected && "border-border hover:border-primary/50 hover:bg-primary/5",
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
  timeZone,
}: {
  /** Zona horaria de la agenda del salón (ver lib/zona-horaria.ts). */
  timeZone: string;
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
    return relevantEmployees.flatMap((e) => e.scheduleRanges?.[weekday] ?? []).map((r) => ({ start: r.start / 60, end: r.end / 60 }));
  }

  /**
   * Cierre "de verdad" del día: el del SALÓN, no el del profesional elegido —
   * Cardedal cierra a las 20:30 lleve quien lleve la caja, y el colchón de
   * cierre (`u`) se mide contra eso. Con "any" coincide con `scheduleForWeekday`.
   */
  function salonRangeForWeekday(weekday: number) {
    const opens = employees.flatMap((e) => e.scheduleRanges?.[weekday] ?? []).map((r) => ({ start: r.start / 60, end: r.end / 60 }));
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
    for (const minuto of huecosDeProfesionales(relevantEmployees, weekday, durationMin)) {
        const h = Math.floor(minuto / 60);
        const m = minuto % 60;
        if (h * 60 + m >= closeMinOffered) continue;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const open = relevantEmployees.some((e) => {
          return trabajaEn(e, weekday, minuto, durationMin);
        });
        if (!open) continue;
        const iso = isoDelSalon(dateKey, timeStr, timeZone);
        const free = relevantEmployees.some(
          (e) => !isSlotTaken(appointments, e.id, iso, durationMin),
        );
        if (free) return false;
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
    const lastHours = salonRange ? lastOfferedHours(salonRange.openMin, closeMinOffered) : [];

    const out: PrioritySlot[] = [];
    for (const minuto of huecosDeProfesionales(relevantEmployees, weekday, durationMin)) {
      const h = Math.floor(minuto / 60);
      const hourOccupancy = smartSpread ? hourOccupancyPct(appointments, dateKey, h, employees) : 0;
      const busy = smartSpread && isBusyHour(h, hourOccupancy, lastHours);
        const m = minuto % 60;
        // "No ofrecer los últimos X minutos": el hueco ni se lista.
        if (h * 60 + m >= closeMinOffered) continue;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const open = relevantEmployees.some((e) => {
          return trabajaEn(e, weekday, minuto, durationMin);
        });
        if (!open) continue;
        const iso = isoDelSalon(dateKey, timeStr, timeZone);
        const available = relevantEmployees.some(
          (e) => !isSlotTaken(appointments, e.id, iso, durationMin),
        );
        out.push({
          time: timeStr,
          available,
          busy,
          priority: isPriorityTime(timeStr, priorityHours),
        });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDate,
    relevantEmployees,
    employees,
    appointments,
    durationMin,
    smartSpread,
    lastSlotBufferMin,
    priorityHours,
  ]);

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
  const priorityAvailable = useMemo(() => slots.filter((s) => s.priority && s.available), [slots]);
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
              <p className="mb-4 font-display text-lg">{capitalizar(fechaLarga(activeDate))}</p>
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
            Señal de {eur(depositEur)}, se descuenta del precio.
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

/**
 * Una pregunta del formulario de reserva, sea cual sea su tipo (ver
 * lib/preguntas-reserva.ts). Las de sí/no con detalle piden «¿cuál?» si la
 * respuesta es «Sí»; al cambiar a «No», el detalle se borra.
 */
function PreguntaDelFormulario({
  pregunta: p,
  respuestas,
  onChange,
}: {
  pregunta: PreguntaReserva;
  respuestas: BookingAnswers | undefined;
  onChange: (cambios: BookingAnswers) => void;
}) {
  const id = `pregunta-${p.id}`;
  const valor = respuestas?.[p.id] ?? "";
  const claseSelect = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const etiqueta = `${p.texto}${p.obligatoria ? " *" : ""}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {p.tipo === "opcion" || p.tipo === "si_no" ? (
        <select
          id={id}
          className={claseSelect}
          value={valor}
          onChange={(e) =>
            onChange(p.detalle && e.target.value !== "Sí" ? { [p.id]: e.target.value, [p.detalle.id]: undefined } : { [p.id]: e.target.value })
          }
        >
          <option value="">Elige una opción</option>
          {(p.tipo === "si_no" ? ["No", "Sí"] : (p.opciones ?? [])).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          type={p.tipo === "numero" ? "number" : "text"}
          inputMode={p.tipo === "numero" ? "decimal" : undefined}
          maxLength={200}
          value={valor}
          onChange={(e) => onChange({ [p.id]: e.target.value })}
        />
      )}
      {p.detalle && valor === "Sí" && (
        <Input
          aria-label={p.detalle.texto}
          placeholder={p.detalle.texto}
          maxLength={120}
          value={respuestas?.[p.detalle.id] ?? ""}
          onChange={(e) => onChange({ [p.detalle!.id]: e.target.value })}
        />
      )}
    </div>
  );
}
