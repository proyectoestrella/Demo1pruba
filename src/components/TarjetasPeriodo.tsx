import { useMemo } from "react";
import { Calendar, Euro, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { employees } from "@/lib/mock/salon";
import { resumenDePeriodo, comparar, type ResumenPeriodo } from "@/lib/periodos";
import type { KpiTrend } from "@/lib/derive";
import { KpiCard } from "@/components/KpiCard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { cn } from "@/lib/utils";

/**
 * Las cuatro cifras del periodo elegido, con su selector encima.
 *
 * Todas miran el MISMO periodo —antes cada tarjeta comparaba contra una cosa
 * distinta escrita a mano— y todas dicen debajo contra qué comparan. El
 * cálculo entero vive en `lib/periodos.ts` y se memoriza por (citas, periodo,
 * rango): cambiar de pestaña no vuelve a recorrer el histórico.
 */
export function TarjetasPeriodo({ className }: { className?: string }) {
  const appointments = useSalonStore((s) => s.appointments);
  const periodo = useSalonStore((s) => s.periodoAnalitica);
  const rango = useSalonStore((s) => s.rangoAnalitica);

  const resumen = useMemo(
    () => resumenDePeriodo(appointments, periodo, employees, new Date(), rango),
    [appointments, periodo, rango],
  );

  return (
    <div className={cn("space-y-3", className)} data-tour="kpis">
      <SelectorPeriodo />
      <FilaDeTarjetas resumen={resumen} />
      {!resumen.hayComparacion && (
        <p className="text-xs text-muted-foreground">
          No hay actividad en el periodo anterior equivalente, así que no se enseña ninguna
          variación: preferimos decirlo a inventarla.
        </p>
      )}
    </div>
  );
}

function trend(valor: number, anterior: number | null, spark: number[]): KpiTrend {
  const c = comparar(valor, anterior);
  return {
    current: valor,
    previous: anterior ?? 0,
    deltaPct: c.variacionPct,
    spark,
  };
}

const EUROS = (n: number) => `${Math.round(n).toLocaleString("es-ES")} €`;

export function FilaDeTarjetas({ resumen }: { resumen: ResumenPeriodo }) {
  const { actual, previo, series, textoComparacion: contexto } = resumen;

  const tarjetas: {
    label: string;
    icon: LucideIcon;
    trend: KpiTrend;
    format: (n: number) => string;
  }[] = [
    {
      label: "Citas",
      icon: Calendar,
      trend: trend(actual.citas, previo.citas, series.citas),
      format: (n) => Math.round(n).toString(),
    },
    {
      label: "Caja",
      icon: Euro,
      trend: trend(actual.caja, previo.caja, series.caja),
      format: EUROS,
    },
    {
      label: "Ocupación",
      icon: TrendingUp,
      // `null` = el equipo no abre ni un día del rango. Se enseña 0 % pero sin
      // comparación, que es lo único honesto que se puede decir.
      trend: trend(actual.ocupacion ?? 0, previo.ocupacion, series.ocupacion),
      format: (n) => `${Math.round(n)} %`,
    },
    {
      label: "Clientes nuevos",
      icon: Users,
      trend: trend(actual.clientesNuevos, previo.clientesNuevos, series.clientesNuevos),
      format: (n) => Math.round(n).toString(),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tarjetas.map((t) => (
        <KpiCard
          key={t.label}
          label={t.label}
          icon={t.icon}
          trend={t.trend}
          format={t.format}
          context={contexto}
          goodDirection="up"
        />
      ))}
    </div>
  );
}
