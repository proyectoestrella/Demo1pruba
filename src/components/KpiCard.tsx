import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiTrend } from "@/lib/derive";
import { Sparkline } from "@/components/Sparkline";
import { CountUp } from "@/components/reactbits/CountUp";

export interface KpiCardProps {
  label: string;
  icon: LucideIcon;
  trend: KpiTrend;
  format: (n: number) => string;
  /** Contra qué se compara, ya en español: "vs. ayer a esta hora", "vs. el mes pasado". */
  context: string;
  /** Whether an increase in this metric is good news (ingresos) or bad news (cancelaciones). */
  goodDirection: "up" | "down";
  className?: string;
}

const TONE = {
  success: { chip: "bg-success/10 text-success", line: "var(--color-success)" },
  destructive: { chip: "bg-destructive/10 text-destructive", line: "var(--color-destructive)" },
  neutral: { chip: "bg-muted text-muted-foreground", line: "var(--color-muted-foreground)" },
} as const;

function toneFor(deltaPct: number | null, goodDirection: "up" | "down") {
  if (deltaPct === null || Math.round(deltaPct) === 0) return "neutral" as const;
  const increased = deltaPct > 0;
  const isGood = goodDirection === "up" ? increased : !increased;
  return isGood ? ("success" as const) : ("destructive" as const);
}

/** KPI tile: big current value, signed % change vs. the previous equivalent period, and a sparkline. */
export function KpiCard({
  label,
  icon: Icon,
  trend,
  format,
  context,
  goodDirection,
  className,
}: KpiCardProps) {
  // Sin relleno: si no hay periodo anterior con el que comparar, la tarjeta lo
  // dice. Antes existía un `fallbackPct` que pintaba un "+12 %" inventado
  // cuando el dato real era `null` — en el panel de un salón de verdad eso es
  // mentir al dueño sobre su propio negocio.
  const rounded = trend.deltaPct === null ? null : Math.round(trend.deltaPct);
  const tone = toneFor(rounded, goodDirection);
  const styles = TONE[tone];
  const DeltaIcon = rounded === null || rounded === 0 ? Minus : rounded > 0 ? ArrowUp : ArrowDown;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
            styles.chip,
          )}
          title={context}
        >
          <DeltaIcon className="h-3 w-3" aria-hidden="true" />
          {rounded === null ? "Sin comparación" : `${rounded > 0 ? "+" : ""}${rounded}%`}
        </div>
      </div>
      <CountUp
        className="mt-3 block text-3xl font-semibold tabular-nums"
        to={trend.current}
        format={format}
        duration={1.2}
      />
      {/* Etiqueta y comparación en dos líneas: en cinco columnas, "Cancelaciones"
          y "vs. semana pasada" no caben lado a lado y la segunda se salía. */}
      <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{label}</p>
      <p className="truncate text-[10px] text-muted-foreground/70">{context}</p>
      <div className="mt-3">
        <Sparkline data={trend.spark} color={styles.line} />
      </div>
    </div>
  );
}
