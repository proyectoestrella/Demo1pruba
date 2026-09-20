import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "@/lib/appointment-status";
import { useSalonStore } from "@/lib/store";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { employeeMap } from "@/lib/mock/salon";
import { serviceNamesOf } from "@/lib/appointment-services";
import { isWithinNoticeWindow } from "@/lib/no-show";
import { noShowSummary } from "@/lib/plantones";
import { enlaceDeFianza } from "@/lib/avisos";
import { PAYMENT_METHODS } from "@/lib/caja";
import { eur } from "@/lib/copy";
import {
  PAYMENT_METHOD_LABELS,
  type Appointment,
  type AppointmentStatus,
  type PaymentMethod,
} from "@/lib/mock/types";
import { StylistAvatar } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, Clock, Euro, CheckCheck, MessageCircle, TriangleAlert } from "lucide-react";

/** Duraciones que puede elegir el salón al ajustar una cita, en minutos. */
const DURATION_OPTIONS_MIN = [15, 30, 45, 60, 90, 120, 150, 180];

// Local time components (not toISOString, que es UTC) — igual que en
// NewAppointmentDialog, para que "09:00" en el input sea "09:00" en la cita.
function toTimeInputValue(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface AppointmentDetailSheetProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Sheet with appointment detail + change-status + cancel. Reused from the
 * dashboard "today" list, the appointments table and the calendar blocks so
 * clicking a booking never navigates away (DESIGN-DIRECTION §2.3 / §4.10).
 */
export function AppointmentDetailSheet({
  appointment: appointmentProp,
  open,
  onOpenChange,
}: AppointmentDetailSheetProps) {
  // Un solo profesional: la ficha de la cita no repite quién atiende.
  const soloUno = esSoloUnProfesional(useEquipo());
  // La cita llega como prop desde quien abrió el panel, y esa copia se queda
  // congelada: al cambiar el estado o marcar la confirmación del cliente, el
  // store se actualizaba pero aquí se seguía pintando el objeto viejo. Se lee
  // la versión viva del store y la prop queda solo como respaldo.
  const stored = useSalonStore((s) =>
    appointmentProp ? s.appointments.find((a) => a.id === appointmentProp.id) : undefined,
  );
  const appointment = stored ?? appointmentProp;

  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const markClientConfirmed = useSalonStore((s) => s.markClientConfirmed);
  const applyPenalty = useSalonStore((s) => s.applyPenalty);
  const markPaid = useSalonStore((s) => s.markPaid);
  const markDepositRequested = useSalonStore((s) => s.markDepositRequested);
  const markDepositReceived = useSalonStore((s) => s.markDepositReceived);
  const appointments = useSalonStore((s) => s.appointments);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur ?? 0);
  const noShowNoticeHours = useSalonStore((s) => s.salonProfile.noShowNoticeHours ?? 2);
  const depositEnabled = useSalonStore((s) => !!s.salonProfile.depositEnabled);
  const depositBizumPhone = useSalonStore((s) => s.salonProfile.depositBizumPhone ?? "");
  const depositAmountEur = useSalonStore((s) => s.salonProfile.depositAmountEur ?? 10);
  // El cliente puede no existir en la store (una cita creada desde la web
  // pública nace con un `clientId` de walk-in que no tiene ficha propia): sin
  // ficha no hay a quién marcar, así que la política de plantón se calla.
  const client = useSalonStore((s) =>
    appointmentProp ? s.clients.find((c) => c.id === appointmentProp.clientId) : undefined,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [penaltyReason, setPenaltyReason] = useState("");

  const policyActive = noShowFeeEur > 0 && !!client;

  function maybeAskPenalty() {
    if (!policyActive) return;
    setPenaltyReason("");
    setPenaltyOpen(true);
  }

  function handleApplyPenalty() {
    if (!client) return;
    applyPenalty(
      client.id,
      noShowFeeEur,
      penaltyReason.trim() ||
        `Plantón del ${new Date().toLocaleDateString("es", { day: "numeric", month: "short" })}`,
    );
    toast.success(`Penalización de ${eur(noShowFeeEur)} aplicada a ${client.name}`);
    setPenaltyOpen(false);
  }

  function handleForgivePenalty() {
    toast.success("Sin penalización — se lo has perdonado");
    setPenaltyOpen(false);
  }

  const serviceNames = appointment ? serviceNamesOf(appointment) : [];
  // Cuántas veces ha plantado este cliente en los últimos 3 meses, con las
  // mismas palabras que su ficha — ver lib/plantones.ts.
  const plantones = appointment ? noShowSummary(appointments, appointment.clientId) : null;
  // La fianza solo tiene sentido antes de confirmar y con el número puesto en
  // Ajustes: sin número, el mensaje pediría un Bizum a ningún sitio.
  const puedePedirFianza =
    !!appointment &&
    depositEnabled &&
    !!depositBizumPhone.trim() &&
    !!client?.phone &&
    (appointment.status === "pending" || !!appointment.depositRequestedAt);
  const start = appointment ? new Date(appointment.start) : null;
  // La cita puede llevar una duración que no está en la lista fija (suma de
  // varios servicios): se añade como opción propia para que el desplegable
  // siempre muestre el valor real en vez de quedarse en blanco.
  const durationOptions =
    appointment && !DURATION_OPTIONS_MIN.includes(appointment.duration)
      ? [...DURATION_OPTIONS_MIN, appointment.duration].sort((a, b) => a - b)
      : DURATION_OPTIONS_MIN;

  function handleDurationChange(minutes: number) {
    if (!appointment) return;
    updateAppointment(appointment.id, { duration: minutes });
    toast.success("Duración actualizada");
  }

  function handleTimeChange(time: string) {
    if (!appointment || !start || !time) return;
    const [hh, mm] = time.split(":").map(Number);
    const next = new Date(start);
    next.setHours(hh, mm, 0, 0);
    updateAppointment(appointment.id, { start: next.toISOString() });
    toast.success("Hora actualizada");
  }

  /**
   * Mover la cita a otro día. Antes solo se podía cambiar la hora dentro del
   * mismo día, así que pasar una cita al jueves obligaba a cancelarla y
   * volver a crearla entera — con su cliente, su servicio y su profesional.
   */
  function handleDateChange(fecha: string) {
    if (!appointment || !start || !fecha) return;
    const [yyyy, mm, dd] = fecha.split("-").map(Number);
    if (!yyyy || !mm || !dd) return;
    const next = new Date(start);
    next.setFullYear(yyyy, mm - 1, dd);
    updateAppointment(appointment.id, { start: next.toISOString() });
    toast.success("Cita movida", {
      description: next.toLocaleDateString("es", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    });
  }

  /** Cierre de caja: marcar cobrada eligiendo cómo, o desmarcarla. Aquí no se cobra nada. */
  function handlePago(metodo: PaymentMethod) {
    if (!appointment) return;
    const yaCobradaAsi = appointment.paidAt && appointment.paymentMethod === metodo;
    markPaid(appointment.id, yaCobradaAsi ? null : metodo);
    toast.success(
      yaCobradaAsi
        ? "Marcada como no cobrada"
        : `Cobrada en ${PAYMENT_METHOD_LABELS[metodo].toLowerCase()}`,
    );
  }

  /**
   * Fianza por Bizum: abre WhatsApp con el mensaje escrito y deja constancia
   * de que se ha pedido. No se envía nada solo y no hay pasarela de pago: el
   * Bizum llega al banco del salón y lo confirma una persona, abajo.
   */
  function handlePedirFianza() {
    if (!appointment) return;
    const telefono = client?.phone ?? "";
    if (!telefono) {
      toast.error("Esta cita no tiene teléfono al que escribir");
      return;
    }
    const url = enlaceDeFianza(telefono, {
      clientName: appointment.clientName,
      startISO: appointment.start,
      salonName,
      bizumPhone: depositBizumPhone,
      importeEur: depositAmountEur,
    });
    markDepositRequested(appointment.id, depositAmountEur);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleCancel() {
    if (!appointment) return;
    // Cancelar dentro del margen de aviso cuenta como plantón para Adam
    // ("The Best Shave & Barber"): igual que "No ha venido", se pregunta
    // antes de cobrar — nunca se aplica sola.
    const dentroDeAviso = isWithinNoticeWindow(appointment.start, noShowNoticeHours);
    cancelAppointment(appointment.id);
    toast.success("Cita cancelada", { description: appointment.clientName });
    setConfirmOpen(false);
    if (dentroDeAviso && policyActive) {
      maybeAskPenalty();
    } else {
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open && !!appointment} onOpenChange={onOpenChange}>
      {appointment && start && (
        <SheetContent className="flex flex-col gap-6 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{appointment.clientName}</SheetTitle>
            <SheetDescription>Detalle de la cita</SheetDescription>
          </SheetHeader>

          {/* "Quién atiende" con un solo profesional es el dueño del panel
              mirándose en el espejo: solo se enseña el estado de la cita. */}
          {soloUno ? (
            <div className="flex items-center">
              <StatusBadge status={appointment.status} />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <StylistAvatar
                name={employeeMap[appointment.employeeId].name}
                employeeId={appointment.employeeId}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {employeeMap[appointment.employeeId].name}
                </p>
                <p className="text-xs text-muted-foreground">Quién atiende</p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={appointment.status} />
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <span>
                {start.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}{" "}
                · {start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                {serviceNames.length > 1 ? (
                  <ul className="space-y-0.5">
                    {serviceNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <span>{serviceNames[0] ?? "Servicio"}</span>
                )}
                <p className="text-xs text-muted-foreground">
                  {appointment.duration} min{serviceNames.length > 1 ? " en total" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Euro className="size-4 text-muted-foreground" />
              <span>€{appointment.priceEur}</span>
            </div>
            {appointment.note && (
              <p className="border-t border-border/60 pt-3 text-muted-foreground">
                {appointment.note}
              </p>
            )}
          </div>

          {/* Plantones del cliente — solo si ha fallado alguna vez. Es el
              contexto que pidió Adam antes de decidir si le guarda el hueco. */}
          {plantones && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-sm">
              <TriangleAlert className="size-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
              <span>{plantones}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fecha, duración y hora
            </p>
            {/* La fecha va primero y a lo ancho: mover una cita a otro día era
                lo único que obligaba a cancelarla y rehacerla entera. */}
            <Input
              type="date"
              aria-label="Fecha de la cita"
              value={toDateInputValue(start)}
              onChange={(e) => handleDateChange(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={String(appointment.duration)}
                onValueChange={(v) => handleDurationChange(Number(v))}
              >
                <SelectTrigger aria-label="Duración de la cita">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((min) => (
                    <SelectItem key={min} value={String(min)}>
                      {min} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                aria-label="Hora de la cita"
                value={toTimeInputValue(start)}
                onChange={(e) => handleTimeChange(e.target.value)}
              />
            </div>
          </div>

          {/* Fianza por Bizum — solo con la política activa, número puesto en
              Ajustes y una cita que todavía está por confirmar. */}
          {puedePedirFianza && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Señal por Bizum
              </p>
              <Button variant="outline" className="w-full gap-2" onClick={handlePedirFianza}>
                <MessageCircle className="size-4" />
                Pedir {eur(depositAmountEur)} de señal por WhatsApp
              </Button>
              {appointment.depositRequestedAt && (
                <p className="text-xs text-muted-foreground">
                  Pedida el{" "}
                  {new Date(appointment.depositRequestedAt).toLocaleDateString("es", {
                    day: "numeric",
                    month: "short",
                  })}
                  .
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  markDepositReceived(appointment.id, !appointment.depositReceivedAt);
                  toast.success(
                    appointment.depositReceivedAt ? "Señal desmarcada" : "Señal recibida",
                  );
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  appointment.depositReceivedAt
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50",
                )}
              >
                <CheckCheck className="size-4 shrink-0" />
                {appointment.depositReceivedAt ? "Señal recibida" : "Marcar señal recibida"}
              </button>
              <p className="text-xs text-muted-foreground">
                Se abre tu WhatsApp con el mensaje escrito; lo envías tú. El Bizum llega a tu banco
                y lo marcas aquí a mano: siShow no cobra ni comprueba nada.
              </p>
            </div>
          )}

          {/* Cierre de caja — cómo se cobró esta cita. Sin pasarela de pago:
              esto es el cuaderno del mostrador, en digital. */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cobro
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const elegido = !!appointment.paidAt && appointment.paymentMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => handlePago(m)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      elegido
                        ? "border-success bg-success/10 font-medium text-success"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {appointment.paidAt
                ? `Cobrada el ${new Date(appointment.paidAt).toLocaleDateString("es", { day: "numeric", month: "short" })} · vuelve a pulsar para desmarcarla.`
                : "Marca cómo se ha cobrado y entrará en el cierre del día. No se procesa ningún pago."}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cambiar estado
            </p>
            <Select
              value={appointment.status}
              onValueChange={(v) => {
                updateAppointment(appointment.id, { status: v as AppointmentStatus });
                toast.success("Estado actualizado");
                if (v === "no-show") maybeAskPenalty();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Es el estado que llevas tú en la agenda.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Confirmación del cliente
            </p>
            <button
              type="button"
              onClick={() => {
                const yaConfirmada = !!appointment.clientConfirmedAt;
                markClientConfirmed(appointment.id, !yaConfirmada);
                toast.success(
                  yaConfirmada
                    ? "Marcada como no confirmada"
                    : "Marcada como confirmada por el cliente",
                );
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                appointment.clientConfirmedAt
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted/50",
              )}
            >
              <CheckCheck className="size-4 shrink-0" />
              {appointment.clientConfirmedAt ? (
                <span>
                  El cliente confirmó el{" "}
                  {new Date(appointment.clientConfirmedAt).toLocaleDateString("es", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              ) : (
                <span>El cliente aún no ha confirmado</span>
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              De momento se marca a mano. Cuando haya recordatorios, lo marcará el cliente al
              responder.
            </p>
          </div>

          <SheetFooter className="mt-auto">
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={appointment.status === "cancelled"}
                >
                  Cancelar cita
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se marcará como cancelada para {appointment.clientName}. Esta acción no se puede
                    deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sí, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SheetFooter>

          {/* Política de plantón: nunca se cobra sola. "No ha venido" y
              cancelar dentro del margen de aviso abren esta misma pregunta —
              el dueño decide en cada caso si la aplica o la perdona. */}
          <Dialog open={penaltyOpen} onOpenChange={setPenaltyOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>
                  ¿Aplicar la penalización de {eur(noShowFeeEur)} a {client?.name}?
                </DialogTitle>
                <DialogDescription>
                  No ha avisado con {noShowNoticeHours} h de antelación. Tú decides si se la cobras
                  o se la perdonas esta vez.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={penaltyReason}
                onChange={(e) => setPenaltyReason(e.target.value)}
                placeholder="Motivo (opcional)"
              />
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={handleForgivePenalty}>
                  Perdonar
                </Button>
                <Button onClick={handleApplyPenalty}>Aplicar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SheetContent>
      )}
    </Sheet>
  );
}
