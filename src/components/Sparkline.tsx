import { Line, LineChart, ResponsiveContainer } from "recharts";
import { hayTendenciaQueDibujar } from "@/lib/sparkline";

export interface SparklineProps {
  /** Values oldest → newest. */
  data: number[];
  /** CSS color value for the line and the highlighted final point, e.g. "var(--color-success)". */
  color: string;
  className?: string;
}

/**
 * Minimal trend line for KPI cards — no axes, grid or tooltip, just the
 * shape of the series with the final (current) point marked.
 *
 * Con uno o dos días con datos no se dibuja NADA: se enseña un guion. Con tan
 * poco, las cuatro tarjetas pintaban exactamente la misma curva —plana y con
 * un repunte al final— que parecía una tendencia y no lo era. Ver
 * `hayTendenciaQueDibujar`.
 */
export function Sparkline({ data, color, className }: SparklineProps) {
  if (!hayTendenciaQueDibujar(data)) {
    return (
      <div
        className={className}
        style={{ width: "100%", height: 32 }}
        title="Aún no hay días suficientes para enseñar una tendencia."
      >
        <div
          aria-hidden="true"
          className="flex h-full items-center justify-center text-sm leading-none text-muted-foreground/40"
        >
          —
        </div>
      </div>
    );
  }

  const points = data.map((value, i) => ({ value, i }));
  const lastIndex = data.length - 1;

  return (
    <div className={className} style={{ width: "100%", height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === lastIndex ? (
                <circle
                  key="last"
                  cx={props.cx}
                  cy={props.cy}
                  r={2.5}
                  fill={color}
                  stroke="var(--color-card)"
                  strokeWidth={1}
                />
              ) : (
                <circle key={props.index} r={0} />
              )
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
