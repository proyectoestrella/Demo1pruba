import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import {
  cancellationsThisWeek,
  mostBookedService,
  newClientsThisWeek,
  revenueByDay,
  todayKpis,
  weeklyOccupancy,
} from "@/lib/derive";
import { Calendar, Euro, Users, TrendingUp, CalendarX } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { employeeMap, serviceMap } from "@/lib/mock/salon";
import type { Appointment } from "@/lib/mock/types";
import { StylistDot } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";

export const Route = createFileRoute("/app/")({
  component: Home,
});

function Home() {
  const appointments = useSalonStore((s) => s.appointments);
  const today = todayKpis(appointments);
  const revData = revenueByDay(appointments, 30);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const kpis = [
    { label: "Citas hoy", value: today.count.toString(), icon: Calendar },
    { label: "Ingresos hoy", value: `€${today.revenue}`, icon: Euro },
    { label: "Ocupación semanal", value: `${weeklyOccupancy(appointments)}%`, icon: TrendingUp },
    { label: "Clientes nuevos", value: newClientsThisWeek(appointments).toString(), icon: Users },
  ];

  const cancellations = cancellationsThisWeek(appointments);
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
        <h1 className="font-display text-2xl md:text-3xl tracking-tight">Buenos días.</h1>
        <p className="text-sm text-muted-foreground">Así va Los Mosqueteros hoy.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>{cancellations} cancelaciones esta semana</span>
        <span className="hidden sm:inline">·</span>
        <span>Servicio más pedido: <span className="font-medium text-foreground">{topService}</span></span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-border/60 bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Ingresos</p>
              <h2 className="mt-1 font-display text-xl">Últimos 30 días</h2>
            </div>
            <p className="font-display text-2xl">€{revData.reduce((s, d) => s + d.revenue, 0).toLocaleString("es")}</p>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-border/60 bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Reservas por día</p>
          <h2 className="mt-1 font-display text-xl">Volumen</h2>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revData.slice(-14)}>
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="bookings" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-border/60 bg-card">
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
