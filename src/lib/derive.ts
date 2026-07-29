import { employees, serviceMap } from "./mock/salon";
import type { Appointment } from "./mock/types";

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
    return (
      sum +
      e.schedule.reduce((s, day) => s + (day ? day.end - day.start : 0), 0) * 2
    );
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
  return appts.filter(
    (a) => a.status === "cancelled" && +new Date(a.start) >= start,
  ).length;
}

export function mostBookedService(appts: Appointment[]) {
  const counts: Record<string, number> = {};
  appts.forEach((a) => {
    if (a.status === "cancelled") return;
    counts[a.serviceId] = (counts[a.serviceId] ?? 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? serviceMap[top[0]]?.name ?? top[0] : "—";
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
    const s = serviceMap[a.serviceId];
    if (!s) return;
    if (!counts[a.serviceId]) counts[a.serviceId] = { name: s.name, bookings: 0, revenue: 0 };
    counts[a.serviceId].bookings += 1;
    counts[a.serviceId].revenue += a.priceEur;
  });
  return Object.values(counts).sort((a, b) => b.bookings - a.bookings);
}

export function clientFrequency(
  appts: Appointment[],
  clientId: string,
) {
  const own = appts
    .filter((a) => a.clientId === clientId && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const totalSpent = own
    .filter((a) => a.status !== "no-show")
    .reduce((s, a) => s + a.priceEur, 0);
  const fav: Record<string, number> = {};
  own.forEach((a) => (fav[a.serviceId] = (fav[a.serviceId] ?? 0) + 1));
  const favoriteService = Object.entries(fav).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    visits: own.length,
    totalSpent,
    favoriteService: favoriteService ? serviceMap[favoriteService]?.name : "—",
    lastVisit: own[own.length - 1]?.start,
  };
}

export function aiInsights(appts: Appointment[]) {
  const mix = serviceMix(appts);
  const totalRev = mix.reduce((s, m) => s + m.revenue, 0);
  const topService = mix[0];
  const topPct = topService ? Math.round((topService.revenue / totalRev) * 100) : 0;

  // Tuesday afternoon occupancy
  const tueAfternoons = appts.filter((a) => {
    const d = new Date(a.start);
    return d.getDay() === 2 && d.getHours() >= 14 && a.status !== "cancelled";
  });
  const tueOcc = Math.max(20, Math.min(45, Math.round((tueAfternoons.length / 40) * 100)));

  return [
    {
      icon: "trending-down",
      tone: "warning" as const,
      title: "Low occupancy window detected",
      body: `Tuesday afternoons run at ${tueOcc}% occupancy — your lowest window of the week.`,
      action: "Generate Tuesday promo",
    },
    {
      icon: "sparkles",
      tone: "primary" as const,
      title: "Top revenue driver",
      body: topService
        ? `${topService.name} generates ${topPct}% of total revenue this period.`
        : "Not enough data yet.",
      action: "View service breakdown",
    },
    {
      icon: "heart",
      tone: "success" as const,
      title: "Retention champion",
      body: "Luna has the highest client retention on the team — 78% rebooking rate.",
      action: "See Luna's clients",
    },
    {
      icon: "calendar-clock",
      tone: "primary" as const,
      title: "Rebooking pattern",
      body: "Keratin clients return on average every 8 weeks. 5 are due this week.",
      action: "Send rebooking nudge",
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
  const dayAppts = appts.filter((a) => isSameDay(new Date(a.start), date) && a.status !== "cancelled");
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
