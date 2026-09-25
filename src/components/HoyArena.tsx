import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, CalendarDays, Check, ChevronDown, Clock3, Euro, FileText, MoreHorizontal } from "lucide-react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { serviceLabelOf } from "@/lib/appointment-services";
import { agendaDeHoy, dineroDelRango } from "@/lib/dinero";
import { esCobrable } from "@/lib/caja";
import { duracionRecordada } from "@/lib/derive";
import { enlaceDeFianza } from "@/lib/avisos";
import { deadlineHours, depositDueAt, depositState } from "@/lib/deposit-deadline";
import { recargoActivo } from "@/lib/recargo-activo";
import { ESTADO_POR_DESENLACE, resumenDeDeuda, type Desenlace } from "@/lib/deuda";
import { fechaLocal, hojaDelDia } from "@/lib/hoja-del-dia";
import { eur, eurRedondo, hora } from "@/lib/copy";
import {
  citasDelDia,
  colorServicio,
  duracionCorta,
  enCurso,
  faltaPara,
  opcionesDeDuracion,
  saludoPara,
  terminada,
} from "@/lib/hoy-arena";
import type { Appointment, Client } from "@/lib/mock/types";
import { VentanaConfirmar } from "@/components/VentanaConfirmar";
import { DuracionOtra } from "@/components/DuracionOtra";
import { cn } from "@/lib/utils";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { useAplicarDesenlace } from "@/components/CitasPorResolver";
import { DecisionDeudaDialog } from "@/components/DecisionDeudaDialog";
import { AvisoDeudasHoy } from "@/components/DeudaCliente";
import { ExpiredDepositsNotice } from "@/components/ExpiredDepositsNotice";
import { RecargosPendientes } from "@/components/RecargosPendientes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * «Hoy» con la identidad «Arena · calma» (DESIGN.md, lote 8). La pantalla
 * responde a una sola pregunta: ¿qué me toca ahora? Arriba, el saludo y una
 * línea de cifras en texto. Debajo, dos bloques: lo que espera respuesta y lo
 * que está pasando. El resto del día (quién vino, mañana, avisos) queda en
 * pestañas, plegado pero a un toque. Cada fila tiene una acción a la vista y
 * las demás en «…»: no se ha quitado ninguna.
 */

const tituloBloque = "text-[17px] font-extrabold tracking-[-0.01em]";
const bloque = "rounded-[24px] border border-lino bg-card p-5 md:p-7";

function fechaDeHoy(ahora: Date) {
  const texto = ahora.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} · ${hora(ahora)}`;
}

function BotonMas({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={etiqueta}
          className="grid size-9 shrink-0 place-items-center rounded-full text-cafe-medio hover:bg-beige [@media(pointer:coarse)]:size-11"
        >
          <MoreHorizontal className="size-[18px]" strokeWidth={1.6} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HoyArena() {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const mostrarSolicitudes = useSalonStore((s) => s.salonProfile.mostrarSolicitudes ?? true);
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur ?? 0);
  const horasSenal = useSalonStore((s) => deadlineHours(s.salonProfile.depositDeadlineHours));
  const equipo = useEquipo();
  const soloUno = esSoloUnProfesional(equipo);
  const carta = selectServiceMap(services);
  const [seleccionada, setSeleccionada] = useState<Appointment | null>(null);

  const ahora = new Date();
  const hoy = useMemo(() => citasDelDia(appointments, ahora), [appointments]); // eslint-disable-line react-hooks/exhaustive-deps
  const pendientes = appointments
    .filter((a) => a.status === "pending")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const agenda = useMemo(() => agendaDeHoy(hoy, equipo, ahora), [hoy, equipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const dinero = useMemo(() => dineroDelRango(appointments, rangoDelDia(ahora), ahora), [appointments]); // eslint-disable-line react-hooks/exhaustive-deps
  const esDemo = useSalonStore((s) => !s.realSalonSlug);
  // Lo que vale el día (ni canceladas ni «no vino»): cobrado + lo que queda por
  // cobrar, sea futuro o ya pasado sin marcar. Así ninguna cita se pierde.
  const valorDelDia = hoy.filter(esCobrable).reduce((s, a) => s + a.priceEur, 0);
  const porCobrar = Math.max(0, valorDelDia - dinero.cobrado);

  // Lo de las pestañas, contado para que la pestaña diga cuánto hay dentro.
  const terminadas = hoy.filter((a) => terminada(a, ahora));
  const sinMarcar = terminadas.filter((a) => a.status === "pending" || a.status === "confirmed").length;
  const solicitudesVisibles = mostrarSolicitudes ? pendientes.length : 0;
  const pendienteDeTi = solicitudesVisibles + sinMarcar;
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  const filasManana = hojaDelDia(appointments, fechaLocal(manana)).sort((x, y) => +new Date(x.cita.start) - +new Date(y.cita.start));
  const sinRecordar = filasManana.filter((f) => !f.cita.reminderSentAt).length;
  const conRecargo = recargoActivo({ noShowFeeEur });
  const avisos =
    (conRecargo ? resumenDeDeuda(clients).personas : 0) +
    appointments.filter((a) => depositState(a, ahora, horasSenal) === "expired").length;

  const nombreCorto = (a: Appointment) => {
    const e = equipo.find((x) => x.id === a.employeeId);
    return e && !soloUno ? ` · ${e.name}` : "";
  };

  return (
    <div className="flex flex-1 flex-col gap-8">
      {/* Saludo y, debajo, las cuatro cifras del día en tarjetas. */}
      <header className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">{fechaDeHoy(ahora)}</p>
          <h1 className="mt-1 font-display text-[28px] leading-[1.1] font-medium tracking-[-0.02em] md:text-[34px]">
            {saludoPara(ahora.getHours())}, {salonName}
          </h1>
        </div>
        <Button variant="ghost" asChild className="text-cafe-medio md:ml-auto">
          <Link to="/app/hoja" search={{ dia: "hoy" }}>
            <FileText className="size-[18px]" strokeWidth={1.6} />
            Hoja del día
          </Link>
        </Button>
      </header>

      <div data-tour="kpis" className="-mt-2 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4 xl:group-data-[panel=abierto]/panel:grid-cols-2">
        <TarjetaCifra icono={CalendarDays} titulo="Citas de hoy" to="/app/calendar">
          <Cifra>{agenda.total}</Cifra>
          <Detalle>{soloUno ? `${agenda.ocupacionPct} % de tu jornada` : agenda.porPro.map((x) => `${x.citas} ${x.e.name}`).join(" · ")}</Detalle>
          <Barra pct={agenda.ocupacionPct} texto={`Agenda al ${agenda.ocupacionPct} %`} />
        </TarjetaCifra>
        <TarjetaCifra icono={Clock3} titulo="Huecos libres" to="/app/calendar">
          <Cifra extra={agenda.minutosLibres > 0 ? `· ${duracionCorta(agenda.minutosLibres)}` : undefined}>{agenda.huecos.length}</Cifra>
          <Detalle>{agenda.huecos.length ? agenda.detalleHuecos : "Hoy ya no queda ningún hueco de media hora."}</Detalle>
        </TarjetaCifra>
        <TarjetaCifra icono={Euro} titulo="Ingresos de hoy">
          <Cifra>{eurRedondo(valorDelDia)}</Cifra>
          <Detalle>
            {dinero.cobrado === 0 && dinero.sinCobroMarcado > 0 && !esDemo
              ? "0 € cobrados · marca los cobros en el detalle de cada cita"
              : `Llevas ${eurRedondo(dinero.cobrado)} cobrados · quedan ${eurRedondo(porCobrar)} por cobrar`}
          </Detalle>
          <Barra pct={valorDelDia ? Math.round((dinero.cobrado / valorDelDia) * 100) : 0} texto="Cobrado del total del día" oculto />
        </TarjetaCifra>
        <TarjetaCifra icono={Bell} titulo="Pendiente de ti" destacada={pendienteDeTi > 0} href={solicitudesVisibles > 0 ? "#espera" : undefined} to={solicitudesVisibles > 0 ? undefined : "/app/appointments"}>
          <Cifra>{pendienteDeTi}</Cifra>
          <Detalle>
            {pendienteDeTi === 0
              ? "Nada pendiente: todo al día."
              : [solicitudesVisibles > 0 && `${solicitudesVisibles} ${solicitudesVisibles === 1 ? "solicitud" : "solicitudes"}`, sinMarcar > 0 && `${sinMarcar} por marcar`].filter(Boolean).join(" · ")}
          </Detalle>
        </TarjetaCifra>
      </div>

      {/* Lo único que pide respuesta, y solo si lo hay. */}
      {mostrarSolicitudes && pendientes.length > 0 && <EstoTeEspera pendientes={pendientes} onAbrirDetalle={setSeleccionada} />}

      {/* El resto del día, plegado: cada bloque dice cuánto hay dentro. */}
      <Plegables
        porDefecto={mostrarSolicitudes && pendientes.length > 0 ? null : "ahora"}
        items={[
          {
            id: "ahora",
            titulo: "Ahora y siguientes",
            contador: hoy.filter((a) => !terminada(a, ahora)).length,
            resumen: "Las citas que quedan hoy",
            tour: "today-list",
            contenido: <AhoraYSiguientes hoy={hoy} ahora={ahora} carta={carta} services={services} detalle={nombreCorto} onAbrir={setSeleccionada} />,
          },
          {
            id: "vinieron",
            titulo: "¿Vinieron?",
            contador: sinMarcar,
            resumen: sinMarcar > 0 ? "Citas terminadas sin marcar" : "Todas las terminadas están marcadas",
            contenido: <Vinieron terminadas={terminadas} carta={carta} detalle={nombreCorto} clients={clients} />,
          },
          {
            id: "manana",
            titulo: "Mañana y recordatorios",
            contador: sinRecordar,
            resumen: filasManana.length === 0 ? "Mañana no hay citas" : sinRecordar > 0 ? "Sin recordar" : "Todas recordadas",
            contenido: <Manana filas={filasManana} pendientes={sinRecordar} dia={manana} carta={carta} detalle={nombreCorto} />,
          },
          {
            id: "avisos",
            titulo: "Avisos",
            contador: avisos,
            resumen: avisos > 0 ? "Deudas, señales vencidas o recargos" : "Nada pendiente",
            contenido: (
              <div className="space-y-4">
                {avisos === 0 && <p className="text-[14px] text-muted-foreground">Nada pendiente: ni deudas, ni señales vencidas, ni recargos.</p>}
                <AvisoDeudasHoy />
                <ExpiredDepositsNotice onOpenDetail={setSeleccionada} />
                {conRecargo && <RecargosPendientes title="Recargos pendientes" />}
              </div>
            ),
          },
        ]}
      />

      <AppointmentDetailSheet
        appointment={seleccionada}
        open={!!seleccionada}
        onOpenChange={(o) => !o && setSeleccionada(null)}
      />
    </div>
  );
}

/* ---------- Tarjetas de cifras ---------- */

function rangoDelDia(d: Date) {
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { inicio, fin: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) };
}

/**
 * Una de las cuatro cifras de Hoy: icono y título, la cifra, una línea de
 * detalle y, si procede, su barra en salvia. La de «Pendiente de ti» va en
 * pastel miel cuando hay algo. Toda la tarjeta lleva a donde se resuelve.
 */
function TarjetaCifra({
  icono: Icono,
  titulo,
  destacada = false,
  to,
  href,
  children,
}: {
  icono: typeof Bell;
  titulo: string;
  destacada?: boolean;
  to?: "/app/calendar" | "/app/appointments";
  href?: string;
  children: ReactNode;
}) {
  const clase = cn(
    "flex min-w-0 flex-col rounded-[20px] border px-3.5 py-3 transition-colors sm:px-5 sm:py-4",
    destacada ? "border-miel-borde bg-miel hover:bg-[#EFDFB5]" : "border-lino bg-card hover:bg-superficie",
  );
  const dentro = (
    <>
      <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-cafe-medio sm:text-[13px]">
        <Icono className="size-[15px]" strokeWidth={1.7} aria-hidden="true" />
        {titulo}
      </span>
      {children}
    </>
  );
  if (href) return <a href={href} className={clase}>{dentro}</a>;
  if (to) return <Link to={to} className={clase}>{dentro}</Link>;
  return <div className={clase}>{dentro}</div>;
}

function Cifra({ children, extra }: { children: ReactNode; extra?: string }) {
  return (
    <p className="mt-1.5 flex items-baseline gap-1.5 leading-none">
      <span className="text-[24px] font-extrabold tracking-[-0.02em] tabular-nums sm:text-[30px]">{children}</span>
      {extra && <span className="text-[15px] font-bold text-cafe-medio tabular-nums">{extra}</span>}
    </p>
  );
}

function Detalle({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[12.5px] leading-snug text-cafe-medio sm:mt-2 sm:text-[13.5px]">{children}</p>;
}

function Barra({ pct, texto, oculto = false }: { pct: number; texto: string; oculto?: boolean }) {
  return (
    <div className="mt-auto pt-3">
      <span className="block h-1.5 overflow-hidden rounded-full bg-beige" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={texto}>
        <i className="block h-full rounded-full bg-hoja" style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      {!oculto && <span className="mt-1.5 block text-[12.5px] text-cafe-medio tabular-nums">{texto}</span>}
    </div>
  );
}

/* ---------- Esto te espera ---------- */

function EstoTeEspera({ pendientes, onAbrirDetalle }: { pendientes: Appointment[]; onAbrirDetalle: (a: Appointment) => void }) {
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
  const [editando, setEditando] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);
  const visibles = todas ? pendientes : pendientes.slice(0, 3);

  // Confirmar ya no es a ciegas (9f): abre la ventana con la ficha y la propuesta.
  const [aConfirmar, setAConfirmar] = useState<{ cita: Appointment; duracion: number } | null>(null);
  function confirmar(a: Appointment, duracion: number) {
    setAConfirmar({ cita: a, duracion });
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
    const esHoy = fechaLocal(d) === fechaLocal(new Date());
    const dia = esHoy ? "Hoy" : d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(/\.$/, "");
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${hora(a.start)}`;
  };

  return (
    <section id="espera" data-tour="pending-requests" className="rounded-[24px] border border-salvia bg-salvia-suave p-5 md:p-7">
      <div className="flex items-baseline gap-3">
        <h2 className={tituloBloque}>Esto te espera</h2>
        <span className="inline-flex h-6 items-center rounded-full border-[1.5px] border-dashed border-moca px-2.5 text-[12.5px] font-bold text-primary tabular-nums">
          {pendientes.length}
        </span>
      </div>
      <p className="mt-1 text-[14px] text-muted-foreground">Al confirmarla queda en tu agenda. El aviso a la clienta lo mandas tú por WhatsApp desde su ficha, con un toque.</p>
      <ul className="mt-5 divide-y divide-salvia/70">
        {visibles.map((a) => {
          const catalogoMin = a.serviceIds.reduce((sum, id) => sum + (serviceMap[id]?.durationMin ?? 0), 0);
          const recordada = duracionRecordada(appointments, a.clientId, a.serviceIds, catalogoMin);
          const propuesta = recordada?.minutos ?? (catalogoMin || a.duration);
          const elegida = duracionPorTarjeta[a.id] ?? propuesta;
          const emp = equipo.find((e) => e.id === a.employeeId);
          const esNueva = !appointments.some((b) => b.clientId === a.clientId && b.id !== a.id && b.status === "completed");
          return (
            <li key={a.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                <button type="button" onClick={() => onAbrirDetalle(a)} className="min-w-0 basis-full text-left sm:flex-1 sm:basis-0">
                  <b className="block truncate text-[15px]">
                    {a.clientName}
                    {esNueva && <span className="ml-2 align-[1px] text-[12px] font-bold text-melocoton-tinta">Nueva</span>}
                  </b>
                  <span className="block truncate text-[13.5px] text-muted-foreground tabular-nums">
                    {cuando(a)} · {serviceLabelOf(a, serviceMap)}
                    {emp && !soloUno ? ` · ${emp.name}` : ""}
                  </span>
                </button>
                <Button onClick={() => confirmar(a, elegida)} className="flex-1 tabular-nums sm:flex-none">
                  Confirmar · {duracionCorta(elegida)}
                </Button>
                <BotonMas etiqueta={`Más opciones para ${a.clientName}`}>
                  <DropdownMenuItem onClick={() => setEditando(editando === a.id ? null : a.id)}>Cambiar la duración</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAbrirDetalle(a)}>Cambiar fecha u hora</DropdownMenuItem>
                  {pideFianza && !a.depositReceivedAt && (
                    <DropdownMenuItem onClick={() => pedirSenal(a)}>
                      {a.depositRequestedAt ? "Reenviar la señal" : `Pedir ${eur(depositAmountEur)} de señal`}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-melocoton-tinta focus:text-melocoton-tinta" onClick={() => rechazar(a)}>
                    Rechazar
                  </DropdownMenuItem>
                </BotonMas>
              </div>
              {editando === a.id && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl bg-beige px-3 py-2.5">
                  {opcionesDeDuracion(elegida).map((min) => (
                    <button
                      key={min}
                      type="button"
                      aria-pressed={min === elegida}
                      onClick={() => setDuracionPorTarjeta((prev) => ({ ...prev, [a.id]: min }))}
                      className={cn(
                        "h-9 rounded-full px-3.5 text-[13px] font-bold tabular-nums",
                        min === elegida ? "bg-blanco text-foreground shadow-[var(--sombra-tarjeta)]" : "text-cafe-medio hover:bg-superficie",
                      )}
                    >
                      {duracionCorta(min)}
                    </button>
                  ))}
                  <DuracionOtra
                    valor={elegida}
                    onElegir={(min) => setDuracionPorTarjeta((prev) => ({ ...prev, [a.id]: min }))}
                    claseChip="h-9 rounded-full px-3.5 text-[13px] font-bold text-cafe-medio hover:bg-superficie"
                  />
                  {recordada && (
                    <span className="ml-1 inline-flex items-center gap-1 text-[12.5px] text-cafe-medio">
                      <Clock3 className="size-3.5" strokeWidth={1.6} />
                      La última vez tardó {recordada.minutos} min
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {pendientes.length > 3 && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-bold text-cafe-medio hover:text-foreground">
          {todas ? "Ver menos" : `Ver las ${pendientes.length - 3} restantes`}
          <ChevronDown className={cn("size-4 transition-transform", todas && "rotate-180")} strokeWidth={1.6} />
        </button>
      )}
      <VentanaConfirmar
        cita={aConfirmar?.cita ?? null}
        duracionInicial={aConfirmar?.duracion}
        onCerrar={() => setAConfirmar(null)}
        onCambiar={(c) => {
          setAConfirmar(null);
          onAbrirDetalle(c);
        }}
      />
    </section>
  );
}

/* ---------- Plegables ---------- */

const CLAVE_PLEGABLES = "sishow-hoy-abiertos";

interface Plegable {
  id: string;
  titulo: string;
  contador: number;
  resumen: string;
  tour?: string;
  contenido: ReactNode;
}

/**
 * Acordeón de Hoy: cabecera clara con contador y flecha. Recuerda en este
 * navegador cuáles abrió la dueña; la primera vez abre como mucho uno.
 */
function Plegables({ items, porDefecto }: { items: Plegable[]; porDefecto: string | null }) {
  const [abiertos, setAbiertos] = useState<string[]>(porDefecto ? [porDefecto] : []);
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_PLEGABLES);
      if (guardado) setAbiertos(JSON.parse(guardado) as string[]);
    } catch {
      /* sin almacenamiento: se queda el de por defecto */
    }
  }, []);
  const alternar = (id: string) =>
    setAbiertos((prev) => {
      const nuevos = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(CLAVE_PLEGABLES, JSON.stringify(nuevos));
      } catch {
        /* sin almacenamiento: solo dura esta visita */
      }
      return nuevos;
    });
  return (
    <div className="divide-y divide-lino overflow-hidden rounded-[24px] border border-lino bg-card">
      {items.map((it) => {
        const abierto = abiertos.includes(it.id);
        return (
          <section key={it.id} data-tour={it.tour}>
            <h2>
              <button
                type="button"
                aria-expanded={abierto}
                aria-controls={`plegable-${it.id}`}
                onClick={() => alternar(it.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-beige/60 md:px-7"
              >
                <span className="text-[16px] font-extrabold tracking-[-0.01em]">{it.titulo}</span>
                {it.contador > 0 && (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-salvia-clara px-2 text-[12.5px] font-bold text-hoja-tinta tabular-nums">
                    {it.contador}
                  </span>
                )}
                <span className="ml-auto hidden truncate text-[13.5px] text-muted-foreground sm:block">{it.resumen}</span>
                <ChevronDown className={cn("size-5 shrink-0 text-cafe-medio transition-transform", abierto && "rotate-180")} strokeWidth={1.6} />
              </button>
            </h2>
            {abierto && (
              <div id={`plegable-${it.id}`} className="px-5 pb-6 md:px-7">
                {it.contenido}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------- Ahora y siguientes ---------- */

function AhoraYSiguientes({
  hoy,
  ahora,
  carta,
  services,
  detalle,
  onAbrir,
}: {
  hoy: Appointment[];
  ahora: Date;
  carta: ReturnType<typeof selectServiceMap>;
  services: Parameters<typeof colorServicio>[1];
  detalle: (a: Appointment) => string;
  onAbrir: (a: Appointment) => void;
}) {
  const [todas, setTodas] = useState(false);
  const quedan = hoy.filter((a) => !terminada(a, ahora));
  const siguientes = todas ? quedan : quedan.slice(0, 5);
  return (
    <div>
      {siguientes.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted-foreground">No queda ninguna cita hoy. Las de mañana están en el calendario.</p>
      ) : (
        <ul>
          {siguientes.map((a) => {
            const ahoraMismo = enCurso(a, ahora);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(a)}
                  className={cn("-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-2xl px-3 py-3 text-left hover:bg-beige", ahoraMismo && "bg-salvia-suave")}
                >
                  <span className="w-12 shrink-0 text-[15px] font-extrabold tabular-nums">{hora(a.start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <i className="size-2 shrink-0 rounded-full" style={{ background: colorServicio(a.serviceIds[0], services) }} aria-hidden="true" />
                      <b className="truncate text-[15px]">{a.clientName}</b>
                    </span>
                    <span className="block truncate pl-4 text-[13.5px] text-muted-foreground">
                      {serviceLabelOf(a, carta)}
                      {detalle(a)}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-[13px] font-bold tabular-nums", ahoraMismo ? "text-hoja-tinta" : "text-muted-foreground")}>
                    {ahoraMismo ? "Ahora" : a.status === "pending" ? "Por confirmar" : faltaPara(a, ahora)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {quedan.length > 5 && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-bold text-cafe-medio hover:text-foreground">
          {todas ? "Ver menos" : `Ver las ${quedan.length - 5} restantes`}
          <ChevronDown className={cn("size-4 transition-transform", todas && "rotate-180")} strokeWidth={1.6} />
        </button>
      )}
      <Link to="/app/calendar" className="mt-3 block text-[13.5px] font-bold text-cafe-medio hover:text-foreground">
        Ver calendario
      </Link>
    </div>
  );
}

/* ---------- ¿Vinieron? ---------- */

function Vinieron({
  terminadas,
  carta,
  detalle,
  clients,
}: {
  terminadas: Appointment[];
  carta: ReturnType<typeof selectServiceMap>;
  detalle: (a: Appointment) => string;
  clients: Client[];
}) {
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const conRecargo = recargoActivo({ noShowFeeEur });
  const aplicar = useAplicarDesenlace();
  const [decision, setDecision] = useState<{ client: Client | undefined; cita: Appointment; desenlace: Desenlace } | null>(null);

  function elegir(a: Appointment, d: Desenlace) {
    if (a.status === ESTADO_POR_DESENLACE[d]) return;
    aplicar(a, d);
    if (d === "vino" || !conRecargo) return;
    const client = clients.find((c) => c.id === a.clientId);
    if (client) setDecision({ client, cita: a, desenlace: d });
  }
  const estado: Record<string, string> = { completed: "Vino", late: "Tarde sin avisar", "no-show": "No vino" };

  if (terminadas.length === 0) {
    return <p className="text-[14px] text-muted-foreground">Aún no ha terminado ninguna cita. Según vayan acabando, aquí marcas si vinieron.</p>;
  }
  return (
    <>
      <ul className="divide-y divide-lino">
        {[...terminadas].reverse().map((a) => {
          const marcada = estado[a.status];
          return (
            <li key={a.id} className="flex items-center gap-4 py-3">
              <span className="w-12 shrink-0 text-[15px] font-extrabold tabular-nums">{hora(a.start)}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px]">{a.clientName}</b>
                <span className="block truncate text-[13.5px] text-muted-foreground">
                  {serviceLabelOf(a, carta)}
                  {detalle(a)}
                </span>
              </span>
              {marcada ? (
                <span className={cn("shrink-0 text-[13px] font-bold", a.status === "completed" ? "text-hoja-tinta" : "text-melocoton-tinta")}>{marcada}</span>
              ) : (
                <Button variant="outline" size="sm" onClick={() => elegir(a, "vino")} className="shrink-0 border-salvia bg-salvia-suave text-hoja-tinta hover:bg-salvia-clara">
                  <Check className="size-4" strokeWidth={1.8} />
                  Vino
                </Button>
              )}
              <BotonMas etiqueta={`Otras respuestas para ${a.clientName}`}>
                <DropdownMenuItem onClick={() => elegir(a, "vino")}>Vino</DropdownMenuItem>
                <DropdownMenuItem onClick={() => elegir(a, "tarde")}>Llegó tarde sin avisar</DropdownMenuItem>
                <DropdownMenuItem className="text-melocoton-tinta focus:text-melocoton-tinta" onClick={() => elegir(a, "no-vino")}>
                  No vino
                </DropdownMenuItem>
              </BotonMas>
            </li>
          );
        })}
      </ul>
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

/* ---------- Mañana ---------- */

function Manana({
  filas,
  pendientes,
  dia,
  carta,
  detalle,
}: {
  filas: ReturnType<typeof hojaDelDia>;
  pendientes: number;
  dia: Date;
  carta: ReturnType<typeof selectServiceMap>;
  detalle: (a: Appointment) => string;
}) {
  const [todas, setTodas] = useState(false);
  const diaTexto = dia.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });
  if (filas.length === 0) return <p className="text-[14px] text-muted-foreground">Mañana no hay citas: no hay nada que recordar.</p>;
  const visibles = todas ? filas : filas.slice(0, 6);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[14px] text-muted-foreground">
          {diaTexto.charAt(0).toUpperCase()}
          {diaTexto.slice(1)}: <b className="text-foreground tabular-nums">{filas.length}</b> citas,{" "}
          {pendientes > 0 ? (
            <>
              <b className="text-foreground tabular-nums">{pendientes}</b> sin recordar. Se envían desde tu WhatsApp.
            </>
          ) : (
            "todas recordadas."
          )}
        </p>
        {pendientes > 0 && (
          <Button asChild className="sm:ml-auto">
            <Link to="/app/hoja" search={{ dia: "manana" }}>
              Enviar recordatorios
            </Link>
          </Button>
        )}
      </div>
      <ul className="mt-3 divide-y divide-lino">
        {visibles.map(({ cita }) => (
          <li key={cita.id} className="flex items-center gap-4 py-3">
            <span className="w-12 shrink-0 text-[15px] font-extrabold tabular-nums">{hora(cita.start)}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px]">{cita.clientName}</b>
              <span className="block truncate text-[13.5px] text-muted-foreground">
                {serviceLabelOf(cita, carta)}
                {detalle(cita)}
              </span>
            </span>
            <span className={cn("shrink-0 text-[13px] font-bold", cita.reminderSentAt ? "text-hoja-tinta" : "text-muted-foreground")}>
              {cita.reminderSentAt ? "Recordada" : "Sin recordar"}
            </span>
          </li>
        ))}
      </ul>
      {filas.length > 6 && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-bold text-cafe-medio hover:text-foreground">
          {todas ? "Ver menos" : `Ver las ${filas.length - 6} restantes`}
          <ChevronDown className={cn("size-4 transition-transform", todas && "rotate-180")} strokeWidth={1.6} />
        </button>
      )}
    </div>
  );
}
