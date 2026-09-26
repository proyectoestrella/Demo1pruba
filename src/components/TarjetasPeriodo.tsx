import { useMemo } from "react";
import { Ban, Calendar, Euro, Scissors, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { zonaDelSalon } from "@/lib/zona-horaria";
import { useEquipo } from "@/lib/use-equipo";
import { resumenDePeriodo, comparar, type ResumenPeriodo } from "@/lib/periodos";
import { nuevasYRecurrentes, serviciosDelRango } from "@/lib/analitica-arena";
import { dineroDelRango } from "@/lib/dinero";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { cn } from "@/lib/utils";
import { eurRedondo } from "@/lib/copy";

/**
 * El selector de periodo y las seis cifras de Analítica «Arena»: citas,
 * ingresos, ocupación, clientas nuevas y recurrentes, servicio más pedido y
 * cancelaciones. Todas miran el MISMO periodo y dicen contra qué comparan;
 * el cálculo vive en `lib/periodos.ts` y `lib/analitica-arena.ts`.
 */
export function TarjetasPeriodo({ className }: { className?: string }) {
  const appointments = useSalonStore((s) => s.appointments);
  const services = useSalonStore((s) => s.services);
  const periodo = useSalonStore((s) => s.periodoAnalitica);
  const rango = useSalonStore((s) => s.rangoAnalitica);
  // Días y semanas en la zona del salón, no en la del dispositivo.
  const zona = useSalonStore((s) => zonaDelSalon(s.salonProfile));
  const equipo = useEquipo();

  const resumen = useMemo(
    () => resumenDePeriodo(appointments, periodo, equipo, new Date(), rango, undefined, zona),
    [appointments, periodo, rango, equipo, zona],
  );

  return (
    <div className={cn("space-y-3", className)} data-tour="kpis">
      <SelectorPeriodo />
      <FilaDeTarjetas resumen={resumen} appointments={appointments} services={services} />
      {resumen.cerrado ? (
        <p className="text-[12.5px] text-muted-foreground">
          El salón no abre ningún día de este periodo, así que no hay cifras que comparar: el cero
          es el horario, no una caída.
        </p>
      ) : (
        !resumen.hayComparacion && (
          <p className="text-[12.5px] text-muted-foreground">
            No hay actividad en el periodo anterior equivalente, así que no se enseña ninguna
            variación: preferimos decirlo a inventarla.
          </p>
        )
      )}
    </div>
  );
}

/** Minigráfica de la serie en moca, el último punto en moca fuerte. */
function Mini({ serie }: { serie: number[] }) {
  if (serie.length < 2) return null;
  const max = Math.max(1, ...serie);
  const w = 100;
  const hgt = 24;
  const pts = serie.map((v, i) => [(i / (serie.length - 1)) * w, hgt - 2 - (v / max) * (hgt - 4)] as const);
  const [ux, uy] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${hgt}`} preserveAspectRatio="none" className="mt-2 h-6 w-full" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--moca)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={ux} cy={uy} r={2.2} fill="var(--moca-fuerte)" />
    </svg>
  );
}

function Variacion({ valor, anterior, cerrado, bueno = "sube" }: { valor: number; anterior: number | null; cerrado: boolean; bueno?: "sube" | "baja" }) {
  if (cerrado) return <span className="text-[12px] text-muted-foreground">Cerrado</span>;
  const { variacionPct } = comparar(valor, anterior);
  if (variacionPct === null) return <span className="text-[12px] text-muted-foreground">Sin comparación</span>;
  const mejora = bueno === "sube" ? variacionPct >= 0 : variacionPct <= 0;
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11.5px] font-bold tabular-nums", mejora ? "bg-salvia-clara text-hoja-tinta" : "bg-melocoton text-melocoton-tinta")}>
      {variacionPct > 0 ? "+" : ""}
      {variacionPct} %
    </span>
  );
}

export function FilaDeTarjetas({
  resumen,
  appointments,
  services,
}: {
  resumen: ResumenPeriodo;
  appointments: Parameters<typeof nuevasYRecurrentes>[0];
  services: Parameters<typeof serviciosDelRango>[2];
}) {
  const { actual, previo, series, textoComparacion: contexto, cerrado, rango } = resumen;
  const esDemo = useSalonStore((s) => !s.realSalonSlug);
  // Dinero con etiquetas honestas (9d): un periodo pasado enseña lo COBRADO;
  // uno futuro, lo PREVISTO (confirmadas sin cobrar); el que contiene hoy, lo
  // cobrado y lo que queda por cobrar, igual que la tarjeta de Hoy.
  const dinero = dineroDelRango(appointments, rango, new Date());
  const sinCobros = dinero.cobrado === 0 && dinero.sinCobroMarcado > 0 && !esDemo;
  const tarjetaDinero =
    dinero.tiempo === "futuro"
      ? {
          label: "Previsto",
          valor: eurRedondo(dinero.previsto),
          pie: <span className="text-[12px] text-muted-foreground tabular-nums">{dinero.previstas} {dinero.previstas === 1 ? "cita confirmada" : "citas confirmadas"}</span>,
        }
      : dinero.tiempo === "pasado"
        ? {
            label: "Cobrado",
            valor: eurRedondo(dinero.cobrado),
            pie: <span className="text-[12px] text-muted-foreground tabular-nums">{sinCobros ? "Marca los cobros en el detalle de cada cita" : `${dinero.realizadas - dinero.noVino} realizadas · ${dinero.noVino} no vino`}</span>,
          }
        : {
            label: "Cobrado",
            valor: eurRedondo(dinero.cobrado),
            pie: <span className="text-[12px] text-muted-foreground tabular-nums">{sinCobros ? "Marca los cobros en el detalle de cada cita" : `Quedan ${eurRedondo(dinero.porCobrar)} por cobrar`}</span>,
          };
  const clientas = nuevasYRecurrentes(appointments, rango);
  const top = serviciosDelRango(appointments, rango, services)[0];

  const tarjetas: { label: string; icon: LucideIcon; valor: string; pie: React.ReactNode; serie?: number[] }[] = [
    { label: "Citas", icon: Calendar, valor: String(actual.citas), pie: <Variacion valor={actual.citas} anterior={previo.citas} cerrado={cerrado} />, serie: series.citas },
    { label: tarjetaDinero.label, icon: Euro, valor: tarjetaDinero.valor, pie: tarjetaDinero.pie },
    { label: "Ocupación media", icon: TrendingUp, valor: `${Math.round(actual.ocupacion ?? 0)} %`, pie: <Variacion valor={actual.ocupacion ?? 0} anterior={previo.ocupacion} cerrado={cerrado} />, serie: series.ocupacion },
    {
      label: "Clientas",
      icon: Users,
      valor: `${clientas.nuevas + clientas.recurrentes}`,
      pie: <span className="text-[12px] text-muted-foreground tabular-nums">{clientas.nuevas} nuevas · {clientas.recurrentes} recurrentes</span>,
    },
    {
      label: "Más pedido",
      icon: Scissors,
      valor: top ? top.sv.name : "—",
      pie: <span className="text-[12px] text-muted-foreground tabular-nums">{top ? `${top.veces} ${top.veces === 1 ? "vez" : "veces"}` : "Sin citas"}</span>,
    },
    { label: "Cancelaciones", icon: Ban, valor: String(actual.cancelaciones), pie: <Variacion valor={actual.cancelaciones} anterior={previo.cancelaciones} cerrado={cerrado} bueno="baja" /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 2xl:grid-cols-6">
      {tarjetas.map((t) => (
        <div key={t.label} className="flex min-w-0 flex-col rounded-[20px] border border-border bg-card px-4 py-3 md:px-5 md:py-4">
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-muted-foreground">
            <t.icon className="size-[15px]" strokeWidth={1.6} aria-hidden="true" />
            {t.label}
          </div>
          <div className={cn("mt-0.5 truncate leading-tight font-extrabold tabular-nums", t.valor.length > 8 ? "text-lg md:text-xl" : "text-[22px] md:text-[26px]")} title={t.valor}>
            {t.valor}
          </div>
          <div className="flex items-center gap-1.5">{t.pie}</div>
          {t.serie && <Mini serie={t.serie} />}
          {!t.serie && <p className="mt-2 text-[11.5px] text-muted-foreground">{t.label === "Cancelaciones" ? contexto : " "}</p>}
        </div>
      ))}
    </div>
  );
}
