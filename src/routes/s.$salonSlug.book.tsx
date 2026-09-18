import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Sparkles, PhoneCall } from "lucide-react";
import { employeesForType, servicesForType, depositFor, requiresDeposit } from "@/lib/mock/salon";
import type { Appointment, Employee, EmployeeId, Service } from "@/lib/mock/types";
import { useSalonStore, isSlotTaken } from "@/lib/store";
import { useBusinessType, useDisplayProfile } from "@/lib/use-display-profile";
import {
  categoryOrderOf,
  professionalWord,
  showsRealPhotos,
  type BusinessType,
} from "@/lib/business-type";
import { findClientWithPenalty } from "@/lib/no-show";
import {
  toDateKey,
  hourOccupancyPct,
  offeredCloseMin,
  lastOfferedHours,
  isBusyHour,
  pickAlternativeSlots,
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
import { sumServices } from "@/lib/appointment-services";
import { FluidSteps } from "@/components/twentyfirst/fluid-steps";
import { eur } from "@/lib/copy";

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

  const [data, setData] = useState<WizardData>(() => ({
    serviceIds: parseServiceIds(search.service, serviceMap),
    employeeId: isV2 ? "any" : undefined,
  }));
  const [step, setStep] = useState<1 | 2 | 3 | 4>(data.serviceIds.length ? 2 : 1);
  const appointments = useSalonStore((s) => s.appointments);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const clients = useSalonStore((s) => s.clients);

  // Política de plantón (ver lib/no-show.ts): mientras el teléfono tecleado
  // coincida con un cliente que debe una penalización, se bloquea el envío —
  // se recalcula en cada tecla, no solo al perder el foco.
  const penalizedClient = useMemo(
    () => findClientWithPenalty(clients, data.phone),
    [clients, data.phone],
  );

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

  function next() {
    setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);
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
      totalMin,
      appointments,
      employees,
    );
    const startISO = new Date(`${data.date}T${data.time}:00`).toISOString();
    addAppointment({
      clientId: `c-walkin-${Date.now()}`,
      clientName: data.name,
      serviceIds,
      employeeId,
      start: startISO,
      duration: totalMin,
      priceEur: total,
      // Las reservas de la web pública entran como solicitud: las confirma,
      // cambia o rechaza el salón desde el panel. Las citas creadas a mano
      // desde el panel (NewAppointmentDialog) siguen naciendo confirmadas.
      status: "pending",
      note: data.note,
    });
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

  const ctaLabel = step < 4 ? "Continuar" : `Confirmar reserva — ${eur(total)}`;

  function onCta() {
    if (step < 4) next();
    else confirm();
  }

  const dateLabel = data.date
    ? new Date(`${data.date}T00:00`).toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : undefined;

  return (
    <section className="mx-auto max-w-5xl px-5 pb-28 pt-10 md:py-16 lg:pb-16">
      <StepIndicator step={step} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {step === 1 && (
            <ServiceStep
              selected={data.serviceIds}
              totalMin={totalMin}
              onToggle={toggleService}
              tipo={tipo}
              services={services}
            />
          )}

          {step === 2 && (
            <StylistStep
              selected={data.employeeId}
              onSelect={(id) => setData((d) => ({ ...d, employeeId: id }))}
              tipo={tipo}
              employees={employees}
            />
          )}

          {step === 3 && selectedServices.length > 0 && (
            <DateTimeStep
              durationMin={totalMin}
              stylistChoice={data.employeeId ?? "any"}
              appointments={appointments}
              selectedDate={data.date}
              selectedTime={data.time}
              onPick={(date, time) => setData((d) => ({ ...d, date, time }))}
              employees={employees}
              smartSpread={!!profile.smartSpread}
              lastSlotBufferMin={profile.lastSlotBufferMin ?? 0}
            />
          )}

          {step === 4 && (
            <Step title="Tus datos">
              <div className="max-w-xl space-y-5">
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
                    Acepto la política de cancelación: gratuita hasta 24 h antes de la cita.
                  </span>
                </label>

                {(profile.noShowFeeEur ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Si no puedes venir, avísanos con {profile.noShowNoticeHours ?? 2} h de
                    antelación; si no, la siguiente reserva lleva {eur(profile.noShowFeeEur ?? 0)} de
                    penalización.
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
          durationMin={totalMin}
          employeeName={employeeName}
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
        durationMin={totalMin}
        employeeName={employeeName}
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

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ["Servicio", "Estilista", "Fecha y hora", "Tus datos"];
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <FluidSteps step={step} total={4} />
        <span className="text-xs text-muted-foreground">Paso {step} de 4</span>
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
  onToggle,
  tipo,
  services,
}: {
  selected: string[];
  totalMin: number;
  onToggle: (id: string) => void;
  tipo: BusinessType;
  services: Service[];
}) {
  const count = selected.length;
  const categoryOrder = categoryOrderOf(services);
  return (
    <Step title="Elige uno o varios servicios">
      <p className="-mt-4 mb-6 text-sm text-muted-foreground" aria-live="polite">
        {count === 0
          ? "Puedes combinar varios en la misma cita."
          : `${count} ${count === 1 ? "servicio elegido" : "servicios elegidos"} · ${totalMin} min en total`}
      </p>
      <Accordion
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
}: {
  /** Duración total de la cita: el hueco que hay que encontrar libre. */
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

  const slots = useMemo((): SpreadSlot[] => {
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

    const out: SpreadSlot[] = [];
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
        out.push({ time: timeStr, available, busy });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate, relevantEmployees, employees, appointments, durationMin, smartSpread, lastSlotBufferMin]);

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

              <div className="space-y-5">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                      {g.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((s) => {
                        const isSelected =
                          selectedDate === activeDateKey && selectedTime === s.time;
                        return (
                          <button
                            key={s.time}
                            disabled={!s.available}
                            onClick={() => handleSlotClick(s)}
                            title={s.busy ? "Suele haber espera" : undefined}
                            className={cn(
                              "relative rounded-full border px-4 py-2 text-sm transition-colors",
                              !s.available &&
                                "cursor-not-allowed border-border/40 text-muted-foreground/50 line-through",
                              s.available &&
                                isSelected &&
                                "border-primary bg-primary text-primary-foreground",
                              s.available &&
                                !isSelected &&
                                "border-border hover:border-primary/50 hover:bg-primary/5",
                              s.available && s.busy && !isSelected && "border-amber-500/50",
                            )}
                          >
                            {s.time}
                            {s.busy && s.available && (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "absolute -right-0.5 -top-0.5 size-2 rounded-full",
                                  isSelected ? "bg-primary-foreground" : "bg-amber-500",
                                )}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
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
  durationMin,
  employeeName,
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
  durationMin: number;
  employeeName?: string;
  dateLabel?: string;
  timeLabel?: string;
  total: number;
  depositEur: number;
  ctaLabel: string;
  ctaDisabled: boolean;
  onCta: () => void;
}) {
  const profile = useDisplayProfile();
  const salonName = profile.name;
  if (variant === "bar") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {serviceNames.length ? serviceNames.join(" + ") : "Elige un servicio"}
            </p>
            <p className="font-display text-lg">
              {eur(total)}
              {serviceNames.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {durationMin} min
                </span>
              )}
            </p>
          </div>
          <Button onClick={onCta} disabled={ctaDisabled} className="shrink-0 rounded-full px-6">
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
          {durationMin > 0 && (
            <SummaryRow
              label={serviceNames.length > 1 ? "Duración total" : "Duración"}
              value={`${durationMin} min`}
            />
          )}
          <SummaryRow label="Estilista" value={employeeName ?? "—"} />
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
