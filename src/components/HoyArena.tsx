import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bell,
  Calendar,
  Check,
  Clock,
  Clock3,
  Euro,
  FileText,
  MessageCircle,
  X,
} from "lucide-react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { serviceLabelOf } from "@/lib/appointment-services";
import { cierreDelDia } from "@/lib/caja";
import { duracionRecordada } from "@/lib/derive";
import { enlaceDeFianza } from "@/lib/avisos";
import { deadlineHours, depositDueAt } from "@/lib/deposit-deadline";
import { recargoActivo } from "@/lib/recargo-activo";
import { ESTADO_POR_DESENLACE, type Desenlace } from "@/lib/deuda";
import { fechaLocal, hojaDelDia } from "@/lib/hoja-del-dia";
import { eur, eurRedondo, hora } from "@/lib/copy";
import {
  citasDelDia,
  colorServicio,
  duracionCorta,
  enCurso,
  faltaPara,
  fraseDelDia,
  huecosLibresDesde,
  minutosAHora,
  opcionesDeDuracion,
  saludoPara,
  terminada,
} from "@/lib/hoy-arena";
import type { Appointment, Client } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { useAplicarDesenlace } from "@/components/CitasPorResolver";
import { DecisionDeudaDialog } from "@/components/DecisionDeudaDialog";
import { AvisoDeudasHoy } from "@/components/DeudaCliente";
import { ExpiredDepositsNotice } from "@/components/ExpiredDepositsNotice";
import { RecargosPendientes } from "@/components/RecargosPendientes";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";

/**
 * Pantalla «Hoy» con la identidad «Arena» (DESIGN.md), calcada del prototipo
 * aprobado: saludo, cuatro cifras, «Esto te espera», «Ahora y siguientes»,
 * «¿Vinieron?», recordatorios de mañana y hoja del día. Todo sale de la
 * store: las mismas acciones que ya existían (confirmar, rechazar, marcar
 * vino / no vino), con otra piel.
 */

const etiqueta = "text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase";
const tarjeta = "rounded-[20px] border border-border bg-card shadow-[var(--sombra-tarjeta)]";
const cabeceraTarjeta = "flex items-center gap-2.5 px-5 py-4";
const tituloTarjeta = "text-base font-extrabold tracking-[-0.01em]";
const subTarjeta = "text-[12.5px] text-muted-foreground";
const chip =
  "inline-flex h-6 items-center gap-1.5 rounded-full bg-nata px-2.5 text-[12.5px] font-bold whitespace-nowrap text-cafe-medio";
const btnPeq = "inline-flex h-[34px] items-center justify-center gap-1.5 rounded-full px-[13px] text-[12.5px] font-bold whitespace-nowrap";
const btnPri = `${btnPeq} bg-primary text-primary-foreground hover:bg-[#7A5840]`;
const btnSec = `${btnPeq} border border-input bg-card hover:bg-nata`;

function fechaDeHoy(ahora: Date) {
  const texto = ahora.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} · ${hora(ahora)}`;
}

function Avatar({ nombre, colorVar, className }: { nombre: string; colorVar: string; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full text-[10px] font-extrabold", className)}
      style={{ backgroundColor: `var(${colorVar})` }}
      title={nombre}
      aria-hidden="true"
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}

export function HoyArena() {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const mostrarSolicitudes = useSalonStore((s) => s.salonProfile.mostrarSolicitudes ?? true);
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur ?? 0);
  const equipo = useEquipo();
  const soloUno = esSoloUnProfesional(equipo);
  const [seleccionada, setSeleccionada] = useState<Appointment | null>(null);

  const ahora = new Date();
  const hoy = useMemo(() => citasDelDia(appointments, ahora), [appointments]); // eslint-disable-line react-hooks/exhaustive-deps
  const pendientes = appointments.filter((a) => a.status === "pending");
  const caja = useMemo(() => cierreDelDia(appointments, equipo, ahora), [appointments, equipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const huecos = useMemo(() => huecosLibresDesde(hoy, equipo, ahora), [hoy, equipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const hechas = hoy.filter((a) => terminada(a, ahora)).length;
  const enMarcha = hoy.filter((a) => enCurso(a, ahora)).length;
  const porProfesional = equipo
    .map((e) => ({ nombre: e.name, n: hoy.filter((a) => a.employeeId === e.id).length }))
    .filter((x) => x.n > 0);
  const ingresos = hoy.filter((a) => a.status !== "no-show").reduce((s, a) => s + a.priceEur, 0);
  const cobrados = caja.total;
  const pct = (n: number) => (hoy.length ? Math.round((n / hoy.length) * 100) : 0);
  const serviciosActivos = services.filter((s) => s.active !== false);
  const carta = selectServiceMap(services);

  return (
    <div className="flex flex-1 flex-col">
      {/* Saludo */}
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <p className={cn(etiqueta, "tabular-nums")}>{fechaDeHoy(ahora)}</p>
          <h1 className="font-display text-[26px] leading-[1.1] font-medium tracking-[-0.02em] md:text-[32px]">
            {saludoPara(ahora.getHours())}, {salonName}
          </h1>
          <p className="mt-1 text-muted-foreground">{fraseDelDia(hoy, ahora, (a) => serviceLabelOf(a, carta))}</p>
        </div>
        {serviciosActivos.length > 0 && (
          <div className="ml-auto hidden flex-wrap gap-3 text-[12.5px] font-semibold text-cafe-medio md:flex">
            {serviciosActivos.slice(0, 6).map((s) => (
              <span key={s.id} className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-[4px]" style={{ background: colorServicio(s.id, services) }} />
                {s.name.split(/ y | \/ /)[0]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Cuatro cifras */}
      <section data-tour="kpis" className="mb-5 grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4 lg:group-data-[panel=abierto]/panel:grid-cols-2">
        <Link to="/app/calendar" className={cn(tarjeta, "block px-4 py-3 shadow-none md:px-5 md:py-4")}>
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-muted-foreground">
            <Calendar className="size-[15px]" strokeWidth={1.6} />Citas de hoy
          </div>
          <div className="mt-0.5 text-[22px] leading-tight font-extrabold tabular-nums md:text-[26px]">{hoy.length}</div>
          <div className="text-[12.5px] text-muted-foreground tabular-nums">
            {porProfesional.length > 1
              ? porProfesional.map((p) => `${p.n} ${p.nombre}`).join(" · ")
              : `${hechas} ya atendidas`}
          </div>
          <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-nata" aria-hidden="true">
            <i className="block bg-hoja" style={{ width: `${pct(hechas)}%` }} />
            <i className="block bg-salvia" style={{ width: `${pct(enMarcha)}%` }} />
          </div>
        </Link>
        <Link to="/app/calendar" className={cn(tarjeta, "block px-4 py-3 shadow-none md:px-5 md:py-4")}>
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-muted-foreground">
            <Clock className="size-[15px]" strokeWidth={1.6} />Huecos libres
          </div>
          <div className="mt-0.5 text-[22px] leading-tight font-extrabold tabular-nums md:text-[26px]">{huecos.total}</div>
          <div className="text-[12.5px] text-muted-foreground tabular-nums">
            {huecos.cierre !== null ? `Desde ahora hasta las ${minutosAHora(huecos.cierre)}` : "Hoy no hay horario abierto"}
          </div>
          <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-nata" aria-hidden="true">
            <i className="block bg-taupe" style={{ width: `${Math.min(100, huecos.total * 9)}%` }} />
          </div>
        </Link>
        <Link to="/app/hoja" search={{ dia: "hoy" }} className={cn(tarjeta, "block px-4 py-3 shadow-none md:px-5 md:py-4")}>
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-muted-foreground">
            <Euro className="size-[15px]" strokeWidth={1.6} />Ingresos estimados
          </div>
          <div className="mt-0.5 text-[22px] leading-tight font-extrabold tabular-nums md:text-[26px]">{eurRedondo(ingresos)}</div>
          <div className="text-[12.5px] text-muted-foreground">
            <span className="tabular-nums">{eurRedondo(cobrados)}</span> cobrados · el resto, según vayan viniendo
          </div>
          <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-nata" aria-hidden="true">
            <i className="block bg-moca" style={{ width: `${ingresos ? Math.round((cobrados / ingresos) * 100) : 0}%` }} />
          </div>
        </Link>
        <a href="#espera" className="block rounded-[20px] border-[1.5px] border-dashed border-moca bg-nata px-4 py-3 md:px-5 md:py-4">
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-primary">
            <Bell className="size-[15px]" strokeWidth={1.6} />Te esperan
          </div>
          <div className="mt-0.5 text-[22px] leading-tight font-extrabold tabular-nums md:text-[26px]">{pendientes.length}</div>
          <div className="text-[12.5px] text-muted-foreground">Solicitudes por confirmar</div>
        </a>
      </section>

      {/* Dos columnas: 1,3fr / 1fr */}
      <div className="grid flex-1 grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.3fr_1fr] lg:group-data-[panel=abierto]/panel:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          {mostrarSolicitudes && <EstoTeEspera pendientes={pendientes} onAbrirDetalle={setSeleccionada} />}
          <AvisoDeudasHoy />
          <ExpiredDepositsNotice onOpenDetail={setSeleccionada} />
          {recargoActivo({ noShowFeeEur }) && <RecargosPendientes title="Recargos pendientes" />}
          <AhoraYSiguientes hoy={hoy} ahora={ahora} soloUno={soloUno} onAbrir={setSeleccionada} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Vinieron hoy={hoy} ahora={ahora} soloUno={soloUno} clients={clients} />
          <RecordatoriosDeManana appointments={appointments} ahora={ahora} soloUno={soloUno} />
          <Link
            to="/app/hoja"
            search={{ dia: "hoy" }}
            className="flex items-center gap-4 rounded-[20px] border border-input bg-arena px-5 py-4 hover:text-foreground"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-card text-primary">
              <FileText className="size-[18px]" strokeWidth={1.6} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block">Hoja del día</b>
              <span className="block text-[12.5px] text-cafe-medio">Citas, fórmulas de color y avisos de hoy en un folio para la cabina.</span>
            </span>
            <span className={cn(btnSec, "shrink-0")}>Imprimir</span>
          </Link>
        </div>
      </div>

      <AppointmentDetailSheet
        appointment={seleccionada}
        open={!!seleccionada}
        onOpenChange={(o) => !o && setSeleccionada(null)}
      />
    </div>
  );
}

/* ---------- Esto te espera ---------- */

function EstoTeEspera({
  pendientes,
  onAbrirDetalle,
}: {
  pendientes: Appointment[];
  onAbrirDetalle: (a: Appointment) => void;
}) {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const markDepositRequested = useSalonStore((s) => s.markDepositRequested);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const depositEnabled = useSalonStore((s) => !!s.salonProfile.depositEnabled);
  const depositBizumPhone = useSalonStore((s) => s.salonProfile.depositBizumPhone ?? "");
  const depositAmountEur = useSalonStore((s) => s.salonProfile.depositAmountEur ?? 10);
  const depositDeadlineHours = useSalonStore((s) => deadlineHours(s.salonProfile.depositDeadlineHours));
  const equipo = useEquipo();
  const soloUno = esSoloUnProfesional(equipo);
  const serviceMap = selectServiceMap(services);
  const pideFianza = depositEnabled && !!depositBizumPhone.trim();
  const [duracionPorTarjeta, setDuracionPorTarjeta] = useState<Record<string, number>>({});
  const lista = [...pendientes].sort((a, b) => +new Date(a.start) - +new Date(b.start));

  function confirmar(a: Appointment, duracion: number) {
    updateAppointment(a.id, { status: "confirmed", duration: duracion });
    toast.success("Cita confirmada", { description: `${a.clientName} · ${duracionCorta(duracion)}` });
  }
  function rechazar(a: Appointment) {
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
  function pedirSenal(a: Appointment) {
    if (a.depositReceivedAt) return;
    const telefono = clients.find((c) => c.id === a.clientId)?.phone ?? "";
    if (!telefono) {
      toast.error("Esta solicitud no trae teléfono al que escribir");
      return;
    }
    const requestedAt = new Date().toISOString();
    const url = enlaceDeFianza(
      telefono,
      {
        clientName: a.clientName,
        startISO: a.start,
        salonName,
        bizumPhone: depositBizumPhone,
        importeEur: depositAmountEur,
        deadlineISO: depositDueAt(requestedAt, depositDeadlineHours),
      },
      requestedAt,
    );
    markDepositRequested(a.id, depositAmountEur, requestedAt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const cuando = (a: Appointment) => {
    const d = new Date(a.start);
    const hoy = fechaLocal(d) === fechaLocal(new Date());
    const dia = hoy
      ? "Hoy"
      : d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(/\.$/, "");
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${hora(a.start)}`;
  };

  return (
    <section id="espera" data-tour="pending-requests" className={cn(tarjeta, "border-[1.5px] border-dashed border-moca")}>
      <div className={cabeceraTarjeta}>
        <Bell className="size-[18px] shrink-0 text-primary" strokeWidth={1.6} />
        <div className="min-w-0">
          <h2 className={tituloTarjeta}>Esto te espera</h2>
          <div className={subTarjeta}>Pon la duración con un toque y confirma: la clienta recibe el aviso al momento.</div>
        </div>
        <span className="ml-auto inline-flex h-6 items-center rounded-full border-[1.5px] border-dashed border-moca bg-card px-2.5 text-[12.5px] font-bold text-primary tabular-nums">
          {lista.length}
        </span>
      </div>
      {lista.length === 0 ? (
        <div className="border-t border-border p-6 text-center text-[12.5px] text-muted-foreground">
          <b className="block text-sm text-foreground">Nada te espera</b>
          Cuando entre una solicitud nueva aparecerá aquí.
        </div>
      ) : (
        lista.map((a) => {
          const catalogoMin = a.serviceIds.reduce((sum, id) => sum + (serviceMap[id]?.durationMin ?? 0), 0);
          const recordada = duracionRecordada(appointments, a.clientId, a.serviceIds, catalogoMin);
          const propuesta = recordada?.minutos ?? (catalogoMin || a.duration);
          const elegida = duracionPorTarjeta[a.id] ?? propuesta;
          const opciones = opcionesDeDuracion(elegida);
          const emp = equipo.find((e) => e.id === a.employeeId);
          const esNueva = !appointments.some(
            (b) => b.clientId === a.clientId && b.id !== a.id && b.status === "completed",
          );
          return (
            <div
              key={a.id}
              className="grid grid-cols-1 items-center gap-2 border-t border-border px-4 py-3 md:grid-cols-[1fr_auto] md:gap-x-4 md:px-5"
            >
              <div className="min-w-0">
                <b>{a.clientName}</b>
                {esNueva && <span className="ml-1 inline-flex h-5 items-center rounded-full bg-melocoton px-2 align-[1px] text-[11px] font-bold text-melocoton-tinta">Nueva</span>}
                <span className="block text-[12.5px] text-muted-foreground tabular-nums">
                  {cuando(a)} · {serviceLabelOf(a, serviceMap)}
                  {emp && !soloUno ? ` con ${emp.name}` : ""}
                  {a.origen !== "tpv123" ? " · pidió por tu página" : ""}
                </span>
                <BookingAnswersSummary answers={a.bookingAnswers} />
              </div>
              <div className="order-3 flex gap-1.5 md:order-none">
                {pideFianza && !a.depositReceivedAt && (
                  <button type="button" className={cn(btnSec, "hidden lg:inline-flex")} onClick={() => pedirSenal(a)}>
                    <MessageCircle className="size-[15px]" strokeWidth={1.6} />
                    {a.depositRequestedAt ? "Reenviar señal" : `Pedir ${eur(depositAmountEur)}`}
                  </button>
                )}
                <button type="button" className={cn(btnSec, "flex-1 md:flex-none")} onClick={() => rechazar(a)}>
                  Rechazar
                </button>
                <button type="button" className={cn(btnPri, "flex-1 md:flex-none")} onClick={() => confirmar(a, elegida)}>
                  Confirmar
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1 md:col-span-2">
                <span className="mr-1.5 text-[12.5px] font-semibold text-cafe-medio">Duración</span>
                {opciones.map((min) => (
                  <button
                    key={min}
                    type="button"
                    aria-pressed={min === elegida}
                    onClick={() => setDuracionPorTarjeta((prev) => ({ ...prev, [a.id]: min }))}
                    className={cn(
                      "h-[30px] rounded-full border px-3 text-[12.5px] font-bold tabular-nums",
                      min === elegida ? "border-moca bg-arena text-foreground" : "border-input bg-card text-cafe-medio hover:bg-nata",
                    )}
                  >
                    {duracionCorta(min)}
                  </button>
                ))}
                {recordada && (
                  <span className="ml-1 inline-flex items-center gap-1 text-[12px] text-primary">
                    <Clock3 className="size-3.5" strokeWidth={1.6} />
                    La última vez tardó {recordada.minutos} min
                  </span>
                )}
                <button type="button" className="ml-auto text-[12px] font-semibold text-muted-foreground underline-offset-2 hover:underline" onClick={() => onAbrirDetalle(a)}>
                  Cambiar fecha u hora
                </button>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

/* ---------- Ahora y siguientes ---------- */

function AhoraYSiguientes({
  hoy,
  ahora,
  soloUno,
  onAbrir,
}: {
  hoy: Appointment[];
  ahora: Date;
  soloUno: boolean;
  onAbrir: (a: Appointment) => void;
}) {
  const services = useSalonStore((s) => s.services);
  const equipo = useEquipo();
  const carta = selectServiceMap(useSalonStore((st) => st.services));
  const siguientes = hoy.filter((a) => !terminada(a, ahora)).slice(0, 6);
  return (
    <section data-tour="today-list" className={cn(tarjeta, "flex flex-1 flex-col")}>
      <div className={cabeceraTarjeta}>
        <Clock className="size-[18px] shrink-0" strokeWidth={1.6} />
        <div className="min-w-0">
          <h2 className={tituloTarjeta}>Ahora y siguientes</h2>
          <div className={subTarjeta}>Pulsa una cita para ver su detalle</div>
        </div>
        <Link to="/app/calendar" className={cn(btnSec, "ml-auto")}>
          Ver calendario
        </Link>
      </div>
      {siguientes.length === 0 ? (
        <div className="border-t border-border p-6 text-center text-[12.5px] text-muted-foreground">
          <b className="block text-sm text-foreground">No queda ninguna cita hoy</b>
          Las de mañana están en el calendario.
        </div>
      ) : (
        <ul>
          {siguientes.map((a) => {
            const ahoraMismo = enCurso(a, ahora);
            const emp = equipo.find((e) => e.id === a.employeeId);
            return (
              <li key={a.id} className={cn("border-t border-border", ahoraMismo && "bg-salvia-clara")}>
                <button
                  type="button"
                  onClick={() => onAbrir(a)}
                  className="flex w-full items-center gap-3 px-4 py-[11px] text-left md:px-5"
                >
                  <span className="w-[46px] shrink-0 font-extrabold tabular-nums">{hora(a.start)}</span>
                  <i className="size-2.5 shrink-0 rounded-[4px]" style={{ background: colorServicio(a.serviceIds[0], services) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{a.clientName}</b>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {serviceLabelOf(a, carta)} · {a.duration} min
                    </span>
                  </span>
                  {emp && !soloUno && <Avatar nombre={emp.name} colorVar={emp.colorVar} className="size-[26px]" />}
                  {ahoraMismo ? (
                    <span className={cn(chip, "bg-salvia-clara text-hoja-tinta")}>Ahora</span>
                  ) : a.status === "pending" ? (
                    <span className={cn(chip, "border-[1.5px] border-dashed border-moca bg-card text-primary")}>Por confirmar</span>
                  ) : (
                    <span className={cn(chip, "tabular-nums")}>{faltaPara(a, ahora)}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------- ¿Vinieron? ---------- */

function Vinieron({
  hoy,
  ahora,
  soloUno,
  clients,
}: {
  hoy: Appointment[];
  ahora: Date;
  soloUno: boolean;
  clients: Client[];
}) {
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const conRecargo = recargoActivo({ noShowFeeEur });
  const equipo = useEquipo();
  const carta = selectServiceMap(useSalonStore((st) => st.services));
  const aplicar = useAplicarDesenlace();
  const [decision, setDecision] = useState<{ client: Client | undefined; cita: Appointment; desenlace: Desenlace } | null>(null);
  const terminadas = hoy.filter((a) => terminada(a, ahora));
  const sinMarcar = terminadas.filter((a) => a.status === "pending" || a.status === "confirmed").length;

  function elegir(a: Appointment, d: Desenlace) {
    if (a.status === ESTADO_POR_DESENLACE[d]) return;
    aplicar(a, d);
    if (d === "vino" || !conRecargo) return;
    const client = clients.find((c) => c.id === a.clientId);
    if (client) setDecision({ client, cita: a, desenlace: d });
  }

  const boton = (a: Appointment, d: Desenlace, texto: string, Icono: typeof Check, tono: "si" | "no" | "tarde") => {
    const on = a.status === ESTADO_POR_DESENLACE[d];
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => elegir(a, d)}
        className={cn(
          "flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-bold",
          on && tono === "si" && "border-salvia bg-salvia-clara text-hoja-tinta",
          on && tono !== "si" && "border-melocoton-borde bg-melocoton text-melocoton-tinta",
          !on && "border-input bg-card",
          !on && tono === "si" && "hover:border-salvia hover:bg-salvia-clara hover:text-hoja-tinta",
          !on && tono !== "si" && "hover:border-melocoton-borde hover:bg-melocoton hover:text-melocoton-tinta",
        )}
      >
        <Icono className="size-[15px]" strokeWidth={1.6} />
        {texto}
      </button>
    );
  };

  return (
    <>
      <section className={tarjeta}>
        <div className={cabeceraTarjeta}>
          <Check className="size-[18px] shrink-0" strokeWidth={1.6} />
          <div className="min-w-0">
            <h2 className={tituloTarjeta}>¿Vinieron?</h2>
            <div className={subTarjeta}>Las citas que ya han terminado</div>
          </div>
          <span className={cn(chip, "ml-auto", sinMarcar ? "bg-arena" : "bg-salvia-clara text-hoja-tinta")}>
            {sinMarcar ? `${sinMarcar} por marcar` : "Todo marcado"}
          </span>
        </div>
        {terminadas.length === 0 ? (
          <div className="border-t border-border p-6 text-center text-[12.5px] text-muted-foreground">
            <b className="block text-sm text-foreground">Aún no ha terminado ninguna</b>
            Según vayan acabando, aquí marcas si vinieron.
          </div>
        ) : (
          <ul>
            {terminadas.map((a) => {
              const emp = equipo.find((e) => e.id === a.employeeId);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-[11px] md:px-5">
                  <span className="w-[46px] shrink-0 font-extrabold tabular-nums">{hora(a.start)}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{a.clientName}</b>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {serviceLabelOf(a, carta)}
                      {emp && !soloUno ? ` · ${emp.name}` : ""}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    {boton(a, "vino", "Vino", Check, "si")}
                    {boton(a, "tarde", "Tarde", Clock3, "tarde")}
                    {boton(a, "no-vino", "No vino", X, "no")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {conRecargo && (
        <DecisionDeudaDialog
          client={decision?.client}
          cita={decision?.cita}
          desenlace={decision?.desenlace ?? "no-vino"}
          open={!!decision}
          onOpenChange={(o) => !o && setDecision(null)}
        />
      )}
    </>
  );
}

/* ---------- Recordatorios de mañana ---------- */

function RecordatoriosDeManana({ appointments, ahora, soloUno }: { appointments: Appointment[]; ahora: Date; soloUno: boolean }) {
  const equipo = useEquipo();
  const carta = selectServiceMap(useSalonStore((st) => st.services));
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  const filas = hojaDelDia(appointments, fechaLocal(manana)).sort(
    (x, y) => +new Date(x.cita.start) - +new Date(y.cita.start),
  );
  const pendientes = filas.filter((f) => !f.cita.reminderSentAt).length;
  const diaTexto = manana.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });
  return (
    <section className={tarjeta}>
      <div className={cabeceraTarjeta}>
        <MessageCircle className="size-[18px] shrink-0" strokeWidth={1.6} />
        <div className="min-w-0">
          <h2 className={tituloTarjeta}>Recordatorios de mañana</h2>
          <div className={subTarjeta}>
            {diaTexto.charAt(0).toUpperCase()}{diaTexto.slice(1)} · se envían por WhatsApp
          </div>
        </div>
        {pendientes > 0 ? (
          <Link to="/app/hoja" search={{ dia: "manana" }} className={cn(btnPri, "ml-auto")}>
            Enviar {pendientes}
          </Link>
        ) : (
          <span className={cn(chip, "ml-auto bg-salvia-clara text-hoja-tinta")}>Todos enviados</span>
        )}
      </div>
      {filas.length === 0 ? (
        <div className="border-t border-border p-6 text-center text-[12.5px] text-muted-foreground">
          <b className="block text-sm text-foreground">Mañana no hay citas</b>
          No hay nada que recordar.
        </div>
      ) : (
        <ul>
          {filas.slice(0, 6).map(({ cita, ultimoColor }) => {
            const emp = equipo.find((e) => e.id === cita.employeeId);
            const tinte = cita.serviceIds.some((id) => /tint|color|mech|balay/i.test(id));
            return (
              <li key={cita.id} className="flex items-center gap-3 border-t border-border px-4 py-[11px] md:px-5">
                <span className="w-[46px] shrink-0 font-extrabold tabular-nums">{hora(cita.start)}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{cita.clientName}</b>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {serviceLabelOf(cita, carta)}
                    {emp && !soloUno ? ` · ${emp.name}` : ""}
                    {tinte && !ultimoColor?.colorFormula ? " · sin fórmula" : ""}
                  </span>
                </span>
                {cita.reminderSentAt ? (
                  <span className={cn(chip, "bg-salvia-clara text-hoja-tinta")}>Enviado</span>
                ) : (
                  <span className={cn(chip, "bg-arena")}>Pendiente</span>
                )}
              </li>
            );
          })}
          {filas.length > 6 && (
            <li className="border-t border-border px-5 py-2.5 text-[12.5px] text-muted-foreground">
              Y {filas.length - 6} más en la hoja de mañana.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
