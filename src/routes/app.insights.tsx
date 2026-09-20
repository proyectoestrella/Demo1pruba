import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { aiInsights, serviceMix } from "@/lib/derive";
import { eurRedondo } from "@/lib/copy";
import { useEquipo } from "@/lib/use-equipo";
import { Sparkles, TrendingDown, Heart, CalendarClock } from "lucide-react";
import { ComingSoonAction } from "@/components/ComingSoonAction";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ExportCsvButtons } from "@/components/campanas/ExportCsvButtons";
import { TarjetasPeriodo } from "@/components/TarjetasPeriodo";
import { rangoDePeriodo, textoRango } from "@/lib/periodos";

export const Route = createFileRoute("/app/insights")({ component: Insights });

const ICONS = {
  sparkles: Sparkles,
  "trending-down": TrendingDown,
  heart: Heart,
  "calendar-clock": CalendarClock,
} as const;

function Insights() {
  const appointments = useSalonStore((s) => s.appointments);
  const services = useSalonStore((s) => s.services);
  const periodo = useSalonStore((s) => s.periodoAnalitica);
  const rangoGuardado = useSalonStore((s) => s.rangoAnalitica);
  // El equipo de la store, no el array mutado en sitio: con un solo
  // profesional la tarjeta de fidelización deja de coronar a nadie.
  const employees = useEquipo();
  const cards = aiInsights(appointments, employees);

  // La mezcla de servicios respeta el MISMO periodo que las tarjetas de inicio:
  // las dos pantallas comparten el selector (vive en la store), así que no
  // pueden contradecirse. Los patrones de abajo, en cambio, necesitan todo el
  // histórico para significar algo — y lo dicen en su propio rótulo.
  const {
    mix: fullMix,
    etiqueta: etiquetaPeriodo,
    rango,
  } = useMemo(() => {
    const r = rangoDePeriodo(periodo, new Date(), rangoGuardado);
    const dentro = appointments.filter((a) => {
      const t = +new Date(a.start);
      return t >= +r.inicio && t < +r.fin;
    });
    return { mix: serviceMix(dentro), etiqueta: textoRango(r), rango: r };
  }, [appointments, periodo, rangoGuardado]);
  // El total se calcula sobre TODOS los servicios, no solo sobre los cinco que
  // se listan: si no, los porcentajes salen inflados y contradicen los de la
  // tarjeta "Servicio estrella", que sí usa la mezcla completa.
  const totalRev = fullMix.reduce((s, m) => s + m.revenue, 0);
  const mix = fullMix.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-2xl md:text-3xl tracking-tight text-foreground">
            Analítica
          </h1>
          <p className="text-sm text-muted-foreground">
            Patrones calculados a partir de tus propias reservas — no son predicciones de una IA.
          </p>
        </div>
        <ExportCsvButtons
          appointments={appointments}
          services={services}
          employees={employees}
          rango={rango}
        />
      </div>

      <TarjetasPeriodo />

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const Icon = ICONS[c.icon as keyof typeof ICONS] ?? Sparkles;
          return (
            <div
              key={c.title}
              className="rounded-xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Todo el histórico
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
              {/* Sin datos detrás, sin botón: la tarjeta acaba de decir que
                  no hay con qué sacar el patrón, así que ofrecer la acción
                  que depende de ese patrón sería prometer lo que no hay. */}
              {c.action ? (
                <ComingSoonAction label={c.action} />
              ) : (
                <p className="mt-5 text-xs text-muted-foreground/70">
                  Cuando tengas más reservas, aquí aparecerá qué hacer con esto.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border/60 bg-card p-6">
          <h2 className="font-display text-xl">Mezcla de ingresos por servicio</h2>
          <p className="mt-1 text-xs text-muted-foreground">{etiquetaPeriodo}</p>
          <div className="mt-5 space-y-3">
            {mix.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay ninguna cita en este periodo, así que no hay mezcla que repartir.
              </p>
            )}
            {mix.map((m) => {
              const pct = totalRev > 0 ? Math.round((m.revenue / totalRev) * 100) : 0;
              return (
                <div key={m.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{m.name}</span>
                    <span className="text-muted-foreground">
                      {eurRedondo(m.revenue)} · {pct} %
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Consulta libre sobre los mismos datos, sin salir de la pantalla. */}
        <div className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/60 px-6 py-4">
            <h2 className="font-display text-xl">Pregúntale a tus datos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Responde calculando sobre tus reservas: ingresos, ocupación, clientes, agenda y
              recomendaciones. No es un modelo de lenguaje: si no sabe algo, lo dice.
            </p>
          </div>
          <AssistantPanel className="flex-1" />
        </div>
      </div>
    </div>
  );
}
