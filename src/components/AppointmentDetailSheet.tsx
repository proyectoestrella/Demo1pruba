import { VentanaCobrar } from "@/components/VentanaCobrar";
import { importeACobrar } from "@/lib/cobro-panel";
import { avisar, marcarAvisoDeCita } from "@/lib/deshacer-maqueta";
import { cambiarDuracionElegida } from "@/lib/duracion-flexible";
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
import { importeSenalTexto } from "@/lib/senal";
import {
  PAYMENT_METHOD_LABELS,
  type Appointment,
  type AppointmentStatus,
  type PaymentMethod,
} from "@/lib/mock/types";
import { AvatarClienta, AvatarProfesional } from "@/components/Avatar";
import { FichaContenedor } from "@/components/FichaContenedor";
import { Desplegable } from "@/components/Desplegable";
import { useFichas } from "@/lib/use-fichas";
import { StatusBadge } from "@/components/StatusBadge";
import { BandaDeuda } from "@/components/DeudaCliente";
import { DecisionDeudaDialog } from "@/components/DecisionDeudaDialog";
import { BotonesDesenlace, useAplicarDesenlace, useMarcarEnCurso } from "@/components/CitasPorResolver";
import { Button } from "@/components/ui/button";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { DepositStatusControls } from "@/components/DepositStatusControls";
import { useMiEmployeeId, usePermisos } from "@/lib/accesos-panel";
import { puede, type AccionId } from "@/lib/permisos";
import { deadlineHours, depositDueAt } from "@/lib/deposit-deadline";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { CalendarClock, CheckCheck, ChevronRight, Euro, TriangleAlert } from "lucide-react";

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
  const [panelAbierto, setPanelAbierto] = useState<"mover" | "fianza" | null>(null);
  useEffect(() => setPanelAbierto(null), [appointment?.id]);
  const { abrirClienta, puedeVolver, volver } = useFichas();
  const pagos = useSalonStore((s) => s.payments);
  const pagosCita = appointment ? pagos.filter((p) => p.appointmentId === appointment.id) : [];
  // Lote 11: cada bloque solo si el rol puede hacerlo sobre ESTA cita (la suya, si es estilista).
  const permisos = usePermisos();
  const mio = useMiEmployeeId();
  const puedeEn = (accion: AccionId) =>
    !!appointment &&
    puede(permisos, accion, { employeeId: appointment.employeeId, miEmployeeId: mio });
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
  const marcarEnCurso = useMarcarEnCurso();

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

  function handleDurationChange(valor: string) {
    if (!appointment) return;
    cambiarDuracionElegida(valor, (duration) => updateAppointment(appointment.id, { duration }));
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

  const profesional = appointment ? employeeMap[appointment.employeeId] : undefined;
  const variablePro = profesional?.colorVar
    ? profesional.colorVar.startsWith("--")
      ? profesional.colorVar
      : `--${profesional.colorVar}`
    : "--arena";
  const ahoraMs = Date.now();
  const iniMs = start ? +start : 0;
  const finMs = appointment ? iniMs + appointment.duration * 60_000 : 0;
  const esAhora =
    !!appointment && appointment.status !== "cancelled" && iniMs <= ahoraMs && ahoraMs < finMs;
  const esHoy = !!start && toDateInputValue(start) === toDateInputValue(new Date());
  const horaDe = (d: Date) => d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const fin = appointment ? new Date(finMs) : null;
  const pagada = !!appointment?.paidAt;

  return (
    <>
      <VentanaConfirmar cita={aConfirmar} onCerrar={() => setAConfirmar(null)} />
      <FichaContenedor
        tipo="cita"
        open={open && !!appointment}
        onOpenChange={onOpenChange}
        titulo={`Cita de ${appointment?.clientName ?? ""}`}
        descripcion="Hora, servicio, profesional, estado y acciones de la cita."
        onVolver={puedeVolver ? volver : undefined}
      >
        {appointment && start && fin && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* Cabecera de EVENTO: hora grande y barra del color de la profesional.
                Nada de círculos aquí: el círculo es de las personas. */}
              <header
                className="border-l-[6px] px-5 py-5 sm:px-7 sm:py-6"
                style={{
                  backgroundColor: `var(${variablePro})`,
                  borderLeftColor: `color-mix(in srgb, var(${variablePro}) 35%, var(--cafe-medio))`,
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[36px] leading-none font-extrabold tracking-tight text-cafe tabular-nums sm:text-[40px]">
                    {horaDe(start)}
                  </p>
                  <p className="self-end pb-0.5 text-[14px] font-bold text-cafe-medio tabular-nums">
                    a las {horaDe(fin)} · {appointment.duration} min
                  </p>
                  <span className="ml-auto">
                    <StatusBadge status={appointment.status} />
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] font-bold text-cafe-medio">
                  <span className="first-letter:uppercase">
                    {start.toLocaleDateString("es", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                  {esAhora ? (
                    <span className="rounded-full bg-terracota px-2.5 py-0.5 text-[12px] font-extrabold text-white">
                      Ahora
                    </span>
                  ) : esHoy ? (
                    <span className="rounded-full border border-terracota px-2.5 py-0.5 text-[12px] font-extrabold text-terracota">
                      Hoy
                    </span>
                  ) : null}
                </p>
                <p className="mt-3 text-[20px] leading-snug font-extrabold text-cafe">
                  {serviceNames.length ? serviceNames.join(" + ") : "Servicio"}
                </p>
                {/* "Quién atiende" con un solo profesional es el dueño mirándose
                  en el espejo: solo se enseña si hay equipo. */}
                {!soloUno && profesional && (
                  <p className="mt-2 flex items-center gap-2 text-[13.5px] font-bold text-cafe-medio">
                    <AvatarProfesional
                      id={appointment.employeeId}
                      nombre={profesional.name}
                      size="xs"
                    />
                    Atiende {profesional.name}
                  </p>
                )}
              </header>

              <div className="space-y-6 px-5 pt-5 pb-7 sm:px-7 sm:pt-7 sm:pb-8">
                {/* La clienta: avatar, nombre y enlace a su ficha. */}
                {client ? (
                  <button
                    type="button"
                    onClick={() => abrirClienta(client.id)}
                    aria-label={`Abrir la ficha de ${client.name}`}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left hover:bg-nata focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <AvatarClienta id={client.id} nombre={client.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[19px] leading-tight font-medium">
                        {client.name}
                      </span>
                      {client.phone && (
                        <span className="block text-[12.5px] text-muted-foreground tabular-nums">
                          {client.phone}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-bold text-cafe-medio">
                      Ver ficha{" "}
                      <ChevronRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
                    <AvatarClienta nombre={appointment.clientName} size="md" />
                    <span className="truncate font-display text-[19px] leading-tight font-medium">
                      {appointment.clientName}
                    </span>
                  </div>
                )}

                {(appointment.note || appointment.bookingAnswers) && (
                  <div className="space-y-1 text-[13.5px] text-cafe-medio">
                    {appointment.note && <p>{appointment.note}</p>}
                    <BookingAnswersSummary answers={appointment.bookingAnswers} />
                  </div>
                )}

                {/* Lo que debe, con las tres salidas al lado. Va arriba a propósito:
                  el momento de cobrar una deuda vieja es cuando la persona está
                  delante, y eso pasa justo aquí. */}
                {conRecargo && <BandaDeuda client={client} compacta />}

                {/* La pregunta, en el sitio donde ocurre: esta cita ya pasó y nadie
                  ha dicho si la persona apareció. */}
                {porResolver && (
                  <div className="space-y-2 rounded-xl border border-[var(--warning)]/50 bg-[var(--warning)]/10 p-4">
                    <p className="text-sm font-medium">¿Qué pasó con esta cita?</p>
                    <BotonesDesenlace
                      actual={appointment.status}
                      onMarcarEnCurso={() => marcarEnCurso(appointment)}
                      onElegir={elegirDesenlace}
                    />
                    {conRecargo && (
                      <p className="text-xs text-muted-foreground">
                        Si te quedó a deber, te lo pregunto justo después.
                      </p>
                    )}
                  </div>
                )}

                {/* Plantones del cliente: contexto antes de decidir si le guarda el hueco. */}
                {plantones && (
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-sm">
                    <TriangleAlert
                      className="size-4 shrink-0 text-[var(--warning)]"
                      aria-hidden="true"
                    />
                    <span>{plantones}</span>
                  </div>
                )}

                {/* Recargo pendiente: lo que hay que ver antes de confirmar. */}
                {conRecargo && (client?.penaltyEur ?? 0) > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Este cliente tiene un recargo pendiente de {eur(client!.penaltyEur ?? 0)}
                      {appointment.status === "pending"
                        ? " — decide si le confirmas la cita."
                        : "."}
                    </span>
                  </div>
                )}

                {/* UNA acción primaria: confirmar si es solicitud; si no, cobrar. */}
                {appointment.status === "pending" ? (
                  <Button onClick={abrirVentana} className="h-11 w-full rounded-full font-bold">
                    Confirmar cita…
                  </Button>
                ) : puedeEn("cita.cobrar") && !pagada ? (
                  <Button
                    className="h-11 w-full rounded-full font-bold"
                    onClick={() => setCobrarAbierta(true)}
                  >
                    Cobrar{" "}
                    {importeACobrar(appointment).toLocaleString("es-ES", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </Button>
                ) : null}

                {/* Acciones secundarias: abren su apartado debajo. */}
                {(puedeEn("cita.mover") ||
                  puedeEn("cita.editar") ||
                  puedeEn("senal.gestionar")) && (
                  <div className="flex flex-wrap gap-2">
                    {(puedeEn("cita.mover") || puedeEn("cita.editar")) && (
                      <button
                        type="button"
                        aria-expanded={panelAbierto === "mover"}
                        onClick={() => setPanelAbierto((p) => (p === "mover" ? null : "mover"))}
                        className={accionSecundaria(panelAbierto === "mover")}
                      >
                        <CalendarClock className="size-[15px]" strokeWidth={1.6} /> Mover
                      </button>
                    )}
                    {puedeEn("senal.gestionar") && (
                      <button
                        type="button"
                        aria-expanded={panelAbierto === "fianza"}
                        onClick={() => setPanelAbierto((p) => (p === "fianza" ? null : "fianza"))}
                        className={accionSecundaria(panelAbierto === "fianza")}
                      >
                        <Euro className="size-[15px]" strokeWidth={1.6} /> Fianza
                      </button>
                    )}
                  </div>
                )}

                {panelAbierto === "mover" && (puedeEn("cita.mover") || puedeEn("cita.editar")) && (
                  <div className="space-y-2 rounded-2xl bg-nata/60 p-3.5">
                    <p className="text-[12.5px] font-bold text-cafe-medio">
                      Fecha, duración y hora
                    </p>
                    {/* La fecha va primero y a lo ancho: mover una cita a otro día era
                      lo único que obligaba a cancelarla y rehacerla entera. */}
                    <Input
                      type="date"
                      aria-label="Fecha de la cita"
                      value={toDateInputValue(start)}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="bg-card"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={String(appointment.duration)}
                        onValueChange={handleDurationChange}
                      >
                        <SelectTrigger aria-label="Duración de la cita" className="bg-card">
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
                        className="bg-card"
                      />
                    </div>
                  </div>
                )}

                {/* Señal (9j): estado del ciclo y sus acciones, según la regla de Ajustes. */}
                {panelAbierto === "fianza" && puedeEn("senal.gestionar") && (
                  <SenalCita key={appointment.id} cita={appointment} />
                )}

                {/* Lo demás, plegado y con su resumen. */}
                <div className="-mb-2">
                  {!puedeEn("cita.cobrar") ? (
                    <p className="rounded-xl border border-lino bg-superficie px-3 py-2 text-[13px] text-cafe-medio">
                      Cobro: lo marca quien atiende la cita.
                    </p>
                  ) : (
                    <Desplegable
                      titulo="Cobro"
                      resumen={
                        pagada
                          ? `Cobrada${appointment.paymentMethod ? ` en ${PAYMENT_METHOD_LABELS[appointment.paymentMethod].toLowerCase()}` : ""}`
                          : `Pendiente · ${eur(appointment.priceEur)}`
                      }
                    >
                      <div className="space-y-2">
                        {/* 14b: se cobra en la ventana «Cobrar» (importe real, forma de pago, propina). */}
                        {pagosCita.length > 0 && (
                          <ul className="space-y-1 rounded-xl border border-lino bg-superficie px-3 py-2 text-[13px] tabular-nums">
                            {pagosCita.map((p) => (
                              <li key={p.id} className="flex justify-between gap-2">
                                <span>
                                  {p.concepto === "senal"
                                    ? "Señal"
                                    : p.concepto === "propina"
                                      ? "Propina"
                                      : "Servicio"}{" "}
                                  · {PAYMENT_METHOD_LABELS[p.metodo].toLowerCase()}
                                </span>
                                <b>
                                  {p.concepto === "senal"
                                    ? importeSenalTexto(p.importeEur)
                                    : `${p.importeEur.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`}
                                </b>
                              </li>
                            ))}
                          </ul>
                        )}
                        {pagada ? (
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            Cobrada el{" "}
                            {new Date(appointment.paidAt!).toLocaleDateString("es", {
                              day: "numeric",
                              month: "short",
                            })}
                            {appointment.paymentMethod
                              ? ` en ${PAYMENT_METHOD_LABELS[appointment.paymentMethod].toLowerCase()}`
                              : ""}
                            .
                            <button
                              type="button"
                              className="font-bold text-hoja-tinta hover:underline"
                              onClick={() => setCobrarAbierta(true)}
                            >
                              Añadir un pago
                            </button>
                          </p>
                        ) : appointment.status === "pending" ? (
                          <Button
                            variant="outline"
                            className="w-full rounded-full font-bold"
                            onClick={() => setCobrarAbierta(true)}
                          >
                            Cobrar{" "}
                            {importeACobrar(appointment).toLocaleString("es-ES", {
                              maximumFractionDigits: 2,
                            })}{" "}
                            €
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sin cobrar todavía.</p>
                        )}
                      </div>
                    </Desplegable>
                  )}
                  <VentanaCobrar
                    cita={appointment}
                    abierta={cobrarAbierta}
                    onCerrar={() => setCobrarAbierta(false)}
                  />

                  <Desplegable
                    titulo="Ficha técnica de esta visita"
                    resumen={
                      appointment.colorFormula ||
                      appointment.technicalNotes ||
                      "Color, fórmula y notas técnicas"
                    }
                  >
                    <div className="space-y-3">
                      <label className="block space-y-1 text-xs font-medium">
                        <span>Color / fórmula</span>
                        <Input
                          value={formula}
                          onChange={(e) => setFormula(e.target.value)}
                          onBlur={() => {
                            if (formula.trim() !== (appointment.colorFormula ?? ""))
                              updateAppointment(appointment.id, { colorFormula: formula.trim() });
                          }}
                          placeholder="7.1 + 8.0 al 50 %, oxidante 20 vol, 35 min"
                        />
                      </label>
                      <label className="block space-y-1 text-xs font-medium">
                        <span>Notas técnicas</span>
                        <Textarea
                          value={technicalNotes}
                          onChange={(e) => setTechnicalNotes(e.target.value)}
                          onBlur={() => {
                            if (technicalNotes.trim() !== (appointment.technicalNotes ?? ""))
                              updateAppointment(appointment.id, {
                                technicalNotes: technicalNotes.trim(),
                              });
                          }}
                          rows={2}
                          placeholder="Aplicación, mezcla o indicaciones para la próxima visita"
                        />
                      </label>
                    </div>
                  </Desplegable>

                  <Desplegable
                    titulo="Estado y confirmación de la clienta"
                    resumen={`${STATUS_OPTIONS.find((o) => o.value === appointment.status)?.label ?? ""} · ${appointment.clientConfirmedAt ? "confirmó ella" : "sin confirmar por ella"}`}
                  >
                    <div className="space-y-4">
                      {(puedeEn("cita.marcar-asistencia") || puedeEn("cita.editar")) && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Cambiar estado
                          </p>
                          <Select
                            value={appointment.status}
                            onValueChange={(v) => {
                              // Confirmar una solicitud pasa por la ventana con la ficha (9f).
                              if (appointment.status === "pending" && v === "confirmed")
                                return abrirVentana();
                              updateAppointment(appointment.id, { status: v as AppointmentStatus });
                              if (conRecargo && v === "no-show") preguntarPorLaDeuda("no-vino");
                              if (conRecargo && v === "late") preguntarPorLaDeuda("tarde");
                            }}
                          >
                            <SelectTrigger aria-label="Estado de la cita">
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
                      )}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Confirmación de la clienta
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const yaConfirmada = !!appointment.clientConfirmedAt;
                            markClientConfirmed(appointment.id, !yaConfirmada);
                            const nombre = appointment.clientName.split(" ")[0];
                            avisar(
                              yaConfirmada ? `${nombre}: sin confirmar` : `${nombre} ha confirmado`,
                              () => markClientConfirmed(appointment.id, yaConfirmada),
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
                            <span>La clienta aún no ha confirmado</span>
                          )}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          De momento se marca a mano. Cuando haya recordatorios, lo marcará el
                          cliente al responder.
                        </p>
                      </div>
                    </div>
                  </Desplegable>
                </div>
              </div>
            </div>

            {puedeEn("cita.cancelar") && (
              <footer className="shrink-0 border-t border-border bg-perla px-5 py-3 sm:px-7 sm:py-4">
                {/* Lote 12: sin «¿Seguro?»: se cancela al momento y se deshace desde el aviso o el historial. */}
                <Button
                  variant="ghost"
                  className="h-11 w-full rounded-full font-bold text-[#B3261E] hover:bg-[#B3261E]/10 hover:text-[#B3261E]"
                  disabled={appointment.status === "cancelled"}
                  onClick={handleCancel}
                >
                  Cancelar cita
                </Button>
              </footer>
            )}

            {/* Las tres decisiones de Adam sobre el dinero: anotarla, perdonarla
              o bloquear. Nunca se aplica ninguna sola, y todas se deshacen. */}
            <DecisionDeudaDialog
              client={client}
              cita={appointment}
              desenlace={decision ?? "no-vino"}
              open={!!decision}
              onOpenChange={(o) => !o && setDecision(null)}
            />
          </>
        )}
      </FichaContenedor>
    </>
  );
}

function accionSecundaria(activa: boolean) {
  return cn(
    "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
    activa ? "border-moca bg-nata text-cafe" : "border-input bg-card text-cafe-medio hover:bg-nata",
  );
}
