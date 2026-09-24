import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  Euro,
  CalendarX,
  Phone,
  UserPlus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { ultimoColor } from "@/lib/colores";
import {
  periodLabelSuffix,
  trendsForPeriod,
  type CustomRange,
  type MetricPeriod,
} from "@/lib/derive";
import { dayOccupancyBars, toDateKey } from "@/lib/reparto";
import { cierreDelDia } from "@/lib/caja";
import { employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { eur, hora } from "@/lib/copy";
import { PAYMENT_METHOD_LABELS, type Appointment } from "@/lib/mock/types";
import { StylistDot } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { PendingRequestsBanner } from "@/components/PendingRequestsBanner";
import { ExpiredDepositsNotice } from "@/components/ExpiredDepositsNotice";
import { RecargosPendientes } from "@/components/RecargosPendientes";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { WalkInDialog } from "@/components/WalkInDialog";
import { KpiCard } from "@/components/KpiCard";
import { PeriodFilter } from "@/components/PeriodFilter";
import { CitasPorResolver } from "@/components/CitasPorResolver";
import { AvisoDeudasHoy } from "@/components/DeudaCliente";
import { recargoActivo } from "@/lib/recargo-activo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Buenos días (00-06 se cuenta como "madrugada" pero saluda igual que noche). */
function greetingForHour(hour: number) {
  if (hour < 6) return "Buenas noches.";
  if (hour < 13) return "Buenos días.";
  if (hour < 20) return "Buenas tardes.";
  return "Buenas noches.";
}

/**
 * Pantalla de entrada del panel v2: "Hoy". Caja y citas de hoy arriba,
 * bandeja de solicitudes pendientes, próximas citas en orden, y las dos
 * acciones que de verdad pasan en el mostrador — alguien que entra sin cita y
 * alguien que llama por teléfono. Ver el informe de referencias: Boulevard y
 * Yeasy abren aquí, no en el calendario.
 */
export function HoyV2() {
  const appointments = useSalonStore((s) => s.appointments);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur ?? 0);
  const mostrarSolicitudes = useSalonStore((s) => s.salonProfile.mostrarSolicitudes ?? true);
  const smartSpread = useSalonStore((s) => s.salonProfile.smartSpread ?? false);
  const lastSlotBufferMin = useSalonStore((s) => s.salonProfile.lastSlotBufferMin ?? 0);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [phoneApptOpen, setPhoneApptOpen] = useState(false);
  const greeting = greetingForHour(new Date().getHours());
  const employees = useEquipo();
  // Un solo profesional: ni "con Adam" en cada cita, ni punto de color, ni
  // desglose de caja por profesional (eso último lo decide ya `cierreDelDia`).
  const soloUno = esSoloUnProfesional(employees);

  // Periodo de las métricas: "hoy" reproduce exactamente lo de siempre.
  const [period, setPeriod] = useState<MetricPeriod>("hoy");
  const [customRange, setCustomRange] = useState<CustomRange | undefined>(undefined);
  const suffix = periodLabelSuffix(period);

  const now = new Date();
  const trends = trendsForPeriod(appointments, period, now, customRange);
  const context = {
    hoy: "vs. ayer",
    semana: "vs. semana pasada",
    mes: "vs. mes pasado",
    personalizado: "vs. periodo anterior de igual duración",
  }[period];
  const weeklyContext = period === "hoy" || period === "semana" ? "vs. semana pasada" : context;
  const ocupacionLabel =
    period === "mes"
      ? "Ocupación mensual"
      : period === "personalizado"
        ? "Ocupación del periodo"
        : "Ocupación semanal";
  const cajaLabel = period === "hoy" ? "Caja de hoy" : `Caja ${suffix}`;
  const clientesLabel =
    period === "hoy" || period === "semana" ? "Clientes nuevos" : `Clientes nuevos ${suffix}`;

  const horasDeHoy = useMemo(
    () => dayOccupancyBars(appointments, toDateKey(now), employees, lastSlotBufferMin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, lastSlotBufferMin, employees],
  );
  // Cierre de caja del día — lo apuntado a mano, nada de pagos de verdad.
  const caja = useMemo(
    () => cierreDelDia(appointments, employees, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, employees],
  );

  const upcomingToday = appointments
    .filter((a) => {
      const d = new Date(a.start);
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear() &&
        a.status !== "cancelled"
      );
    })
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl tracking-tight text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground">Así va {salonName}.</p>
      </div>

      {/* Lo primero que se ve al abrir el panel, y en este orden: quién te
          debe dinero y viene hoy (el momento de cobrar es cuando lo tienes
          delante), y qué citas de estos días quedaron sin marcar. */}
      <AvisoDeudasHoy />
      <CitasPorResolver />

      {/* Las dos acciones que pasan de verdad en el mostrador: alguien que
          entra sin haber reservado, y alguien que llama por teléfono. Una
          sola fila, mismo peso visual — nada de menú para llegar aquí. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          onClick={() => setWalkInOpen(true)}
          className="h-auto justify-start gap-3 rounded-xl py-4 text-base"
        >
          <UserPlus className="h-5 w-5 shrink-0" />
          <span className="flex flex-col items-start text-left leading-tight">
            Sin cita
            <span className="text-xs font-normal opacity-80">Acaba de entrar</span>
          </span>
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => setPhoneApptOpen(true)}
          className="h-auto justify-start gap-3 rounded-xl py-4 text-base"
        >
          <Phone className="h-5 w-5 shrink-0" />
          <span className="flex flex-col items-start text-left leading-tight">
            Nueva cita por teléfono
            <span className="text-xs font-normal text-muted-foreground">Te acaban de llamar</span>
          </span>
        </Button>
      </div>

      {mostrarSolicitudes && <PendingRequestsBanner onOpenDetail={setSelected} />}
      <ExpiredDepositsNotice onOpenDetail={setSelected} />

      <PeriodFilter
        value={period}
        onChange={setPeriod}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label={`Citas ${suffix}`}
          icon={Calendar}
          trend={trends.citas}
          format={(n) => Math.round(n).toString()}
          context={context}
          goodDirection="up"
          unitLabel="citas"
        />
        <KpiCard
          label={cajaLabel}
          icon={Euro}
          trend={trends.ingresos}
          format={(n) => `€${Math.round(n).toLocaleString("es")}`}
          context={context}
          goodDirection="up"
        />
        <KpiCard
          label={ocupacionLabel}
          icon={TrendingUp}
          trend={trends.ocupacion}
          format={(n) => `${Math.round(n)}%`}
          context={weeklyContext}
          goodDirection="up"
          unitLabel="puntos"
        />
        <KpiCard
          label={clientesLabel}
          icon={Users}
          trend={trends.clientesNuevos}
          format={(n) => Math.round(n).toString()}
          context={weeklyContext}
          goodDirection="up"
          unitLabel="clientes"
        />
      </div>

      {/* Recargos por plantón — justo debajo de las métricas, lo primero que
          se ve tras ellas. Solo con la política activa: apagada, ocultarlo es
          más claro que enseñar el estado vacío del componente. */}
      {recargoActivo({ noShowFeeEur }) && <RecargosPendientes title="Recargos pendientes" />}

      {/* Reparto de agenda: cómo va cargado el día, hora a hora, todo el equipo. */}
      {smartSpread && horasDeHoy.length > 0 && (
        <div className="min-w-0 rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-base">Cómo va el día</h2>
            <span className="text-xs text-muted-foreground">Ocupación por hora</span>
          </div>
          <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
            {horasDeHoy.map((h) => (
              <div key={h.hour} className="flex min-w-[28px] flex-1 flex-col items-center gap-1.5">
                <div className="flex h-20 w-full items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all",
                      h.busy ? "bg-destructive/60" : "bg-success/60",
                    )}
                    style={{ height: `${Math.max(6, h.occupancyPct)}%` }}
                    title={`${h.occupancyPct}% ocupado`}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    h.busy ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {h.hour}h
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            En rojo, las horas "con espera" (12:00–14:00, muy ocupadas o las últimas del día) —
            ofrécelas después que las demás cuando llamen para reservar.
          </p>
        </div>
      )}

      {/* Cierre de caja del día. Aparece en cuanto hay algo que cobrar: es lo
          que Cardedal lleva 26 años haciendo en papel y lo que Alfredo
          (6TREINTA) quiere ver repartido por profesional. Los importes salen
          de lo que se ha marcado a mano en cada cita — aquí no se procesa
          ningún pago. */}
      {(caja.cobradas.length > 0 || caja.pendientes.length > 0) && (
        <div className="min-w-0 rounded-xl border border-border/60 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-display text-base">
              <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
              Cierre de caja de hoy
            </h2>
            <span className="font-display text-lg tabular-nums">{eur(caja.total)}</span>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-3 gap-3">
              {(["efectivo", "bizum", "tarjeta"] as const).map((m) => (
                <div key={m} className="rounded-lg border border-border/60 px-3 py-2 text-center">
                  <p className="font-display text-base tabular-nums">{eur(caja.porMetodo[m])}</p>
                  <p className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[m]}</p>
                </div>
              ))}
            </div>

            {caja.porProfesional.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Por profesional
                </p>
                {caja.porProfesional.map((p) => (
                  <div key={p.employeeId} className="flex items-center gap-2 text-sm">
                    <StylistDot employeeId={p.employeeId as Appointment["employeeId"]} />
                    <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.citas} {p.citas === 1 ? "cita" : "citas"}
                    </span>
                    <span className="tabular-nums font-medium">{eur(p.total)}</span>
                  </div>
                ))}
              </div>
            )}

            {caja.pendientes.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sin marcar todavía ({caja.pendientes.length})
                </p>
                {caja.pendientes.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelected(a)}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                      {hora(a.start)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{a.clientName}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {eur(a.priceEur)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Día cerrado: todo marcado como cobrado.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Estas cifras son lo que has marcado tú en cada cita. siShow no cobra ni comprueba
              ningún pago.
            </p>
          </div>
        </div>
      )}

      <div className="min-w-0 rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h2 className="font-display text-base">Próximas citas</h2>
          <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{upcomingToday.length} hoy</span><Link to="/app/hoja" className="text-xs font-medium text-primary underline">Hoja del día</Link></div>
        </div>
        {upcomingToday.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            title="Sin citas para hoy"
            description="Cuando reserven o crees una cita, aparecerá aquí."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {upcomingToday.map((a) => {
              const emp = employeeMap[a.employeeId];
              const started = new Date(a.start) <= now;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="w-14 shrink-0 font-display text-lg">
                    {new Date(a.start).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </div>
                  <StylistDot employeeId={a.employeeId} className="size-2.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {serviceLabelOf(a)}
                      {employees.length > 1 && ` · con ${emp.name}`}
                    </p>
                    {ultimoColor(appointments, a.clientId, a.start)?.colorFormula && <p className="truncate text-xs text-muted-foreground">Color: {ultimoColor(appointments, a.clientId, a.start)?.colorFormula}</p>}
                  </div>
                  {started ? (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      En curso
                    </span>
                  ) : (
                    <StatusBadge status={a.status} className="shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AppointmentDetailSheet
        appointment={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
      {/* `allowChaining`: los sábados de Cardedal son 60 llamadas seguidas. */}
      <NewAppointmentDialog open={phoneApptOpen} onOpenChange={setPhoneApptOpen} allowChaining />
    </div>
  );
}
