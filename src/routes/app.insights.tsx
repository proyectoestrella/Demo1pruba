import { useTienePlan } from "@/lib/accesos-panel";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { BotonConPlan } from "@/components/BotonConPlan";
import { useMemo, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { aiInsights } from "@/lib/derive";
import { eurRedondo } from "@/lib/copy";
import { useEquipo } from "@/lib/use-equipo";
import { Sparkles, TrendingDown, Heart, CalendarClock } from "lucide-react";
import { ComingSoonAction } from "@/components/ComingSoonAction";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ExportCsvButtons } from "@/components/campanas/ExportCsvButtons";
import { TarjetasPeriodo } from "@/components/TarjetasPeriodo";
import { rangoDePeriodo, textoRango } from "@/lib/periodos";
import {
  barrasDelPeriodo,
  nuevasYRecurrentes,
  ocupacionPorProfesional,
  serviciosDelRango,
  type Barra,
} from "@/lib/analitica-arena";

export const Route = createFileRoute("/app/insights")({ component: Insights });

const ICONS = {
  sparkles: Sparkles,
  "trending-down": TrendingDown,
  heart: Heart,
  "calendar-clock": CalendarClock,
} as const;

function Insights() {
  // Lote 13: patrones y exportar, con Todo incluido.
  const avanzada = useTienePlan("analitica-avanzada");
  const appointments = useSalonStore((s) => s.appointments);
  const services = useSalonStore((s) => s.services);
  const periodo = useSalonStore((s) => s.periodoAnalitica);
  const rangoGuardado = useSalonStore((s) => s.rangoAnalitica);
  // El equipo de la store, no el array mutado en sitio: con un solo
  // profesional la tarjeta de fidelización deja de coronar a nadie.
  const employees = useEquipo();
  const cards = aiInsights(appointments, employees);

  // Todas las gráficas miran el MISMO periodo que las cifras (el selector
  // vive en la store). Los patrones de «Lo que llama la atención» necesitan
  // todo el histórico y lo dicen.
  const datos = useMemo(() => {
    const ahora = new Date();
    const r = rangoDePeriodo(periodo, ahora, rangoGuardado);
    return {
      rango: r,
      etiqueta: textoRango(r),
      barras: barrasDelPeriodo(appointments, periodo, r, employees, ahora),
      ocupacion: ocupacionPorProfesional(appointments, r, employees),
      servicios: serviciosDelRango(appointments, r, services).slice(0, 6),
      clientas: nuevasYRecurrentes(appointments, r),
    };
  }, [appointments, periodo, rangoGuardado, employees, services]);
  // Mismo criterio que `barrasDelPeriodo`: un periodo de un solo día va por horas.
  const porHoras = periodo === "hoy" || Math.round((+datos.rango.fin - +datos.rango.inicio) / 86_400_000) === 1;
  const totalServ = datos.servicios.reduce((t, x) => t + x.euros, 0);
  const maxVeces = Math.max(1, ...datos.servicios.map((x) => x.veces));
  const totalClientas = datos.clientas.nuevas + datos.clientas.recurrentes;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] md:text-[32px]">Analítica</h1>
          <p className="mt-1 text-muted-foreground">Calculada con tus propias reservas: no son predicciones.</p>
        </div>
        <div className="md:ml-auto">
          <BotonConPlan funcion="exportar" etiqueta="Exportar a Excel (CSV)">
            <ExportCsvButtons appointments={appointments} services={services} employees={employees} rango={datos.rango} />
          </BotonConPlan>
        </div>
      </div>

      <TarjetasPeriodo />

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-3 xl:group-data-[panel=abierto]/panel:grid-cols-1">
        <Tarjeta className="xl:col-span-2 xl:group-data-[panel=abierto]/panel:col-span-1" titulo={porHoras ? "Citas por hora" : "Citas por día"} sub={datos.etiqueta}>
          <GraficaBarras barras={datos.barras} />
        </Tarjeta>

        <Tarjeta titulo="Ocupación por profesional" sub="Minutos reservados sobre su jornada">
          <div className="space-y-3.5">
            {datos.ocupacion.map(({ e, pct, citas }, i) => (
              <div key={e.id}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2 font-bold">
                    <span className="grid size-6 place-items-center rounded-full text-[10px] font-extrabold" style={{ background: `var(--stylist-${["mario", "diego", "ruben"][i % 3]})` }}>{e.name[0]}</span>
                    {e.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums"><b className="text-foreground">{pct} %</b> · {citas} citas</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-nata"><i className="block h-full rounded-full bg-hoja" style={{ width: `${pct}%` }} /></div>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Servicios más pedidos" sub="Veces y parte de los ingresos">
          {datos.servicios.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">No hay ninguna cita en este periodo.</p>
          ) : (
            <div className="space-y-3">
              {datos.servicios.map(({ sv, veces, euros }, i) => (
                <div key={sv.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-bold">{sv.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums"><b className="text-foreground">{veces}</b> · {eurRedondo(euros)} · {totalServ ? Math.round((euros / totalServ) * 100) : 0} %</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-nata"><i className="block h-full rounded-full" style={{ width: `${(veces / maxVeces) * 100}%`, background: i === 0 ? "var(--moca-fuerte)" : "var(--moca)" }} /></div>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Nuevas y recurrentes" sub="Clientas distintas que vinieron en el periodo">
          {totalClientas === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">Nadie vino en este periodo.</p>
          ) : (
            <div className="space-y-4">
              {([["Recurrentes", datos.clientas.recurrentes, "Ya habían venido antes"], ["Nuevas", datos.clientas.nuevas, "Su primera cita, en este periodo"]] as const).map(([t, n, d]) => (
                <div key={t}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span><b>{t}</b> <span className="text-[12.5px] text-muted-foreground">{d}</span></span>
                    <span className="tabular-nums"><b>{n}</b> <span className="text-muted-foreground">· {Math.round((n / totalClientas) * 100)} %</span></span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-nata"><i className="block h-full rounded-full bg-hoja" style={{ width: `${(n / totalClientas) * 100}%` }} /></div>
                </div>
              ))}
              <p className="text-[12.5px] text-muted-foreground tabular-nums">{totalClientas} clientas en total.</p>
            </div>
          )}
        </Tarjeta>

        {avanzada ? (
        <Tarjeta titulo="Lo que llama la atención" sub="Patrones de todo tu histórico">
          <ul className="-mx-5 -mb-5">
            {cards.map((c) => {
              const Icon = ICONS[c.icon as keyof typeof ICONS] ?? Sparkles;
              return (
                <li key={c.title} className="flex gap-3 border-t border-border px-5 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-nata text-primary"><Icon className="size-4" strokeWidth={1.6} /></span>
                  <div className="min-w-0">
                    <b className="block text-sm">{c.title}</b>
                    <p className="text-[12.5px] text-muted-foreground">{c.body}</p>
                    {/* Sin datos detrás, sin botón: ofrecer la acción que depende
                        de un patrón que no hay sería prometer lo que no hay. */}
                    {c.action && <ComingSoonAction label={c.action} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
        ) : (
          <LlegaConPlan funcion="analitica-avanzada" compacta />
        )}
      </div>

      {/* Consulta libre sobre los mismos datos, sin salir de la pantalla. */}
      <section className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-[20px] border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-extrabold tracking-[-0.01em]">Pregúntale a tus datos</h2>
          <p className="text-[12.5px] text-muted-foreground">Calcula sobre tus reservas: ingresos, ocupación, clientas, agenda. No es un modelo de lenguaje: si no sabe algo, lo dice.</p>
        </div>
        <AssistantPanel className="flex-1" />
      </section>
    </div>
  );
}

function Tarjeta({ titulo, sub, className, children }: { titulo: string; sub: string; className?: string; children: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-[20px] border border-border bg-card ${className ?? ""}`}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-5 py-4">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">{titulo}</h2>
        <span className="text-[12.5px] text-muted-foreground">{sub}</span>
      </div>
      <div className="flex-1 px-5 pb-5">{children}</div>
    </section>
  );
}

/**
 * Barras en SVG (DESIGN.md: una serie, moca; la destacada en moca fuerte;
 * extremos redondeados de 4 px anclados a la base; rejilla lino; valores en
 * café). Al pasar el ratón, cada barra dice su detalle.
 */
function GraficaBarras({ barras }: { barras: Barra[] }) {
  const W = 640;
  const H = 240;
  const izq = 28;
  const abajo = 26;
  const arriba = 18;
  const max = Math.max(1, ...barras.map((b) => b.valor));
  const paso = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const tope = Math.ceil(max / paso) * paso;
  const alto = H - abajo - arriba;
  const ancho = (W - izq) / Math.max(1, barras.length);
  const barra = Math.min(40, ancho * 0.62);
  const y = (v: number) => arriba + alto - (v / tope) * alto;
  const lineas = Array.from({ length: tope / paso + 1 }, (_, i) => i * paso);
  const valoresSiempre = barras.length <= 16;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full" role="img" aria-label={barras.map((b) => b.detalle).join(", ")}>
      {lineas.map((v) => (
        <g key={v}>
          <line x1={izq} x2={W} y1={y(v)} y2={y(v)} stroke="var(--lino)" strokeWidth={1} />
          <text x={izq - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--cafe-suave)" className="tabular-nums">{v}</text>
        </g>
      ))}
      {barras.map((b, i) => {
        const x = izq + i * ancho + (ancho - barra) / 2;
        const top = y(b.valor);
        const r = Math.min(4, (arriba + alto - top) / 2);
        const base = arriba + alto;
        const d = b.valor > 0 ? `M${x} ${base}V${top + r}q0 -${r} ${r} -${r}H${x + barra - r}q${r} 0 ${r} ${r}V${base}Z` : "";
        return (
          <g key={b.etiqueta + i} className="group">
            <title>{b.detalle}</title>
            <rect x={izq + i * ancho} y={arriba} width={ancho} height={alto} fill="transparent" />
            {d && <path d={d} fill={b.destacada ? "var(--moca-fuerte)" : "var(--moca)"} className="transition-opacity group-hover:opacity-80" />}
            {b.valor > 0 && (
              <text x={x + barra / 2} y={top - 5} textAnchor="middle" fontSize={11.5} fontWeight={800} fill="var(--cafe)" className={valoresSiempre ? "tabular-nums" : "tabular-nums opacity-0 group-hover:opacity-100"}>
                {b.valor}
              </text>
            )}
            <text x={x + barra / 2} y={H - 8} textAnchor="middle" fontSize={11} fontWeight={b.destacada ? 800 : 600} fill={b.destacada ? "var(--cafe)" : "var(--cafe-suave)"}>
              {barras.length > 16 && i % 2 === 1 && !b.destacada ? "" : b.etiqueta}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
