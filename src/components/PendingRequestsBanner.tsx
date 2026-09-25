import { useState } from "react";
import { DuracionOtra } from "@/components/DuracionOtra";
import { toast } from "sonner";
import { AlertTriangle, Clock, Clock3, MessageCircle } from "lucide-react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { duracionRecordada } from "@/lib/derive";
import { enlaceDeFianza } from "@/lib/avisos";
import { eur } from "@/lib/copy";
import type { Appointment } from "@/lib/mock/types";
import { StatusBadge } from "@/components/StatusBadge";
import { StylistDot } from "@/components/StylistAvatar";
import { Button } from "@/components/ui/button";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { DepositStatusControls } from "@/components/DepositStatusControls";
import { deadlineHours, depositDueAt } from "@/lib/deposit-deadline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PendingRequestsBannerProps {
  /** Abre el detalle de la cita (AppointmentDetailSheet) para cambiar duración u hora. */
  onOpenDetail: (appointment: Appointment) => void;
}

/** Mismos valores que el desplegable de duración de `NewAppointmentDialog`. */
const DURATION_OPTIONS_MIN = [15, 30, 40, 45, 60, 75, 90, 120, 150, 180];

/**
 * Franja de "solicitudes pendientes de confirmar": las reservas que llegaron
 * de la web pública (`s.$salonSlug.book.tsx`) y todavía no ha revisado el
 * salón. Se usa tanto en el inicio del panel (`app.index.tsx`) como en la
 * pantalla de citas (`app.appointments.tsx`) — mismo componente para que no
 * se desvíen entre sí, igual que `AppointmentDetailSheet` o `StatusBadge`.
 *
 * Cuando el salón tiene `duracionFlexible` activo (caso PeluChic: "la duración
 * la decido yo, no la clienta"), cada tarjeta trae su propio desplegable de
 * duración editable — la solicitud se confirma con la duración que decida el
 * salón, no con la de catálogo. Con `duracionFlexible` apagado el bloque se
 * comporta exactamente igual que antes.
 */
export function PendingRequestsBanner({ onOpenDetail }: PendingRequestsBannerProps) {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const markDepositRequested = useSalonStore((s) => s.markDepositRequested);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const depositEnabled = useSalonStore((s) => !!s.salonProfile.depositEnabled);
  const depositBizumPhone = useSalonStore((s) => s.salonProfile.depositBizumPhone ?? "");
  // Con un solo profesional, "con Adam" en cada solicitud es ruido.
  const soloUno = esSoloUnProfesional(useEquipo());
  const depositAmountEur = useSalonStore((s) => s.salonProfile.depositAmountEur ?? 10);
  const depositDeadlineHours = useSalonStore((s) => deadlineHours(s.salonProfile.depositDeadlineHours));
  const duracionFlexible = useSalonStore((s) => !!s.salonProfile.duracionFlexible);
  const pideFianza = depositEnabled && !!depositBizumPhone.trim();
  const serviceMap = selectServiceMap(services);

  // Duración elegida por el salón para cada tarjeta, mientras no se confirma.
  const [duracionPorTarjeta, setDuracionPorTarjeta] = useState<Record<string, number>>({});
  /** Tarjeta con el campo «Otra…» abierto. */
  const [otraEn, setOtraEn] = useState<string | null>(null);

  const pending = appointments
    .filter((a) => a.status === "pending")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  if (pending.length === 0) return null;

  function handleConfirm(a: Appointment) {
    updateAppointment(a.id, { status: "confirmed" });
    toast.success("Cita confirmada", { description: a.clientName });
  }

  function handleConfirmConDuracion(a: Appointment, duracion: number) {
    updateAppointment(a.id, { status: "confirmed", duration: duracion });
    toast.success("Cita confirmada", {
      description: `${a.clientName} · ${duracion} min`,
    });
  }

  /**
   * Rechazar era un toque, irreversible y sin red: si te equivocabas de fila
   * habías rechazado a un cliente de verdad y no había forma de volver atrás
   * desde la interfaz. Ahora el toast trae "Deshacer" durante unos segundos y
   * devuelve la solicitud exactamente al estado que tenía.
   */
  function handleReject(a: Appointment) {
    const estadoPrevio = a.status;
    cancelAppointment(a.id);
    toast.success("Solicitud rechazada", {
      description: a.clientName,
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: () => {
          updateAppointment(a.id, { status: estadoPrevio });
          toast.success("Solicitud recuperada", { description: a.clientName });
        },
      },
    });
  }

  /**
   * Pedir la señal por Bizum sin abrir el detalle: María (PeluChic) la pide a
   * toda clienta nueva, así que tiene que estar en la misma fila donde ve la
   * solicitud. Abre WhatsApp con el mensaje escrito — lo envía ella.
   */
  function handleFianza(a: Appointment) {
    if (a.depositReceivedAt) return;
    const telefono = clients.find((c) => c.id === a.clientId)?.phone ?? "";
    if (!telefono) {
      toast.error("Esta solicitud no trae teléfono al que escribir");
      return;
    }
    const requestedAt = new Date().toISOString();
    const url = enlaceDeFianza(telefono, {
      clientName: a.clientName,
      startISO: a.start,
      salonName,
      bizumPhone: depositBizumPhone,
      importeEur: depositAmountEur,
      deadlineISO: depositDueAt(requestedAt, depositDeadlineHours),
    }, requestedAt);
    markDepositRequested(a.id, depositAmountEur, requestedAt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /**
   * Próxima cita del mismo profesional tras el fin de `a` (con la duración que
   * se esté proponiendo), para avisar del solape sin bloquear: es su agenda,
   * ella decide si lo acepta.
   */
  function proximaConSolape(a: Appointment, duracion: number): Appointment | null {
    const finPropuesto = +new Date(a.start) + duracion * 60_000;
    const inicio = +new Date(a.start);
    const candidatas = appointments
      .filter(
        (b) =>
          b.id !== a.id &&
          b.employeeId === a.employeeId &&
          (b.status === "confirmed" || b.status === "pending") &&
          +new Date(b.start) >= inicio,
      )
      .sort((x, y) => +new Date(x.start) - +new Date(y.start));
    const siguiente = candidatas[0];
    if (!siguiente) return null;
    return +new Date(siguiente.start) < finPropuesto ? siguiente : null;
  }

  return (
    <div
      data-tour="pending-requests"
      className="overflow-hidden rounded-[20px] border-[1.5px] border-dashed border-moca bg-card"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <Clock className="size-[18px] shrink-0 text-primary" strokeWidth={1.6} />
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-[-0.01em] text-foreground">
            {duracionFlexible
              ? `${pending.length} ${pending.length === 1 ? "solicitud" : "solicitudes"} por confirmar`
              : `${pending.length} ${
                  pending.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"
                } de confirmar`}
          </h2>
          {duracionFlexible && (
            <p className="text-[12.5px] text-muted-foreground">
              Ajusta la duración de cada una antes de aceptarla: la decides tú, no la clienta.
            </p>
          )}
        </div>
      </div>
      <div className="divide-y divide-border">
        {pending.map((a) => {
          const emp = employeeMap[a.employeeId];

          if (!duracionFlexible) {
            return (
              <div
                key={a.id}
                className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{a.clientName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <StylistDot employeeId={a.employeeId} className="size-2" />
                    {serviceLabelOf(a, serviceMap)} ·{" "}
                    {new Date(a.start).toLocaleString("es", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · con {emp.name}
                  </p>
                  <BookingAnswersSummary answers={a.bookingAnswers} />
                  <DepositStatusControls appointment={a} hours={depositDeadlineHours} />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => handleConfirm(a)}>
                    Confirmar
                  </Button>
                  {pideFianza && !a.depositReceivedAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleFianza(a)}
                    >
                      <MessageCircle className="size-3.5" />
                      {a.depositReceivedAt
                        ? "Señal recibida"
                        : a.depositRequestedAt
                          ? "Reenviar señal"
                          : `Pedir ${eur(depositAmountEur)} de señal`}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onOpenDetail(a)}>
                    Cambiar fecha/hora
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-melocoton-tinta hover:bg-melocoton hover:text-melocoton-tinta"
                    onClick={() => handleReject(a)}
                  >
                    Rechazar
                  </Button>
                  <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                </div>
              </div>
            );
          }

          // --- Caso duración flexible: el salón decide cuánto dura cada cita ---
          const catalogoMin = a.serviceIds.reduce(
            (sum, id) => sum + (serviceMap[id]?.durationMin ?? 0),
            0,
          );
          const recordada = duracionRecordada(appointments, a.clientId, a.serviceIds, catalogoMin);
          const propuesta = recordada?.minutos ?? (catalogoMin || a.duration);
          const duracionElegida = duracionPorTarjeta[a.id] ?? propuesta;
          const opciones = [...new Set([...DURATION_OPTIONS_MIN, catalogoMin, duracionElegida])]
            .filter((n) => n > 0)
            .sort((x, y) => x - y);
          const solape = proximaConSolape(a, duracionElegida);

          return (
            <div key={a.id} className="flex flex-col gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-bold">{a.clientName}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  {!soloUno && <StylistDot employeeId={a.employeeId} className="size-2" />}
                  {serviceLabelOf(a, serviceMap)} ·{" "}
                  {new Date(a.start).toLocaleString("es", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {soloUno ? "" : ` · con ${emp.name}`}
                </p>
                <BookingAnswersSummary answers={a.bookingAnswers} />
                <DepositStatusControls appointment={a} hours={depositDeadlineHours} />
              </div>

              <div className="flex flex-col gap-1.5 rounded-2xl bg-nata px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-foreground">Duración propuesta</p>
                  {recordada && (
                    <p className="flex items-start gap-1.5 text-xs text-primary">
                      <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        La última vez tardó {recordada.minutos} min (
                        {new Date(recordada.cuando).toLocaleDateString("es", {
                          day: "numeric",
                          month: "long",
                        })}
                        ), no los {catalogoMin} de la carta. Te proponemos {recordada.minutos}.
                      </span>
                    </p>
                  )}
                </div>
                <Select
                  value={String(duracionElegida)}
                  onValueChange={(v) => {
                    if (v === "otra") return setOtraEn(a.id);
                    setOtraEn(null);
                    setDuracionPorTarjeta((prev) => ({ ...prev, [a.id]: Number(v) }));
                  }}
                >
                  <SelectTrigger
                    className="w-full sm:w-32"
                    aria-label={`Duración de la cita de ${a.clientName}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opciones.map((min) => (
                      <SelectItem key={min} value={String(min)}>
                        {min} min
                      </SelectItem>
                    ))}
                    <SelectItem value="otra">Otra…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {otraEn === a.id && (
                <div className="flex justify-end">
                  <DuracionOtra
                    abiertoAlInicio
                    onCancelar={() => setOtraEn(null)}
                    claseChip="h-9 rounded-full px-3.5 text-[13px] font-bold text-cafe-medio"
                    onElegir={(min) => {
                      setDuracionPorTarjeta((prev) => ({ ...prev, [a.id]: min }));
                      setOtraEn(null);
                    }}
                  />
                </div>
              )}

              {solape && (
                <p className="flex items-start gap-1.5 text-[12.5px] text-melocoton-tinta">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Se solapa con la cita de las{" "}
                  {new Date(solape.start).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => handleConfirmConDuracion(a, duracionElegida)}>
                  Confirmar con esta duración
                </Button>
                {pideFianza && !a.depositReceivedAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => handleFianza(a)}
                  >
                    <MessageCircle className="size-3.5" />
                    {a.depositReceivedAt
                      ? "Señal recibida"
                      : a.depositRequestedAt
                        ? "Reenviar señal"
                        : `Pedir ${eur(depositAmountEur)} de señal`}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onOpenDetail(a)}>
                  Cambiar fecha/hora
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-melocoton-tinta hover:bg-melocoton hover:text-melocoton-tinta"
                  onClick={() => handleReject(a)}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
