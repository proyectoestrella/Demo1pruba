import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { aiInsights, serviceMix } from "@/lib/derive";
import { Sparkles, TrendingDown, Heart, CalendarClock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/insights")({ component: Insights });

const ICONS = { sparkles: Sparkles, "trending-down": TrendingDown, heart: Heart, "calendar-clock": CalendarClock } as const;

function Insights() {
  const appointments = useSalonStore((s) => s.appointments);
  const cards = aiInsights(appointments);
  const mix = serviceMix(appointments).slice(0, 5);
  const totalRev = mix.reduce((s, m) => s + m.revenue, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary">Analítica IA</p>
        <h1 className="font-display text-2xl md:text-3xl tracking-tight">Lo que dicen tus datos.</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const Icon = ICONS[c.icon as keyof typeof ICONS] ?? Sparkles;
          return (
            <div key={c.title} className="rounded-xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">IA</span>
              </div>
              <h3 className="mt-4 font-display text-xl">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
              <button type="button" className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                {c.action} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="min-w-0 rounded-xl border border-border/60 bg-card p-6">
        <h2 className="font-display text-xl">Mezcla de ingresos por servicio</h2>
        <div className="mt-5 space-y-3">
          {mix.map((m) => {
            const pct = Math.round((m.revenue / totalRev) * 100);
            return (
              <div key={m.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{m.name}</span>
                  <span className="text-muted-foreground">€{m.revenue.toLocaleString()} · {pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
