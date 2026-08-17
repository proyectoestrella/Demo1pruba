import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import {
  appointmentsTodayTrend,
  cancellationsTrend,
  mostBookedService,
  newClientsTrend,
  revenueByDay,
  revenueTodayTrend,
  weeklyOccupancyTrend,
  type KpiTrend,
} from "@/lib/derive";
import { Calendar, Euro, Users, TrendingUp, CalendarX, type LucideIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { employeeMap, serviceMap } from "@/lib/mock/salon";
import type { Appointment } from "@/lib/mock/types";
import { StylistDot } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { KpiCard } from "@/components/KpiCard";
import { CountUp } from "@/components/reactbits/CountUp";
import { BorderBeam } from "@/components/magicui/border-beam";

const CHART_TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-foreground)",
} as const;
const CHART_LABEL_STYLE = { color: "var(--color-muted-foreground)" } as const;

export const Route = createFileRoute("/app/")({
  component: Home,
});

/** Time-of-day greeting: madrugada (00-06), mañana (06-13), tarde (13-20), noche (20-24). */
function greetingForHour(hour: number) {
  if (hour < 6) return "Buenas noches.";
  if (hour < 13) return "Buenos días.";
  if (hour < 20) return "Buenas tardes.";
  return "Buenas noches.";
}

function Home() {
  const appointments = useSalonStore((s) => s.appointments);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const revData = revenueByDay(appointments, 30);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const greeting = greetingForHour(new Date().getHours());

  const kpis: {
    label: string;
    icon: LucideIcon;
    trend: KpiTrend;
    format: (n: number) => string;
    context: string;
    goodDirection: "up" | "down";
  }[] = [
    {
      label: "Citas hoy",
      icon: Calendar,
      trend: appointmentsTodayTrend(appointments),
      format: (n) => n.toString(),
      context: "vs. ayer",
      goodDirection: "up",
    },
    {
      label: "Ingresos hoy",
      icon: Euro,
      trend: revenueTodayTrend(appointments),
      format: (n) => `€${Math.round(n).toLocaleString("es")}`,
      context: "vs. ayer",
      goodDirection: "up",
    },
    {
      label: "Ocupación semanal",
      icon: TrendingUp,
      trend: weeklyOccupancyTrend(appointments),
      format: (n) => `${Math.round(n)}%`,
      context: "vs. semana pasada",
      goodDirection: "up",
    },
    {
      label: "Clientes nuevos",
      icon: Users,
      trend: newClientsTrend(appointments),
      format: (n) => n.toString(),
      context: "vs. semana pasada",
      goodDirection: "up",
    },
    {
      label: "Cancelaciones",
      icon: CalendarX,
      trend: cancellationsTrend(appointments),
      format: (n) => n.toString(),
      context: "vs. semana pasada",
      // Unlike the other KPIs, more cancellations is bad news, not good.
      goodDirection: "down",
    },
  ];

  const topService = mostBookedService(appointments);

  const todayList = appointments
    .filter((a) => {
      const d = new Date(a.start);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && a.status !== "cancelled";
    })
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl tracking-tight">{greeting}</h1>
        <p className="text-sm text-muted-foreground">Así va {salonName} hoy.</p>
      </div>

      <div data-tour="kpis" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            icon={k.icon}
            trend={k.trend}
            format={k.format}
            context={k.context}
            goodDirection={k.goodDirection}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>Servicio más pedido: <span className="font-medium text-foreground">{topService}</span></span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div
          data-tour="revenue-chart"
          className="relative min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card p-6 lg:col-span-2"
        >
          {/* Un haz recorriendo el borde marca cuál es la tarjeta principal
              del panel sin recurrir a más color ni a más peso tipográfico. */}
          <BorderBeam size={110} duration={14} colorFrom="var(--color-primary)" colorTo="transparent" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Ingresos</p>
              <h2 className="mt-1 font-display text-xl">Últimos 30 días</h2>
            </div>
            <CountUp
              className="font-display text-2xl"
              to={revData.reduce((s, d) => s + d.revenue, 0)}
              format={(v) => `€${Math.round(v).toLocaleString("es")}`}
            />
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} opacity={0.7} />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v: number) => `€${v}`}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_LABEL_STYLE}
                  formatter={(value: number) => [`€${value}`, "Ingresos"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#rev)"
                  activeDot={{ r: 4, fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 }}
                  dot={(props: { cx?: number; cy?: number; index?: number }) =>
                    props.index === revData.length - 1 ? (
                      <circle
                        key="last"
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill="var(--color-primary)"
                        stroke="var(--color-card)"
                        strokeWidth={2}
                      />
                    ) : (
                      <circle key={props.index} r={0} />
                    )
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-border/60 bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Reservas por día</p>
          <h2 className="mt-1 font-display text-xl">Volumen</h2>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revData.slice(-14)} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} opacity={0.7} />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_LABEL_STYLE}
                  formatter={(value: number) => [value, "Reservas"]}
                />
                <Bar dataKey="bookings" radius={[6, 6, 0, 0]}>
                  {revData.slice(-14).map((d, i, arr) => (
                    <Cell key={d.date} fill="var(--color-primary)" fillOpacity={i === arr.length - 1 ? 1 : 0.45} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div data-tour="today-list" className="min-w-0 rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h2 className="font-display text-lg">Citas de hoy</h2>
          <span className="text-xs text-muted-foreground">{todayList.length} programadas</span>
        </div>
        {todayList.length === 0 ? (
          <EmptyState icon={CalendarX} title="Sin citas para hoy" description="Cuando reserves o crees una cita, aparecerá aquí." />
        ) : (
          <div className="divide-y divide-border/60">
            {todayList.map((a) => {
              const emp = employeeMap[a.employeeId];
              const svc = serviceMap[a.serviceId];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="w-16 shrink-0 font-display text-xl">
                    {new Date(a.start).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </div>
                  <StylistDot employeeId={a.employeeId} className="size-2.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">{svc?.name} · {a.duration} min · con {emp.name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">€{a.priceEur}</span>
                  <StatusBadge status={a.status} className="shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AppointmentDetailSheet appointment={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
