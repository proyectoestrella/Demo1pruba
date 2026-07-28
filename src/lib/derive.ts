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
