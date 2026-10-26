import { VentanaCobrar } from "@/components/VentanaCobrar";
import { duracionDeClienta } from "@/lib/derive";
import { importeACobrar } from "@/lib/cobro-panel";
import { avisar, conCambio, deshacerConAviso, marcarAvisoDeCita } from "@/lib/deshacer-maqueta";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SenalCita } from "@/components/SenalCita";
import { VentanaConfirmar } from "@/components/VentanaConfirmar";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "@/lib/appointment-status";
import { selectServiceMap, useSalonStore } from "@/lib/store";
import { recargoActivo } from "@/lib/recargo-activo";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { employeeMap } from "@/lib/mock/salon";
import { lavadoDe, serviceNamesOf, sumServices } from "@/lib/appointment-services";
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
import { CheckCheck, ChevronRight, Euro, Pencil, TriangleAlert } from "lucide-react";
import { fechaEnZona, horaEnZona, isoDelSalon, zonaDelSalon } from "@/lib/zona-horaria";
import { solapaConAgenda } from "@/lib/solape";
import { avisoHorarioSalon, type AvisoHorarioSalon } from "@/lib/horario-salon";
import { DialogoHorarioSalon, DialogoSolape } from "@/components/NewAppointmentDialog";

/** Duraciones que puede elegir el salón al ajustar una cita, en minutos. */
const DURATION_OPTIONS_MIN = [15, 30, 45, 60, 90, 120, 150, 180];

interface BorradorCita {
  serviceIds: string[];
  employeeId: string;
  duration: number;
  date: string;
  time: string;
  priceEur: number;
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
  const equipo = useEquipo();
  const soloUno = esSoloUnProfesional(equipo);
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
  const [panelAbierto, setPanelAbierto] = useState<"editar" | "fianza" | null>(null);
  const [borrador, setBorrador] = useState<BorradorCita | null>(null);
  const [confirmarHorario, setConfirmarHorario] = useState<{
    aviso: AvisoHorarioSalon;
    patch: Partial<Appointment>;
  } | null>(null);
  const [confirmarSolape, setConfirmarSolape] = useState<{
    choques: Appointment[];
    patch: Partial<Appointment>;
  } | null>(null);
  useEffect(() => {
    setPanelAbierto(null);
    setBorrador(null);
    setConfirmarHorario(null);
    setConfirmarSolape(null);
  }, [appointment?.id]);
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

  const services = useSalonStore((s) => s.services);
  const profile = useSalonStore((s) => s.salonProfile);
  const zonaHoraria = zonaDelSalon(profile);
  const carta = selectServiceMap(services);
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
  const durationOptions = [
    ...new Set([...DURATION_OPTIONS_MIN, borrador?.duration ?? 0].filter((min) => min > 0)),
  ].sort((a, b) => a - b);

  function abrirEditor() {
    if (!appointment) return;
    setBorrador({
      serviceIds: [...appointment.serviceIds],
      employeeId: appointment.employeeId,
      duration: appointment.duration,
      date: fechaEnZona(appointment.start, zonaHoraria),
      time: horaEnZona(appointment.start, zonaHoraria),
      priceEur: appointment.priceEur,
    });
    setPanelAbierto("editar");
  }

  function alternarServicio(id: string) {
    setBorrador((actual) => {
      if (!actual) return actual;
      const serviceIds = actual.serviceIds.includes(id)
        ? actual.serviceIds.filter((serviceId) => serviceId !== id)
        : [...actual.serviceIds, id];
      const elegidos = serviceIds.map((serviceId) => carta[serviceId]).filter(Boolean);
      const suma = sumServices(elegidos, lavadoDe(profile, services));
      // 26-oct: con «Su tiempo» de la clienta, se propone su duración, no la de la carta.
      const suya = appointment
        ? duracionDeClienta(profile.duracionClientas, appointment.clientId, serviceIds, Object.fromEntries(services.map((x) => [x.id, x.durationMin])))
        : null;
      return {
        ...actual,
        serviceIds,
        duration: suya?.minutos || suma.durationMin || actual.duration,
        priceEur: elegidos.length === serviceIds.length ? suma.priceEur : actual.priceEur,
      };
    });
  }

  function guardarEdicion(patch: Partial<Appointment>, permitirSolape = false) {
    if (!appointment) return;
    const { cambio } = conCambio(() =>
      updateAppointment(appointment.id, patch, permitirSolape ? { permitirSolape: true } : undefined),
    );
    if (cambio) {
      avisar("Cita actualizada", () => deshacerConAviso(cambio.id), cambio.id);
    }
    setPanelAbierto(null);
    setBorrador(null);
  }

  function comprobarSolapeEdicion(patch: Partial<Appointment>) {
    if (!appointment) return;
    const siguiente = { ...appointment, ...patch };
    const choques = solapaConAgenda(
      appointments,
      {
        employeeId: siguiente.employeeId,
        start: siguiente.start,
        duration: siguiente.duration,
        serviceIds: siguiente.serviceIds,
        excluirId: appointment.id,
      },
      { servicios: carta, perfil: profile },
    );
    if (choques.length) {
      setConfirmarSolape({ choques, patch });
      return;
    }
    guardarEdicion(patch);
  }

  function intentarGuardarEdicion() {
    if (!appointment || !borrador) return;
    if (!borrador.serviceIds.length) {
      toast.error("Elige al menos un servicio");
      return;
    }
    if (!borrador.date || !borrador.time || borrador.duration <= 0) {
      toast.error("Elige una fecha, una hora y una duración válidas");
      return;
    }
    const patch: Partial<Appointment> = {
      serviceIds: borrador.serviceIds,
      employeeId: borrador.employeeId,
      duration: borrador.duration,
      start: isoDelSalon(borrador.date, borrador.time, zonaHoraria),
      priceEur: borrador.priceEur,
    };
    const aviso = avisoHorarioSalon({
      openingHours: profile.openingHours,
      diasEspeciales: profile.diasEspeciales,
      fecha: borrador.date,
      hora: borrador.time,
      duracionMin: borrador.duration,
    });
    if (aviso) {
      setConfirmarHorario({ aviso, patch });
      return;
    }
    comprobarSolapeEdicion(patch);
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
            <div className="detalle-cita min-h-0 flex-1 overflow-y-auto bg-background">
              {/* Resumen de la cita: fecha, horario y servicio, en ese orden. */}
              <header
                className="m-4 mb-0 rounded-[24px] bg-card px-5 py-5 shadow-[0_6px_20px_-8px_rgba(59,47,42,0.18)] sm:mx-5"
              >
                <p className="mb-3 flex flex-wrap items-center gap-2 text-[14px] font-bold text-cafe-medio">
                  <span className="first-letter:uppercase">
                    {start.toLocaleDateString("es", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                  {esAhora ? (
                    <span className="rounded-full bg-nata px-2.5 py-0.5 text-[12px] font-bold text-cafe-medio">
                      Ahora
                    </span>
                  ) : esHoy ? (
                    <span className="rounded-full bg-nata px-2.5 py-0.5 text-[12px] font-bold text-cafe-medio">
                      Hoy
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[30px] leading-none font-extrabold tracking-tight text-cafe tabular-nums sm:text-[34px]">
                    {horaDe(start)}
                  </p>
                  <p className="self-end pb-0.5 text-[14px] font-bold text-cafe-medio tabular-nums">
                    – {horaDe(fin)}
                  </p>
                  <span className="ml-auto">
                    <StatusBadge status={appointment.status} />
                  </span>
                </div>
                <p className="mt-3 text-[17px] leading-snug font-bold text-cafe">
                  {serviceNames.length ? serviceNames.join(" + ") : "Servicio"}
                </p>
                <p className="mt-1 text-xs font-medium text-cafe-medio tabular-nums">{appointment.duration} minutos</p>
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

              <div className="space-y-4 px-[var(--gutter)] pt-[var(--gutter)] pb-[calc(var(--gutter)+var(--seguro-abajo))]">
                {puedeEn("cita.editar") && (
                  <Button
                    type="button"
                    className="min-h-12 w-full rounded-full text-[15px] font-extrabold"
                    aria-expanded={panelAbierto === "editar"}
                    onClick={() => {
                      if (panelAbierto === "editar") {
                        setPanelAbierto(null);
                        setBorrador(null);
                      } else abrirEditor();
                    }}
                  >
                    <Pencil className="size-[18px]" strokeWidth={1.7} />
                    Editar cita
                  </Button>
                )}

                {panelAbierto === "editar" && borrador && puedeEn("cita.editar") && (
                  <section className="space-y-4 rounded-2xl border border-lino bg-card p-4" aria-label="Editar cita">
                    <div>
                      <h3 className="text-base font-extrabold text-cafe">Editar cita</h3>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">Cambia los datos y guarda todo de una vez.</p>
                    </div>
                    {!soloUno && (
                      <label className="grid gap-1.5 text-[12.5px] font-bold text-cafe-medio">
                        Profesional
                        <Select value={borrador.employeeId} onValueChange={(employeeId) => setBorrador({ ...borrador, employeeId })}>
                          <SelectTrigger aria-label="Profesional de la cita" className="min-h-11 bg-blanco"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {equipo.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </label>
                    )}
                    <fieldset className="space-y-2">
                      <legend className="text-[12.5px] font-bold text-cafe-medio">Servicios</legend>
                      <SelectorServiciosEdicion
                        seleccionados={borrador.serviceIds}
                        services={services}
                        nombre={(id) => serviceNamesOf({ serviceIds: [id] }, carta)[0]}
                        alternar={alternarServicio}
                      />
                    </fieldset>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1.5 text-[12.5px] font-bold text-cafe-medio">
                        Fecha
                        <Input type="date" aria-label="Fecha de la cita" value={borrador.date} onChange={(e) => setBorrador({ ...borrador, date: e.target.value })} className="min-h-11 bg-blanco" />
                      </label>
                      <label className="grid gap-1.5 text-[12.5px] font-bold text-cafe-medio">
                        Hora
                        <Input type="time" aria-label="Hora de la cita" value={borrador.time} onChange={(e) => setBorrador({ ...borrador, time: e.target.value })} className="min-h-11 bg-blanco" />
                      </label>
                    </div>
                    <label className="grid gap-1.5 text-[12.5px] font-bold text-cafe-medio">
                      Duración
                      <Select value={String(borrador.duration)} onValueChange={(valor) => setBorrador({ ...borrador, duration: Number(valor) })}>
                        <SelectTrigger aria-label="Duración de la cita" className="min-h-11 bg-blanco"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {durationOptions.map((min) => <SelectItem key={min} value={String(min)}>{min} min</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </label>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button type="button" variant="outline" className="min-h-11" onClick={() => { setPanelAbierto(null); setBorrador(null); }}>Cancelar</Button>
                      <Button type="button" className="min-h-11" onClick={intentarGuardarEdicion}>Guardar cambios</Button>
                    </div>
                  </section>
                )}

                {/* La clienta: avatar, nombre y enlace a su ficha. */}
                {client ? (
                  <button
                    type="button"
                    onClick={() => abrirClienta(client.id)}
                    aria-label={`Abrir la ficha de ${client.name}`}
                    className="group flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-[0_2px_8px_rgba(59,47,42,0.05)] text-left hover:bg-nata focus-visible:outline-2 focus-visible:outline-primary"
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
                  <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-[0_2px_8px_rgba(59,47,42,0.05)]">
                    <AvatarClienta nombre={appointment.clientName} size="md" />
                    <span className="truncate font-display text-[19px] leading-tight font-medium">
                      {appointment.clientName}
                    </span>
                  </div>
                )}

                {(appointment.note || appointment.bookingAnswers) && (
                  <section className="space-y-2 rounded-2xl bg-card px-4 py-3.5 text-[13px] leading-relaxed text-cafe-medio">
                    <h3 className="text-sm font-bold text-foreground">Para esta cita</h3>
                    {appointment.note && <p>{appointment.note}</p>}
                    <BookingAnswersSummary answers={appointment.bookingAnswers} />
                  </section>
                )}

                {/* Lo que debe, con las tres salidas al lado. Va arriba a propósito:
                  el momento de cobrar una deuda vieja es cuando la persona está
                  delante, y eso pasa justo aquí. */}
                {conRecargo && <BandaDeuda client={client} compacta />}

                {/* La pregunta, en el sitio donde ocurre: esta cita ya pasó y nadie
                  ha dicho si la persona apareció. */}
                {porResolver && (
                  <div className="space-y-3 rounded-2xl bg-card p-4 shadow-[0_4px_12px_rgba(59,47,42,0.06)]">
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
                  <div className="flex items-start gap-2 rounded-2xl bg-melocoton/50 px-4 py-3 text-[13px] leading-relaxed text-melocoton-tinta">
                    <TriangleAlert
                      className="size-4 shrink-0 text-melocoton-tinta"
                      aria-hidden="true"
                    />
                    <span>{plantones}</span>
                  </div>
                )}

                {/* Recargo pendiente: lo que hay que ver antes de confirmar. */}
                {conRecargo && (client?.penaltyEur ?? 0) > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-melocoton/50 px-4 py-3 text-[13px] text-melocoton-tinta">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Este cliente tiene un recargo pendiente de {eur(client!.penaltyEur ?? 0)}
                      {appointment.status === "pending"
                        ? " — decide si le confirmas la cita."
                        : "."}
                    </span>
                  </div>
                )}

                <section className="space-y-3 rounded-2xl bg-card p-4">
                  <h3 className="text-sm font-bold">Gestionar cita</h3>
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

                {/* La señal conserva su acción secundaria; editar está arriba y visible. */}
                {puedeEn("senal.gestionar") && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-expanded={panelAbierto === "fianza"}
                      onClick={() => setPanelAbierto((p) => (p === "fianza" ? null : "fianza"))}
                      className={accionSecundaria(panelAbierto === "fianza")}
                    >
                      <Euro className="size-[15px]" strokeWidth={1.6} /> Fianza
                    </button>
                  </div>
                )}

                </section>

                {/* Señal (9j): estado del ciclo y sus acciones, según la regla de Ajustes. */}
                {panelAbierto === "fianza" && puedeEn("senal.gestionar") && (
                  <SenalCita key={appointment.id} cita={appointment} />
                )}

                {/* Lo demás, plegado y con su resumen. */}
                <div className="space-y-3">
                  {!puedeEn("cita.cobrar") ? (
                    <p className="rounded-xl border border-lino bg-superficie px-3 py-2 text-[13px] text-cafe-medio">
                      Cobro: lo marca quien atiende la cita.
                    </p>
                  ) : (
                    <Desplegable
                      titulo="Cobro"
                    className="rounded-2xl border-0 bg-card px-4 py-1"
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
                    className="rounded-2xl border-0 bg-card px-4 py-1"
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
                    className="rounded-2xl border-0 bg-card px-4 py-1"
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
              <footer className="shrink-0 bg-card px-5 py-3 sm:px-7 sm:py-4">
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
      <DialogoHorarioSalon
        aviso={confirmarHorario?.aviso ?? null}
        abierto={!!confirmarHorario}
        onCancelar={() => setConfirmarHorario(null)}
        onConfirmar={() => {
          const patch = confirmarHorario?.patch;
          setConfirmarHorario(null);
          if (patch) comprobarSolapeEdicion(patch);
        }}
      />
      <DialogoSolape
        choques={confirmarSolape?.choques ?? []}
        profesional={equipo.find((employee) => employee.id === (confirmarSolape?.patch.employeeId ?? appointment?.employeeId))?.name ?? ""}
        abierto={!!confirmarSolape}
        onCancelar={() => setConfirmarSolape(null)}
        onConfirmar={() => {
          const patch = confirmarSolape?.patch;
          setConfirmarSolape(null);
          if (patch) guardarEdicion(patch, true);
        }}
        carta={carta}
      />
    </>
  );
}

function accionSecundaria(activa: boolean) {
  return cn(
    "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
    activa ? "border-moca bg-nata text-cafe" : "border-input bg-card text-cafe-medio hover:bg-nata",
  );
}


/**
 * Servicios en «Editar cita» (26-oct): los elegidos arriba y un buscador, en
 * vez de los 57 botones de la carta seguidos.
 */
function SelectorServiciosEdicion({
  seleccionados,
  services,
  nombre,
  alternar,
}: {
  seleccionados: string[];
  services: Array<{ id: string; name: string; active?: boolean; durationMin: number }>;
  nombre: (id: string) => string;
  alternar: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const resultados = q.trim()
    ? services.filter((s) => s.active !== false && !seleccionados.includes(s.id) && norm(s.name).includes(norm(q.trim()))).slice(0, 8)
    : [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {seleccionados.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={`Quitar ${nombre(id)}`}
            onClick={() => alternar(id)}
            className="min-h-11 rounded-2xl border border-transparent bg-salvia-clara px-3 py-2 text-left text-[13px] font-bold text-hoja-tinta"
          >
            {nombre(id)} ✕
          </button>
        ))}
        {seleccionados.length === 0 && <p className="text-[13px] text-muted-foreground">Ningún servicio elegido.</p>}
      </div>
      <input
        type="search"
        aria-label="Buscar un servicio para añadir"
        placeholder="Buscar un servicio para añadir…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-blanco px-3 text-sm"
      />
      {resultados.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-xl border border-input bg-blanco">
          {resultados.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  alternar(s.id);
                  setQ("");
                }}
                className="flex min-h-11 w-full items-center justify-between px-3 text-left text-[13px] font-semibold hover:bg-nata"
              >
                <span>{s.name}</span>
                <span className="text-muted-foreground tabular-nums">{s.durationMin} min</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && resultados.length === 0 && <p className="text-[13px] text-muted-foreground">Ningún servicio con ese nombre.</p>}
    </div>
  );
}
