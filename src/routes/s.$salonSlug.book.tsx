import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { services, employees, serviceMap, employeeMap, depositFor, requiresDeposit } from "@/lib/mock/salon";
import type { Appointment, EmployeeId, Service } from "@/lib/mock/types";
import { useSalonStore, isSlotTaken } from "@/lib/store";
import { StylistAvatar } from "@/components/StylistAvatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

export const Route = createFileRoute("/s/$salonSlug/book")({
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
  component: BookingWizard,
});

const SERVICE_ES: Record<string, { name: string; description: string }> = {
  haircut: { name: "Corte de caballero", description: "Lavado, corte de firma y acabado." },
  beard: { name: "Arreglo de barba", description: "Toalla caliente, perfilado y cuidado." },
  color: { name: "Color", description: "Color de un tono, brillo y matiz final." },
  highlights: { name: "Mechas", description: "Iluminación pintada a mano, tono y tratamiento." },
  keratin: { name: "Tratamiento de keratina", description: "Alisado con proteína, dura 12 semanas." },
  styling: { name: "Peinado", description: "Secado o peinado para eventos especiales." },
};

const CATEGORY_LABELS: Record<string, string> = {
  haircut: "Cortes",
  styling: "Cortes",
  beard: "Barbería",
  color: "Color",
  highlights: "Color",
  keratin: "Tratamientos",
};
const CATEGORY_ORDER = ["Cortes", "Barbería", "Color", "Tratamientos"];

const EMPLOYEE_ES: Record<string, { specialty: string }> = {
  ines: { specialty: "Especialista en cortes y rizos" },
  manuela: { specialty: "Color y mechas" },
  luna: { specialty: "Editorial y tratamientos" },
};

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveEmployee(
  stylistChoice: EmployeeId | "any" | undefined,
  date: string,
  time: string,
  durationMin: number,
  appointments: Appointment[],
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

type WizardData = {
  serviceId?: string;
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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(search.service ? 2 : 1);
  const [data, setData] = useState<WizardData>({ serviceId: search.service });
  const appointments = useSalonStore((s) => s.appointments);
  const addAppointment = useSalonStore((s) => s.addAppointment);

  const service = data.serviceId ? serviceMap[data.serviceId] : undefined;
  const stylistChoice = data.employeeId;
  const employeeName = stylistChoice === "any" ? "Cualquiera disponible" : stylistChoice ? employeeMap[stylistChoice]?.name : undefined;
  const depositEur = service && requiresDeposit(service.durationMin) ? depositFor(service.priceEur, service.durationMin) : 0;
  const total = service?.priceEur ?? 0;

  function next() {
    setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);
  }

  function confirm() {
    if (!service || !data.date || !data.time || !data.name || !data.phone || !data.acceptedPolicy) return;
    const employeeId = resolveEmployee(stylistChoice, data.date, data.time, service.durationMin, appointments);
    const startISO = new Date(`${data.date}T${data.time}:00`).toISOString();
    addAppointment({
      clientId: `c-walkin-${Date.now()}`,
      clientName: data.name,
      serviceId: service.id,
      employeeId,
      start: startISO,
      duration: service.durationMin,
      priceEur: service.priceEur,
      status: "confirmed",
      note: data.note,
    });
    registerBookingClient({
      data: {
        salonSlug,
        name: data.name,
        phone: data.phone,
        email: data.email,
        serviceId: service.id,
        employeeId,
        startISO,
        durationMin: service.durationMin,
        priceEur: service.priceEur,
        note: data.note,
      },
    }).catch((err) => console.error("Supabase sync failed (booking still confirmed locally):", err));
    toast.success("Reserva confirmada", { description: `${service.name} · ${data.date} a las ${data.time}` });
    navigate({
      to: "/s/$salonSlug/confirmation",
      params: { salonSlug },
      search: {
        service: service.id,
        employeeId,
        date: data.date,
        time: data.time,
        name: data.name,
      },
    });
  }

  const ctaDisabled =
    step === 1 ? !data.serviceId : step === 2 ? !data.employeeId : step === 3 ? !data.date || !data.time : !data.name || !data.phone || !data.acceptedPolicy;

  const ctaLabel = step < 4 ? "Continuar" : `Confirmar reserva — ${eur(total)}`;

  function onCta() {
    if (step < 4) next();
    else confirm();
  }

  const dateLabel = data.date
    ? new Date(`${data.date}T00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    : undefined;

  return (
    <section className="mx-auto max-w-5xl px-5 pb-28 pt-10 md:py-16 lg:pb-16">
      <StepIndicator step={step} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {step === 1 && <ServiceStep selected={data.serviceId} onSelect={(id) => setData((d) => ({ ...d, serviceId: id }))} />}

          {step === 2 && <StylistStep selected={data.employeeId} onSelect={(id) => setData((d) => ({ ...d, employeeId: id }))} />}

          {step === 3 && service && (
            <DateTimeStep
              service={service}
              stylistChoice={data.employeeId ?? "any"}
              appointments={appointments}
              selectedDate={data.date}
              selectedTime={data.time}
              onPick={(date, time) => setData((d) => ({ ...d, date, time }))}
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

                {service && requiresDeposit(service.durationMin) && (
                  <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary">
                    Este servicio requiere un depósito de {eur(depositEur)} que se cobrará en el salón.
                  </div>
                )}

                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Checkbox
                    className="mt-0.5"
                    checked={data.acceptedPolicy ?? false}
                    onCheckedChange={(v) => setData((d) => ({ ...d, acceptedPolicy: v === true }))}
                  />
                  <span>Acepto la política de cancelación: gratuita hasta 24 h antes de la cita.</span>
                </label>
              </div>
            </Step>
          )}

          <div className="mt-10 flex items-center justify-between">
            {step > 1 ? (
              <button onClick={prev} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Atrás
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>

        <BookingSummary
          variant="sidebar"
          serviceName={service ? (SERVICE_ES[service.id]?.name ?? service.name) : undefined}
          durationMin={service?.durationMin}
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
        serviceName={service ? (SERVICE_ES[service.id]?.name ?? service.name) : undefined}
        durationMin={service?.durationMin}
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
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Paso {step} de 4</span>
        <span className="font-medium text-foreground">{labels[step - 1]}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }} />
      </div>
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

function ServiceStep({ selected, onSelect }: { selected?: string; onSelect: (id: string) => void }) {
  return (
    <Step title="Elige un servicio">
      <Accordion type="single" collapsible defaultValue={CATEGORY_ORDER[0]} className="divide-y divide-border/40">
        {CATEGORY_ORDER.map((cat) => {
          const items = services.filter((s) => s.active !== false && (CATEGORY_LABELS[s.id] ?? "Otros") === cat);
          if (!items.length) return null;
          return (
            <AccordionItem key={cat} value={cat} className="border-b-0">
              <AccordionTrigger className="py-4 text-base font-display font-medium hover:no-underline">{cat}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {items.map((s) => {
                    const label = SERVICE_ES[s.id] ?? { name: s.name, description: s.description };
                    const isSelected = selected === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onSelect(s.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors",
                          isSelected ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/40 hover:bg-muted/30",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{label.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {s.durationMin} min{requiresDeposit(s.durationMin) ? " · requiere depósito" : ""}
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

function StylistStep({ selected, onSelect }: { selected?: EmployeeId | "any"; onSelect: (id: EmployeeId | "any") => void }) {
  return (
    <Step title="Elige un estilista">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => onSelect("any")}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-card px-4 py-6 text-center transition-colors",
            selected === "any" ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border/60 hover:border-primary/40",
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
              selected === e.id ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border/60 hover:border-primary/40",
            )}
          >
            <StylistAvatar name={e.name} employeeId={e.id} size="lg" />
            <div>
              <p className="text-sm font-medium">{e.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{EMPLOYEE_ES[e.id]?.specialty ?? e.specialty}</p>
            </div>
          </button>
        ))}
      </div>
    </Step>
  );
}

function DateTimeStep({
  service,
  stylistChoice,
  appointments,
  selectedDate,
  selectedTime,
  onPick,
}: {
  service: Service;
  stylistChoice: EmployeeId | "any";
  appointments: Appointment[];
  selectedDate?: string;
  selectedTime?: string;
  onPick: (date: string, time: string) => void;
}) {
  const relevantEmployees = useMemo(
    () => (stylistChoice === "any" ? employees : employees.filter((e) => e.id === stylistChoice)),
    [stylistChoice],
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  function scheduleForWeekday(weekday: number) {
    return relevantEmployees.map((e) => e.schedule[weekday]).filter(Boolean) as { start: number; end: number }[];
  }

  function isDayDisabled(date: Date) {
    if (date < today) return true;
    const weekday = date.getDay();
    const opens = scheduleForWeekday(weekday);
    if (opens.length === 0) return true;
    const dateKey = toDateKey(date);
    const start = Math.min(...opens.map((o) => o.start));
    const end = Math.max(...opens.map((o) => o.end));
    for (let h = start; h < end; h++) {
      for (const m of [0, 30]) {
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const open = relevantEmployees.some((e) => {
          const sched = e.schedule[weekday];
          return sched && h >= sched.start && h + service.durationMin / 60 <= sched.end;
        });
        if (!open) continue;
        const iso = new Date(`${dateKey}T${timeStr}:00`).toISOString();
        const free = relevantEmployees.some((e) => !isSlotTaken(appointments, e.id, iso, service.durationMin));
        if (free) return false;
      }
    }
    return true;
  }

  const [activeDate, setActiveDate] = useState<Date | undefined>(selectedDate ? new Date(`${selectedDate}T00:00`) : undefined);

  useEffect(() => {
    if (activeDate) return;
    const d = new Date(today);
    for (let i = 0; i < 60; i++) {
      if (!isDayDisabled(d)) {
        setActiveDate(new Date(d));
        break;
      }
      d.setDate(d.getDate() + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slots = useMemo(() => {
    if (!activeDate) return [];
    const dateKey = toDateKey(activeDate);
    const weekday = activeDate.getDay();
    const opens = scheduleForWeekday(weekday);
    if (opens.length === 0) return [];
    const start = Math.min(...opens.map((o) => o.start));
    const end = Math.max(...opens.map((o) => o.end));
    const out: { time: string; available: boolean }[] = [];
    for (let h = start; h < end; h++) {
      for (const m of [0, 30]) {
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const open = relevantEmployees.some((e) => {
          const sched = e.schedule[weekday];
          return sched && h >= sched.start && h + service.durationMin / 60 <= sched.end;
        });
        if (!open) continue;
        const iso = new Date(`${dateKey}T${timeStr}:00`).toISOString();
        const available = relevantEmployees.some((e) => !isSlotTaken(appointments, e.id, iso, service.durationMin));
        out.push({ time: timeStr, available });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate, relevantEmployees, appointments, service.durationMin]);

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

  return (
    <Step title="Fecha y hora">
      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        <div className="self-start rounded-2xl border border-border/60 bg-card p-1">
          <Calendar mode="single" locale={es} selected={activeDate} onSelect={(d) => d && setActiveDate(d)} disabled={isDayDisabled} />
        </div>
        <div>
          {activeDate ? (
            <>
              <p className="mb-4 font-display text-lg capitalize">
                {activeDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay horas disponibles este día. Prueba con otra fecha.</p>
              )}
              <div className="space-y-5">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{g.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((s) => {
                        const isSelected = selectedDate === activeDateKey && selectedTime === s.time;
                        return (
                          <button
                            key={s.time}
                            disabled={!s.available}
                            onClick={() => activeDateKey && onPick(activeDateKey, s.time)}
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm transition-colors",
                              !s.available && "cursor-not-allowed border-border/40 text-muted-foreground/50 line-through",
                              s.available && isSelected && "border-primary bg-primary text-primary-foreground",
                              s.available && !isSelected && "border-border hover:border-primary/50 hover:bg-primary/5",
                            )}
                          >
                            {s.time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Elige un día en el calendario para ver las horas disponibles.</p>
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
  serviceName,
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
  serviceName?: string;
  durationMin?: number;
  employeeName?: string;
  dateLabel?: string;
  timeLabel?: string;
  total: number;
  depositEur: number;
  ctaLabel: string;
  ctaDisabled: boolean;
  onCta: () => void;
}) {
  const salonName = useSalonStore((s) => s.salonProfile.name);
  if (variant === "bar") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{serviceName ?? "Elige un servicio"}</p>
            <p className="font-display text-lg">{eur(total)}</p>
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
            <img src={heroImg} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base">{salonName}</p>
            <p className="text-xs text-muted-foreground">Resumen de tu reserva</p>
          </div>
        </div>

        <div className="space-y-2.5 text-sm">
          <SummaryRow label="Servicio" value={serviceName ?? "—"} />
          {durationMin && <SummaryRow label="Duración" value={`${durationMin} min`} />}
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
          <p className="mt-2 text-xs text-muted-foreground">Incluye depósito de {eur(depositEur)} a pagar en el salón.</p>
        )}

        <Button onClick={onCta} disabled={ctaDisabled} className="mt-6 w-full rounded-full py-6 text-sm">
          {ctaLabel}
        </Button>
      </div>
    </aside>
  );
}
