import { employees, serviceMap } from "./mock/salon";
import type { Appointment, Employee } from "./mock/types";

const DAY_MS = 86400_000;

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function todayKpis(appts: Appointment[]) {
  const now = new Date();
  const today = appts.filter((a) => isSameDay(new Date(a.start), now) && a.status !== "cancelled");
  const revenue = today
    .filter((a) => a.status !== "no-show")
    .reduce((sum, a) => sum + a.priceEur, 0);
  return {
    count: today.length,
    revenue,
    next: today
      .filter((a) => new Date(a.start) >= now)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0],
  };
}

export function weeklyOccupancy(appts: Appointment[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  const inWeek = appts.filter((a) => {
    const d = new Date(a.start);
    return d >= start && d <= now && a.status !== "cancelled";
  });
  const totalSlots = employees.reduce((sum, e) => {
    return sum + e.schedule.reduce((s, day) => s + (day ? day.end - day.start : 0), 0) * 2;
  }, 0); // 2 per hour
  const used = inWeek.reduce((s, a) => s + a.duration / 30, 0);
  return Math.min(100, Math.round((used / totalSlots) * 100));
}

export function newClientsThisWeek(appts: Appointment[]) {
  const now = new Date();
  const start = +new Date(now.getTime() - 7 * DAY_MS);
  const ids = new Set<string>();
  appts.forEach((a) => {
    if (+new Date(a.start) >= start) ids.add(a.clientId);
  });
  // Mock "new" as ~30% of weekly clients
  return Math.ceil(ids.size * 0.3);
}

export function cancellationsThisWeek(appts: Appointment[]) {
  const start = Date.now() - 7 * DAY_MS;
  return appts.filter((a) => a.status === "cancelled" && +new Date(a.start) >= start).length;
}

export function mostBookedService(appts: Appointment[]) {
  const counts: Record<string, number> = {};
  appts.forEach((a) => {
    if (a.status === "cancelled") return;
    a.serviceIds.forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? (serviceMap[top[0]]?.name ?? top[0]) : "—";
}

export function revenueByDay(appts: Appointment[], days = 30) {
  const out: { date: string; revenue: number; bookings: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
    const dayAppts = appts.filter(
      (a) => isSameDay(new Date(a.start), d) && a.status !== "cancelled" && a.status !== "no-show",
    );
    out.push({
      date: label,
      revenue: dayAppts.reduce((s, a) => s + a.priceEur, 0),
      bookings: dayAppts.length,
    });
  }
  return out;
}

export function serviceMix(appts: Appointment[]) {
  const counts: Record<string, { name: string; bookings: number; revenue: number }> = {};
  appts.forEach((a) => {
    if (a.status === "cancelled") return;
    const own = a.serviceIds.map((id) => serviceMap[id]).filter(Boolean);
    if (!own.length) return;
    // El precio de la cita es la suma de sus servicios; se reparte entre ellos
    // en proporción a su precio de catálogo para que la facturación por
    // servicio siga cuadrando con la total aunque la cita lleve varios.
    const catalogo = own.reduce((s, sv) => s + sv.priceEur, 0);
    own.forEach((s) => {
      if (!counts[s.id]) counts[s.id] = { name: s.name, bookings: 0, revenue: 0 };
      counts[s.id].bookings += 1;
      counts[s.id].revenue += catalogo > 0 ? (a.priceEur * s.priceEur) / catalogo : 0;
    });
  });
  return Object.values(counts).sort((a, b) => b.bookings - a.bookings);
}

/**
 * ¿Cuenta esta cita como una visita que OCURRIÓ?
 *
 * Una cancelada no ocurrió, un plantón tampoco (llegó la hora, no la persona)
 * y `blocked` no es un cliente. Lo demás, si ya pasó, sí: el salón no va
 * marcando "completada" una por una, así que exigir ese estado dejaría la
 * última visita casi siempre vacía.
 */
function cuentaComoVisita(a: Appointment): boolean {
  return a.status !== "cancelled" && a.status !== "no-show" && a.status !== "blocked";
}

export function clientFrequency(appts: Appointment[], clientId: string, now: Date = new Date()) {
  const ahora = now.getTime();
  const own = appts
    .filter((a) => a.clientId === clientId && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const totalSpent = own.filter((a) => a.status !== "no-show").reduce((s, a) => s + a.priceEur, 0);
  const fav: Record<string, number> = {};
  own.forEach((a) => a.serviceIds.forEach((id) => (fav[id] = (fav[id] ?? 0) + 1)));
  const favoriteService = Object.entries(fav).sort((a, b) => b[1] - a[1])[0]?.[0];

  // "Última visita" es la última cita PASADA que además cuenta como visita.
  // Antes era `own[own.length - 1]`: el último elemento de la lista ordenada
  // ascendente, futuras incluidas. En una ficha con cita para la semana que
  // viene, "Última visita" enseñaba esa fecha futura — y es justo el dato con
  // el que se decide a quién hay que reactivar.
  const pasadas = own.filter((a) => +new Date(a.start) <= ahora && cuentaComoVisita(a));
  const futuras = own.filter((a) => +new Date(a.start) > ahora && a.status !== "no-show");

  return {
    visits: own.length,
    /** Visitas que ya ocurrieron de verdad — sin futuras ni plantones. */
    pastVisits: pasadas.length,
    totalSpent,
    favoriteService: favoriteService ? serviceMap[favoriteService]?.name : "—",
    lastVisit: pasadas[pasadas.length - 1]?.start,
    /** La próxima cita que tiene puesta, si tiene alguna. */
    nextVisit: futuras[0]?.start,
  };
}

/**
 * Cuánto tardó de verdad la última vez que este cliente vino a por estos
 * mismos servicios.
 *
 * María (PeluChic) lo dijo tal cual: «el tiempo de cada cita lo decido yo».
 * A una clienta el mismo corte le lleva 75 minutos y a otra 45, y el catálogo
 * solo conoce el número de la carta. Esto mira lo que pasó de verdad y lo
 * propone — nunca lo impone.
 *
 * Devuelve `null` si no hay historial con esa misma combinación de servicios,
 * o si la última vez tardó exactamente lo del catálogo: no hay nada que decir.
 */
export function duracionRecordada(
  appts: Appointment[],
  clientId: string | undefined,
  serviceIds: string[],
  duracionDeCatalogo: number,
  now: Date = new Date(),
): { minutos: number; cuando: string } | null {
  if (!clientId || serviceIds.length === 0) return null;
  const clave = [...serviceIds].sort().join(",");
  const ahora = now.getTime();
  const previas = appts
    .filter(
      (a) =>
        a.clientId === clientId &&
        +new Date(a.start) <= ahora &&
        cuentaComoVisita(a) &&
        [...a.serviceIds].sort().join(",") === clave,
    )
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const ultima = previas[previas.length - 1];
  if (!ultima) return null;
  if (ultima.duration === duracionDeCatalogo) return null;
  return { minutos: ultima.duration, cuando: ultima.start };
}

/** Profesional con más clientes que repiten (dos o más citas con la misma persona). */
function loyaltyChampion(appts: Appointment[], employees: Employee[]) {
  // "El que más fideliza del equipo" no existe si el equipo es una persona:
  // sería compararla consigo misma. En un salón de un solo profesional la
  // tarjeta dice que no hay nada que comparar (ver aiInsights).
  if (employees.length < 2) return null;
  const byEmp = new Map<string, Map<string, number>>();
  for (const a of appts) {
    if (a.status === "cancelled") continue;
    const m = byEmp.get(a.employeeId) ?? new Map<string, number>();
    m.set(a.clientId, (m.get(a.clientId) ?? 0) + 1);
    byEmp.set(a.employeeId, m);
  }
  let best: { name: string; pct: number } | null = null;
  for (const e of employees) {
    const m = byEmp.get(e.id);
    if (!m || m.size < 3) continue;
    const repeat = [...m.values()].filter((n) => n >= 2).length;
    const pct = Math.round((repeat / m.size) * 100);
    if (!best || pct > best.pct) best = { name: e.name, pct };
  }
  return best;
}

/**
 * Mínimo de citas pasadas para que una media signifique algo. Por debajo de
 * esto la analítica dice que no hay datos en vez de inventarse un número.
 */
export const MIN_CITAS_PARA_ANALIZAR = 10;
/** Y de clientes distintos: una media de "cada cuánto vuelven" con 2 personas no es una media. */
export const MIN_CLIENTES_PARA_ANALIZAR = 5;

/** Frase única para cuando no hay con qué calcular. Se repite a propósito: es la misma verdad. */
const SIN_DATOS = "Todavía no hay suficientes reservas para sacar un patrón de aquí.";

/** Citas pasadas que cuentan para analizar: ni canceladas, ni futuras, ni bloqueos. */
function citasAnalizables(appts: Appointment[], now: Date) {
  const ahora = now.getTime();
  return appts.filter(
    (a) => a.status !== "cancelled" && a.status !== "blocked" && +new Date(a.start) <= ahora,
  );
}

/**
 * Cada cuánto vuelve la gente, de media, y cuántos tocan esta semana.
 *
 * Se mide cliente a cliente: el hueco medio entre sus visitas pasadas. Solo
 * entran los que tienen 2 o más, porque con una visita no hay hueco que medir.
 * "Le toca esta semana" = su última visita más su propio hueco medio cae
 * dentro de los próximos 7 días y no tiene ya otra cita puesta.
 *
 * Devuelve `null` cuando no hay material suficiente — que es exactamente lo
 * que pasaba en el panel de Adam, con 1 cliente y un cartel que anunciaba
 * "5 tienen que volver esta semana".
 */
export function patronDeRegreso(
  appts: Appointment[],
  now: Date = new Date(),
): { semanasMedia: number; tocanEstaSemana: number } | null {
  const ahora = now.getTime();
  const pasadas = citasAnalizables(appts, now).filter((a) => a.status !== "no-show");
  const porCliente = new Map<string, number[]>();
  for (const a of pasadas) {
    if (!a.clientId) continue;
    const lista = porCliente.get(a.clientId) ?? [];
    lista.push(+new Date(a.start));
    porCliente.set(a.clientId, lista);
  }
  if (pasadas.length < MIN_CITAS_PARA_ANALIZAR) return null;
  if (porCliente.size < MIN_CLIENTES_PARA_ANALIZAR) return null;

  const conCitaFutura = new Set(
    appts
      .filter((a) => +new Date(a.start) > ahora && a.status !== "cancelled")
      .map((a) => a.clientId),
  );

  const huecos: number[] = [];
  let tocanEstaSemana = 0;
  for (const [clientId, fechas] of porCliente) {
    if (fechas.length < 2) continue;
    fechas.sort((x, y) => x - y);
    const propios: number[] = [];
    for (let i = 1; i < fechas.length; i++) propios.push(fechas[i] - fechas[i - 1]);
    const medio = propios.reduce((s, n) => s + n, 0) / propios.length;
    huecos.push(medio);
    const toca = fechas[fechas.length - 1] + medio;
    if (!conCitaFutura.has(clientId) && toca >= ahora - WEEK_MS && toca <= ahora + WEEK_MS) {
      tocanEstaSemana += 1;
    }
  }
  if (huecos.length < 3) return null;

  const medioGlobal = huecos.reduce((s, n) => s + n, 0) / huecos.length;
  return { semanasMedia: Math.max(1, Math.round(medioGlobal / WEEK_MS)), tocanEstaSemana };
}

/**
 * La franja más floja de la semana, medida de verdad: se cuentan las citas
 * pasadas por (día de la semana × mañana/tarde) y gana la que menos tiene,
 * siempre que haya con qué comparar.
 *
 * Antes esto era un `Math.max(20, ...)` sobre los martes por la tarde: aunque
 * el salón no hubiera abierto nunca un martes, la tarjeta anunciaba un 20%.
 */
export function franjaMasFloja(
  appts: Appointment[],
  now: Date = new Date(),
): { dia: string; franja: string; citas: number } | null {
  const pasadas = citasAnalizables(appts, now);
  if (pasadas.length < MIN_CITAS_PARA_ANALIZAR) return null;

  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const conteo = new Map<string, number>();
  const vistos = new Set<string>();
  for (const a of pasadas) {
    const d = new Date(a.start);
    const clave = `${d.getDay()}|${d.getHours() < 14 ? "mañana" : "tarde"}`;
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    vistos.add(clave);
  }
  // Con una sola franja abierta no hay "la más floja": no hay con qué comparar.
  if (vistos.size < 3) return null;

  const [clave, citas] = [...conteo.entries()].sort((a, b) => a[1] - b[1])[0];
  const [dia, franja] = clave.split("|");
  return { dia: DIAS[Number(dia)], franja, citas };
}

export function aiInsights(
  appts: Appointment[],
  employees: Employee[] = [],
  now: Date = new Date(),
) {
  const champion = loyaltyChampion(appts, employees);
  const mix = serviceMix(appts);
  const totalRev = mix.reduce((s, m) => s + m.revenue, 0);
  const topService = totalRev > 0 ? mix[0] : undefined;
  const topPct = topService ? Math.round((topService.revenue / totalRev) * 100) : 0;
  const floja = franjaMasFloja(appts, now);
  const regreso = patronDeRegreso(appts, now);

  // `action: null` cuando la tarjeta no tiene datos detrás. Un botón
  // "Generar promo para esa franja" debajo de un texto que acaba de decir que
  // no se sabe cuál es la franja floja no lleva a ningún sitio: la pantalla
  // ofrecía una acción que ella misma se había desmentido una línea antes.
  return [
    {
      icon: "trending-down",
      tone: "warning" as const,
      title: floja ? "Tu franja más floja" : "Franja más floja",
      body: floja
        ? `Los ${floja.dia} por la ${floja.franja} son la franja con menos citas de tu semana: ${floja.citas} en todo el histórico.`
        : SIN_DATOS,
      action: floja ? "Generar promo para esa franja" : null,
    },
    {
      icon: "sparkles",
      tone: "primary" as const,
      title: "Servicio estrella",
      body: topService
        ? `${topService.name} genera el ${topPct} % de la facturación de todo tu histórico.`
        : SIN_DATOS,
      action: topService ? "Ver desglose de servicios" : null,
    },
    {
      icon: "heart",
      tone: "success" as const,
      title: employees.length < 2 ? "Clientes que repiten" : "Campeón en fidelización",
      body: champion
        ? `${champion.name} tiene la mayor tasa de clientes que repiten del equipo — ${champion.pct}% vuelven.`
        : employees.length < 2
          ? "Trabajas solo: no hay a quién comparar. Mira la ficha de cada cliente para ver quién repite."
          : "Todavía no hay suficientes clientes con dos visitas como para comparar al equipo.",
      // Esta sí se sostiene siempre: la lista de clientes existe haya o no
      // campeón, y es exactamente lo que el texto invita a mirar.
      action: champion ? `Ver clientes de ${champion.name}` : "Ver clientes",
    },
    {
      icon: "calendar-clock",
      tone: "primary" as const,
      title: "Patrón de reserva recurrente",
      body: regreso
        ? `Tus clientes vuelven cada ${regreso.semanasMedia} ${regreso.semanasMedia === 1 ? "semana" : "semanas"} de media. ${
            regreso.tocanEstaSemana === 0
              ? "Ninguno tiene que volver esta semana."
              : `${regreso.tocanEstaSemana} ${regreso.tocanEstaSemana === 1 ? "tendría" : "tendrían"} que volver esta semana y no ${regreso.tocanEstaSemana === 1 ? "tiene" : "tienen"} cita puesta.`
          }`
        : SIN_DATOS,
      action: regreso ? "Enviar recordatorio de reserva" : null,
    },
  ];
}

/* ---------------------------------------------------------------------------
 * KPI trends: current value vs. the equivalent previous period, plus a short
 * sparkline series. Purely additive — todayKpis/weeklyOccupancy/etc. above
 * are left untouched since other pages already depend on their exact shape.
 * ------------------------------------------------------------------------- */

export interface KpiTrend {
  /** Current-period value (e.g. today, or the last 7 days). */
  current: number;
  /** Same-length period immediately before the current one, for comparison. */
  previous: number;
  /** % change vs. previous. `null` when previous was 0 and there's nothing to compare against. */
  deltaPct: number | null;
  /** Short series (oldest → newest) for a sparkline, same unit as `current`. */
  spark: number[];
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** Non-cancelled appointment count + revenue for the single calendar day containing `date`. */
function dayCountAndRevenue(appts: Appointment[], date: Date) {
  const dayAppts = appts.filter(
    (a) => isSameDay(new Date(a.start), date) && a.status !== "cancelled",
  );
  const revenue = dayAppts
    .filter((a) => a.status !== "no-show")
    .reduce((sum, a) => sum + a.priceEur, 0);
  return { count: dayAppts.length, revenue };
}

/** Booking-count trend: today vs. yesterday, with an 8-day daily sparkline. */
export function appointmentsTodayTrend(appts: Appointment[]): KpiTrend {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const spark: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    spark.push(dayCountAndRevenue(appts, d).count);
  }
  const current = dayCountAndRevenue(appts, now).count;
  const previous = dayCountAndRevenue(appts, yesterday).count;
  return { current, previous, deltaPct: pctChange(current, previous), spark };
}

/** Revenue trend: today vs. yesterday, with an 8-day daily sparkline. */
export function revenueTodayTrend(appts: Appointment[]): KpiTrend {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const spark: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    spark.push(dayCountAndRevenue(appts, d).revenue);
  }
  const current = dayCountAndRevenue(appts, now).revenue;
  const previous = dayCountAndRevenue(appts, yesterday).revenue;
  return { current, previous, deltaPct: pctChange(current, previous), spark };
}

const WEEK_MS = 7 * DAY_MS;

/** Total bookable half-hour slots per week across the team — mirrors weeklyOccupancy's denominator. */
function weeklyCapacitySlots() {
  return employees.reduce(
    (sum, e) => sum + e.schedule.reduce((s, day) => s + (day ? day.end - day.start : 0), 0) * 2,
    0,
  );
}

function occupancyPct(appts: Appointment[], start: number, end: number) {
  const inRange = appts.filter((a) => {
    const t = +new Date(a.start);
    return t >= start && t < end && a.status !== "cancelled";
  });
  const totalSlots = weeklyCapacitySlots();
  const used = inRange.reduce((s, a) => s + a.duration / 30, 0);
  return totalSlots > 0 ? Math.min(100, Math.round((used / totalSlots) * 100)) : 0;
}

/** Weekly occupancy trend: last 7 days vs. the 7 days before that, with an 8-week sparkline. */
export function weeklyOccupancyTrend(appts: Appointment[]): KpiTrend {
  const now = Date.now();
  const spark: number[] = [];
  for (let i = 7; i >= 0; i--) {
    spark.push(occupancyPct(appts, now - (i + 1) * WEEK_MS, now - i * WEEK_MS));
  }
  const current = occupancyPct(appts, now - WEEK_MS, now);
  const previous = occupancyPct(appts, now - 2 * WEEK_MS, now - WEEK_MS);
  return { current, previous, deltaPct: pctChange(current, previous), spark };
}

function newClientsInRange(appts: Appointment[], start: number, end: number) {
  const ids = new Set<string>();
  appts.forEach((a) => {
    const t = +new Date(a.start);
    if (t >= start && t < end) ids.add(a.clientId);
  });
  // Mirrors newClientsThisWeek's "new" mock heuristic (~30% of weekly clients).
  return Math.ceil(ids.size * 0.3);
}

/** New-clients trend: this week vs. last week, with an 8-week sparkline. */
export function newClientsTrend(appts: Appointment[]): KpiTrend {
  const now = Date.now();
  const spark: number[] = [];
  for (let i = 7; i >= 0; i--) {
    spark.push(newClientsInRange(appts, now - (i + 1) * WEEK_MS, now - i * WEEK_MS));
  }
  const current = newClientsInRange(appts, now - WEEK_MS, now);
  const previous = newClientsInRange(appts, now - 2 * WEEK_MS, now - WEEK_MS);
  return { current, previous, deltaPct: pctChange(current, previous), spark };
}

function cancellationsInRange(appts: Appointment[], start: number, end: number) {
  return appts.filter(
    (a) => a.status === "cancelled" && +new Date(a.start) >= start && +new Date(a.start) < end,
  ).length;
}

/**
 * Cancellations trend: this week vs. last week, with an 8-week sparkline.
 * Note for callers: unlike the other KPIs, going UP is bad news here — don't
 * color/sign this one automatically off deltaPct, branch on the metric.
 */
export function cancellationsTrend(appts: Appointment[]): KpiTrend {
  const now = Date.now();
  const spark: number[] = [];
  for (let i = 7; i >= 0; i--) {
    spark.push(cancellationsInRange(appts, now - (i + 1) * WEEK_MS, now - i * WEEK_MS));
  }
  const current = cancellationsInRange(appts, now - WEEK_MS, now);
  const previous = cancellationsInRange(appts, now - 2 * WEEK_MS, now - WEEK_MS);
  return { current, previous, deltaPct: pctChange(current, previous), spark };
}
