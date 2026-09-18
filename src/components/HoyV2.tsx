import { useMemo, useState } from "react";
import { Calendar, Euro, CalendarX, Phone, UserPlus, TrendingUp, Users, Clock3 } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import {
  appointmentsTodayTrend,
  revenueTodayTrend,
  weeklyOccupancyTrend,
  newClientsTrend,
} from "@/lib/derive";
import { dayOccupancyBars, toDateKey } from "@/lib/reparto";
import { employeeMap, employees } from "@/lib/mock/salon";
import { serviceLabelOf } from "@/lib/appointment-services";
import { eur } from "@/lib/copy";
import type { Appointment } from "@/lib/mock/types";
import { StylistDot } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { PendingRequestsBanner } from "@/components/PendingRequestsBanner";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { WalkInDialog } from "@/components/WalkInDialog";
import { KpiCard } from "@/components/KpiCard";
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
  const clients = useSalonStore((s) => s.clients);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur ?? 0);
  const smartSpread = useSalonStore((s) => s.salonProfile.smartSpread ?? false);
  const lastSlotBufferMin = useSalonStore((s) => s.salonProfile.lastSlotBufferMin ?? 0);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [phoneApptOpen, setPhoneApptOpen] = useState(false);
  const greeting = greetingForHour(new Date().getHours());

  const now = new Date();

  // Plantones pendientes de cobrar ahora mismo — no es un cierre mensual de
  // verdad (no hay fecha de cobro guardada), es "cuánto hay sobre la mesa" en
  // el momento, que es lo que le sirve a Tomás para tantear en 3 segundos.
  const clientesPenalizados = useMemo(
    () => clients.filter((c) => (c.penaltyEur ?? 0) > 0).length,
    [clients],
  );

  const horasDeHoy = useMemo(
    () => dayOccupancyBars(appointments, toDateKey(now), employees, lastSlotBufferMin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, lastSlotBufferMin],
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
        <h1 className="font-display text-2xl tracking-tight">{greeting}</h1>
        <p className="text-sm text-muted-foreground">Así va {salonName} hoy.</p>
      </div>

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

      <PendingRequestsBanner onOpenDetail={setSelected} />

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Citas hoy"
          icon={Calendar}
          trend={appointmentsTodayTrend(appointments)}
          format={(n) => Math.round(n).toString()}
          context="vs. ayer"
          goodDirection="up"
          fallbackPct={12}
        />
        <KpiCard
          label="Caja de hoy"
          icon={Euro}
          trend={revenueTodayTrend(appointments)}
          format={(n) => `€${Math.round(n).toLocaleString("es")}`}
          context="vs. ayer"
          goodDirection="up"
          fallbackPct={9}
        />
        <KpiCard
          label="Ocupación semanal"
          icon={TrendingUp}
          trend={weeklyOccupancyTrend(appointments)}
          format={(n) => `${Math.round(n)}%`}
          context="vs. semana pasada"
          goodDirection="up"
        />
        <KpiCard
          label="Clientes nuevos"
          icon={Users}
          trend={newClientsTrend(appointments)}
          format={(n) => Math.round(n).toString()}
          context="vs. semana pasada"
          goodDirection="up"
        />
      </div>

      {/* Plantones pendientes — solo si la política está activa y hay algo que cobrar. */}
      {noShowFeeEur > 0 && clientesPenalizados > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <Clock3 className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">
            Plantones este mes: <strong>{clientesPenalizados}</strong> ·{" "}
            {eur(clientesPenalizados * noShowFeeEur)} pendientes
          </p>
        </div>
      )}

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

      <div className="min-w-0 rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h2 className="font-display text-base">Próximas citas</h2>
          <span className="text-xs text-muted-foreground">{upcomingToday.length} hoy</span>
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
                      {serviceLabelOf(a)} · con {emp.name}
                    </p>
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
      <NewAppointmentDialog open={phoneApptOpen} onOpenChange={setPhoneApptOpen} />
    </div>
  );
}
