import { VentanaCobrar } from "@/components/VentanaCobrar";
import { importeACobrar } from "@/lib/cobro-panel";
import { avisar, marcarAvisoDeCita } from "@/lib/deshacer-maqueta";
import { useEffect, useState } from "react";
import { SenalCita } from "@/components/SenalCita";
import { VentanaConfirmar } from "@/components/VentanaConfirmar";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "@/lib/appointment-status";
import { selectServiceMap, useSalonStore } from "@/lib/store";
import { recargoActivo } from "@/lib/recargo-activo";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { employeeMap } from "@/lib/mock/salon";
import { serviceNamesOf } from "@/lib/appointment-services";
import { isWithinNoticeWindow } from "@/lib/no-show";
import { historialDeFallos } from "@/lib/plantones";
import { necesitaDesenlace, type Desenlace } from "@/lib/deuda";
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
import { BandaDeuda } from "@/components/DeudaCliente";
import { DecisionDeudaDialog } from "@/components/DecisionDeudaDialog";
import { BotonesDesenlace, useAplicarDesenlace } from "@/components/CitasPorResolver";
import { Button } from "@/components/ui/button";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { DepositStatusControls } from "@/components/DepositStatusControls";
import { useMiEmployeeId, usePermisos } from "@/lib/accesos-panel";
import { puede, type AccionId } from "@/lib/permisos";
import { deadlineHours, depositDueAt } from "@/lib/deposit-deadline";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [formula, setFormula] = useState(appointment?.colorFormula ?? "");
  const [technicalNotes, setTechnicalNotes] = useState(appointment?.technicalNotes ?? "");
  useEffect(() => {
    setFormula(appointment?.colorFormula ?? "");
    setTechnicalNotes(appointment?.technicalNotes ?? "");
  }, [appointment?.id]);

  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const markClientConfirmed = useSalonStore((s) => s.markClientConfirmed);
  const markPaid = useSalonStore((s) => s.markPaid);
  const [cobrarAbierta, setCobrarAbierta] = useState(false);
  const pagos = useSalonStore((s) => s.payments);
  const pagosCita = appointment ? pagos.filter((p) => p.appointmentId === appointment.id) : [];
  // Lote 11: cada bloque solo si el rol puede hacerlo sobre ESTA cita (la suya, si es estilista).
  const permisos = usePermisos();
  const mio = useMiEmployeeId();
  const puedeEn = (accion: AccionId) => !!appointment && puede(permisos, accion, { employeeId: appointment.employeeId, miEmployeeId: mio });
  const appointments = useSalonStore((s) => s.appointments);
  const noShowNoticeHours = useSalonStore((s) => s.salonProfile.noShowNoticeHours ?? 2);
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const conRecargo = recargoActivo({ noShowFeeEur });
  const depositEnabled = useSalonStore((s) => !!s.salonProfile.depositEnabled);
  const depositBizumPhone = useSalonStore((s) => s.salonProfile.depositBizumPhone ?? "");
  // El cliente puede no existir en la store (una cita creada desde la web
  // pública nace con un `clientId` de walk-in que no tiene ficha propia): sin
  // ficha no hay a quién marcar, así que la política de plantón se calla.
  const client = useSalonStore((s) =>
    appointmentProp ? s.clients.find((c) => c.id === appointmentProp.clientId) : undefined,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  /**
   * Ventana de confirmar con previsualización (9f). Guarda su propia copia de
   * la cita porque el panel se cierra al abrirla: un panel modal no dejaría
   * usar una ventana que vive fuera de él.
   */
  const [aConfirmar, setAConfirmar] = useState<Appointment | null>(null);
  const abrirVentana = () => {
    if (!appointment) return;
    setAConfirmar(appointment);
    onOpenChange(false);
  };
  /** Qué desenlace ha elegido el dueño, mientras decide qué hace con el dinero. */
  const [decision, setDecision] = useState<Desenlace | null>(null);
  const aplicarDesenlace = useAplicarDesenlace();

  /**
   * Preguntar por el dinero solo con recargo activo y ficha a la que anotarlo.
   * El diálogo propone el importe y el dueño puede cambiarlo.
   */
  function preguntarPorLaDeuda(d: Desenlace) {
    if (!client || !conRecargo) return;
    setDecision(d);
  }

  /** Marca qué pasó con la cita y, si fue mal, pregunta qué hacer con el dinero. */
  function elegirDesenlace(d: Desenlace) {
    if (!appointment) return;
    aplicarDesenlace(appointment, d);
    if (conRecargo && d !== "vino") preguntarPorLaDeuda(d);
  }

  const carta = selectServiceMap(useSalonStore((s) => s.services));
  const serviceNames = appointment ? serviceNamesOf(appointment, carta) : [];
  // Cuántas veces ha plantado este cliente en los últimos 3 meses, con las
  // mismas palabras que su ficha — ver lib/plantones.ts.
  const plantones = appointment ? historialDeFallos(appointments, appointment.clientId) : null;
  // Una cita que ya terminó y sigue sin marcar: se pregunta aquí mismo.
  const porResolver = !!appointment && necesitaDesenlace(appointment);
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
  }

  function handleTimeChange(time: string) {
    if (!appointment || !start || !time) return;
    const [hh, mm] = time.split(":").map(Number);
    const next = new Date(start);
    next.setHours(hh, mm, 0, 0);
    updateAppointment(appointment.id, { start: next.toISOString() });
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
    // Lote 12: el aviso «Movida la cita de…» con «Deshacer» lo pone el registro de cambios.
    updateAppointment(appointment.id, { start: next.toISOString() });
  }

  /** Cierre de caja: marcar cobrada eligiendo cómo, o desmarcarla. Aquí no se cobra nada. */
  function handlePago(metodo: PaymentMethod) {
    if (!appointment) return;
    const yaCobradaAsi = appointment.paidAt && appointment.paymentMethod === metodo;
    markPaid(appointment.id, yaCobradaAsi ? null : metodo);
  }

  function handleCancel() {
    if (!appointment) return;
    // Cancelar dentro del margen de aviso cuenta como plantón para Adam
    // ("The Best Shave & Barber"): igual que "No ha venido", se pregunta
    // antes de cobrar — nunca se aplica sola.
    const dentroDeAviso = isWithinNoticeWindow(appointment.start, noShowNoticeHours);
    cancelAppointment(appointment.id);
    setConfirmOpen(false);
    if (conRecargo && dentroDeAviso && client) {
      preguntarPorLaDeuda("no-vino");
    } else {
      onOpenChange(false);
    }
  }

  return (
    <>
    <VentanaConfirmar cita={aConfirmar} onCerrar={() => setAConfirmar(null)} />
    <Sheet open={open && !!appointment} onOpenChange={onOpenChange}>
      {appointment && start && (
        <SheetContent panel="detalle-cita" className="flex flex-col gap-6 overflow-y-auto">
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
              <span>{eur(appointment.priceEur)}</span>
            </div>
            {appointment.note && (
              <p className="border-t border-border/60 pt-3 text-muted-foreground">
                {appointment.note}
              </p>
            )}
            <BookingAnswersSummary answers={appointment.bookingAnswers} />
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <p className="text-sm font-medium">Ficha técnica de esta visita</p>
            <label className="block space-y-1 text-xs font-medium">
              <span>Color / fórmula</span>
              <Input value={formula} onChange={(e) => setFormula(e.target.value)} onBlur={() => {
                if (formula.trim() !== (appointment.colorFormula ?? "")) updateAppointment(appointment.id, { colorFormula: formula.trim() });
              }} placeholder="7.1 + 8.0 al 50 %, oxidante 20 vol, 35 min" />
            </label>
            <label className="block space-y-1 text-xs font-medium">
              <span>Notas técnicas</span>
              <Textarea value={technicalNotes} onChange={(e) => setTechnicalNotes(e.target.value)} onBlur={() => {
                if (technicalNotes.trim() !== (appointment.technicalNotes ?? "")) updateAppointment(appointment.id, { technicalNotes: technicalNotes.trim() });
              }} rows={2} placeholder="Aplicación, mezcla o indicaciones para la próxima visita" />
            </label>
          </div>

          {/* Lo que debe, con las tres salidas al lado. Va arriba a propósito:
              el momento de cobrar una deuda vieja es cuando la persona está
              delante, y eso pasa justo aquí. */}
          {conRecargo && <BandaDeuda client={client} compacta />}

          {/* La pregunta, en el sitio donde ocurre: esta cita ya pasó y nadie
              ha dicho si la persona apareció. */}
          {porResolver && (
            <div className="space-y-2 rounded-xl border border-[var(--warning)]/50 bg-[var(--warning)]/10 p-4">
              <p className="text-sm font-medium">¿Qué pasó con esta cita?</p>
              <BotonesDesenlace actual={appointment.status} onElegir={elegirDesenlace} />
              {conRecargo && (
                <p className="text-xs text-muted-foreground">
                  Si te quedó a deber, te lo pregunto justo después.
                </p>
              )}
            </div>
          )}

          {/* Plantones del cliente — solo si ha fallado alguna vez. Es el
              contexto que pidió Adam antes de decidir si le guarda el hueco. */}
          {plantones && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-sm">
              <TriangleAlert className="size-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
              <span>{plantones}</span>
            </div>
          )}

          {/* Recargo pendiente de cobrar — se enseña siempre que exista, y
              sobre todo al confirmar una solicitud: es lo que Adam necesita
              ver antes de decidir si le guarda el hueco a quien todavía le
              debe una penalización. */}
          {conRecargo && (client?.penaltyEur ?? 0) > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Este cliente tiene un recargo pendiente de {eur(client!.penaltyEur ?? 0)}
                {appointment.status === "pending" ? " — decide si le confirmas la cita." : "."}
              </span>
            </div>
          )}

          {appointment.status === "pending" && (
            <Button onClick={abrirVentana} className="self-start">
              Confirmar cita…
            </Button>
          )}

          {(puedeEn("cita.mover") || puedeEn("cita.editar")) && <div className="space-y-1.5">
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
          </div>}

          {/* Señal (9j): estado del ciclo y sus acciones, según la regla de Ajustes. */}
          {puedeEn("senal.gestionar") && <SenalCita key={appointment.id} cita={appointment} />}

          {/* Cierre de caja — cómo se cobró esta cita. Sin pasarela de pago:
              esto es el cuaderno del mostrador, en digital. */}
          {!puedeEn("cita.cobrar") ? (
            <p className="rounded-xl border border-lino bg-superficie px-3 py-2 text-[13px] text-cafe-medio">Cobro: lo marca quien atiende la cita.</p>
          ) : <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cobro
            </p>
            {/* 14b: se cobra en la ventana «Cobrar» (importe real, forma de pago, propina). */}
            {pagosCita.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-lino bg-superficie px-3 py-2 text-[13px] tabular-nums">
                {pagosCita.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>{p.concepto === "senal" ? "Señal" : p.concepto === "propina" ? "Propina" : "Servicio"} · {PAYMENT_METHOD_LABELS[p.metodo].toLowerCase()}</span>
                    <b>{p.importeEur.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €</b>
                  </li>
                ))}
              </ul>
            )}
            {appointment.paidAt ? (
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                Cobrada el {new Date(appointment.paidAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                {appointment.paymentMethod ? ` en ${PAYMENT_METHOD_LABELS[appointment.paymentMethod].toLowerCase()}` : ""}.
                <button type="button" className="font-bold text-hoja-tinta hover:underline" onClick={() => setCobrarAbierta(true)}>
                  Añadir un pago
                </button>
              </p>
            ) : (
              <Button className="w-full rounded-full font-bold" onClick={() => setCobrarAbierta(true)}>
                Cobrar {importeACobrar(appointment).toLocaleString("es-ES", { maximumFractionDigits: 2 })} €
              </Button>
            )}
            <VentanaCobrar cita={appointment} abierta={cobrarAbierta} onCerrar={() => setCobrarAbierta(false)} />
          </div>}

          {(puedeEn("cita.marcar-asistencia") || puedeEn("cita.editar")) && <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cambiar estado
            </p>
            <Select
              value={appointment.status}
              onValueChange={(v) => {
                // Confirmar una solicitud pasa por la ventana con la ficha (9f).
                if (appointment.status === "pending" && v === "confirmed") return abrirVentana();
                updateAppointment(appointment.id, { status: v as AppointmentStatus });
                if (conRecargo && v === "no-show") preguntarPorLaDeuda("no-vino");
                if (conRecargo && v === "late") preguntarPorLaDeuda("tarde");
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
          </div>}

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Confirmación del cliente
            </p>
            <button
              type="button"
              onClick={() => {
                const yaConfirmada = !!appointment.clientConfirmedAt;
                markClientConfirmed(appointment.id, !yaConfirmada);
                const nombre = appointment.clientName.split(" ")[0];
                avisar(yaConfirmada ? `${nombre}: sin confirmar` : `${nombre} ha confirmado`, () => markClientConfirmed(appointment.id, yaConfirmada));
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
                <span>La clienta aún no ha confirmado</span>
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              De momento se marca a mano. Cuando haya recordatorios, lo marcará el cliente al
              responder.
            </p>
          </div>

          {puedeEn("cita.cancelar") && <SheetFooter className="mt-auto">
            {/* Lote 12: sin «¿Seguro?»: se cancela al momento y se deshace desde el aviso o el historial. */}
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              disabled={appointment.status === "cancelled"}
              onClick={handleCancel}
            >
              Cancelar cita
            </Button>
          </SheetFooter>}

          {/* Las tres decisiones de Adam sobre el dinero: anotarla, perdonarla
              o bloquear. Nunca se aplica ninguna sola, y todas se deshacen. */}
          <DecisionDeudaDialog
            client={client}
            cita={appointment}
            desenlace={decision ?? "no-vino"}
            open={!!decision}
            onOpenChange={(o) => !o && setDecision(null)}
          />
        </SheetContent>
      )}
    </Sheet>
    </>
  );
}
