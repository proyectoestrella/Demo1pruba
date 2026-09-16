/**
 * Motor de respuestas del asistente del panel.
 *
 * IMPORTANTE: esto NO es un modelo de lenguaje. Es un buscador de intenciones
 * por palabras clave que responde con los números reales del salón (las mismas
 * funciones de `derive.ts` que alimentan los KPIs). Se presenta así al usuario
 * en la interfaz — ver AssistantPanel.tsx — para no vender IA que no hay.
 *
 * Vive separado de la UI para poder probarlo: `bun test`.
 */
import type { Appointment, Client, Employee, Service, WaitlistEntry } from "./mock/types";
import {
  cancellationsTrend,
  clientFrequency,
  isSameDay,
  mostBookedService,
  newClientsTrend,
  revenueByDay,
  revenueTodayTrend,
  serviceMix,
  weeklyOccupancyTrend,
} from "./derive";

export interface SalonContext {
  appointments: Appointment[];
  services: Service[];
  employees: Employee[];
  waitlist: WaitlistEntry[];
  /** Cartera de clientes — para inactividad, altas del mes, nuevos vs. recurrentes. */
  clients: Client[];
  salonName: string;
  /**
   * Instante de referencia para las intenciones que se calculan en este
   * módulo (próxima cita, franja floja, facturación por barbero). Ojo: las
   * que delegan en `derive.ts` — ingresos, ocupación, cancelaciones — usan
   * siempre el reloj real, porque esas funciones no aceptan una fecha.
   */
  now?: Date;
}

const DAY_MS = 86400_000;

const eur = (n: number) => `${Math.round(n).toLocaleString("es")} €`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}%`;
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false });
const dmes = (iso: string) =>
  new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Normaliza para comparar: minúsculas y sin tildes. */
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function activeToday(appts: Appointment[], now: Date) {
  return appts
    .filter((a) => isSameDay(new Date(a.start), now) && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

/**
 * Franja (día de la semana × mañana/tarde) con menos o más reservas de las
 * últimas 8 semanas, ignorando las franjas en las que no abre nadie.
 * `dir: "weak"` busca el mínimo (hueco para promocionar); `"strong"` el
 * máximo (la hora punta que conviene no tocar).
 */
function rankedSlot(
  appts: Appointment[],
  employees: Employee[],
  now: Date,
  dir: "weak" | "strong",
) {
  const since = +now - 56 * DAY_MS;
  const counts = new Map<string, number>();

  for (let day = 0; day < 7; day++) {
    const open = employees.some((e) => e.schedule[day]);
    if (!open) continue;
    counts.set(`${day}|manana`, 0);
    counts.set(`${day}|tarde`, 0);
  }

  for (const a of appts) {
    if (a.status === "cancelled") continue;
    const d = new Date(a.start);
    if (+d < since || +d > +now) continue;
    const key = `${d.getDay()}|${d.getHours() < 14 ? "manana" : "tarde"}`;
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }

  const entries = [...counts.entries()];
  if (!entries.length) return null;
  const sorted = entries.sort((a, b) => (dir === "weak" ? a[1] - b[1] : b[1] - a[1]));
  const [key, count] = sorted[0];
  const [day, part] = key.split("|");
  return {
    label: `${WEEKDAYS[Number(day)]} por la ${part === "manana" ? "mañana" : "tarde"}`,
    count,
  };
}

function revenueByEmployee(appts: Appointment[], employees: Employee[], since: number) {
  return employees
    .map((e) => ({
      name: e.name,
      revenue: appts
        .filter(
          (a) =>
            a.employeeId === e.id &&
            a.status !== "cancelled" &&
            a.status !== "no-show" &&
            +new Date(a.start) >= since,
        )
        .reduce((s, a) => s + a.priceEur, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Ocupación de los últimos 7 días, por profesional (mismo cálculo que weeklyOccupancy pero desglosado). */
function occupancyByEmployee(appts: Appointment[], employees: Employee[], now: Date) {
  const start = +now - 7 * DAY_MS;
  return employees
    .map((e) => {
      const capacitySlots = e.schedule.reduce((s, d) => s + (d ? (d.end - d.start) * 2 : 0), 0);
      const used = appts
        .filter(
          (a) =>
            a.employeeId === e.id &&
            a.status !== "cancelled" &&
            +new Date(a.start) >= start &&
            +new Date(a.start) <= +now,
        )
        .reduce((s, a) => s + a.duration / 30, 0);
      const rate = capacitySlots > 0 ? Math.min(100, Math.round((used / capacitySlots) * 100)) : 0;
      return { name: e.name, rate };
    })
    .sort((a, b) => b.rate - a.rate);
}

/** Ingresos del mes calendario que empieza `monthsAgo` meses antes del actual, en huso local. */
function calendarMonthRevenue(appts: Appointment[], now: Date, monthsAgo: number) {
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);
  return appts
    .filter((a) => {
      const t = +new Date(a.start);
      return t >= +start && t < +end && a.status !== "cancelled" && a.status !== "no-show";
    })
    .reduce((s, a) => s + a.priceEur, 0);
}

/** Cuántos clientes distintos han reservado (no cancelada) y cuántos de ellos vuelven (2+ citas). */
function newVsReturning(appts: Appointment[]) {
  const visits = new Map<string, number>();
  for (const a of appts) {
    if (a.status === "cancelled") continue;
    visits.set(a.clientId, (visits.get(a.clientId) ?? 0) + 1);
  }
  const total = visits.size;
  const returning = [...visits.values()].filter((v) => v >= 2).length;
  return { total, returning, oneOff: total - returning };
}

/** Clientes con al menos una visita pero sin volver en `days` días. */
function inactiveClients(appts: Appointment[], clients: Client[], now: Date, days = 45) {
  const cutoff = +now - days * DAY_MS;
  return clients
    .map((c) => ({ client: c, freq: clientFrequency(appts, c.id) }))
    .filter(({ freq }) => freq.visits > 0 && (!freq.lastVisit || +new Date(freq.lastVisit) < cutoff))
    .sort((a, b) => +new Date(a.freq.lastVisit ?? 0) - +new Date(b.freq.lastVisit ?? 0));
}

function topClient(appts: Appointment[]) {
  const spend = new Map<string, { name: string; total: number; visits: number }>();
  for (const a of appts) {
    if (a.status === "cancelled" || a.status === "no-show") continue;
    const prev = spend.get(a.clientId) ?? { name: a.clientName, total: 0, visits: 0 };
    spend.set(a.clientId, {
      name: a.clientName,
      total: prev.total + a.priceEur,
      visits: prev.visits + 1,
    });
  }
  return [...spend.values()].sort((a, b) => b.total - a.total)[0] ?? null;
}

type Intent = { keywords: string[]; answer: (ctx: Required<SalonContext>) => string };

/**
 * Se evalúan en orden y gana la primera con alguna palabra clave presente, así
 * que las intenciones más específicas van antes que las genéricas ("ingresos
 * por servicio" antes que "ingresos" a secas, "tasa de cancelación" antes que
 * "cancelación"). Los bloques están agrupados por tema para que sea fácil ver
 * dónde añadir una nueva pregunta sin romper el orden de prioridad.
 */
const INTENTS: Intent[] = [
  // --- Ingresos, desglosados ------------------------------------------------
  {
    keywords: [
      "ingresos por servicio",
      "desglose de servicios",
      "facturacion por servicio",
      "por servicio cuanto",
      "que servicio factura mas",
    ],
    answer: ({ appointments }) => {
      const mix = serviceMix(appointments);
      if (!mix.length) return "Todavía no hay ingresos que desglosar por servicio.";
      const total = mix.reduce((s, m) => s + m.revenue, 0);
      const lines = mix
        .slice(0, 5)
        .map((m) => `• ${m.name} — ${eur(m.revenue)} (${Math.round((m.revenue / total) * 100)}%)`);
      return [
        "Ingresos por servicio (histórico):",
        ...lines,
        "",
        `Recomendación: "${mix[0].name}" es tu mayor fuente de ingresos — cuida su disponibilidad en horas punta.`,
      ].join("\n");
    },
  },
  {
    keywords: [
      "servicio mas rentable por hora",
      "rentable por hora",
      "rentabilidad por hora",
      "que servicio rinde mas",
      "mejor servicio por minuto",
      "servicio que mas rinde",
    ],
    answer: ({ services }) => {
      const active = services.filter((s) => s.active !== false && s.durationMin > 0);
      if (!active.length) return "No hay servicios activos con los que calcular rentabilidad.";
      const ranked = active
        .map((s) => ({ name: s.name, perHour: (s.priceEur / s.durationMin) * 60 }))
        .sort((a, b) => b.perHour - a.perHour);
      const lines = ranked.slice(0, 5).map((r) => `• ${r.name} — ${eur(r.perHour)}/hora`);
      return [
        "Rentabilidad por hora de silla (precio ÷ duración):",
        ...lines,
        "",
        `Recomendación: prioriza "${ranked[0].name}" en los huecos más ajustados de agenda.`,
      ].join("\n");
    },
  },
  {
    keywords: [
      "mes anterior",
      "mes pasado",
      "comparado con el mes",
      "como va este mes",
      "vs mes pasado",
      "respecto al mes",
    ],
    answer: ({ appointments, now }) => {
      const current = calendarMonthRevenue(appointments, now, 0);
      const previous = calendarMonthRevenue(appointments, now, 1);
      const delta = previous === 0 ? null : ((current - previous) / previous) * 100;
      const deltaTxt = delta === null ? "sin mes anterior con el que comparar" : `${pct(delta)} respecto al mes pasado`;
      return `Este mes llevas ${eur(current)} (${deltaTxt}). El mes pasado cerraste en ${eur(previous)}.`;
    },
  },

  // --- Ocupación y horarios ---------------------------------------------------
  {
    keywords: [
      "ocupacion por profesional",
      "ocupacion de cada",
      "como va cada barbero",
      "como va cada profesional",
      "ocupacion de mario",
      "ocupacion de diego",
      "ocupacion de ruben",
      "carga de trabajo",
    ],
    answer: ({ appointments, employees, now }) => {
      const rows = occupancyByEmployee(appointments, employees, now);
      if (!rows.length) return "No hay profesionales dados de alta.";
      const lines = rows.map((r) => `• ${r.name} — ${r.rate}%`);
      return [
        "Ocupación de los últimos 7 días por profesional:",
        ...lines,
        "",
        `Recomendación: ${rows[rows.length - 1].name} tiene más hueco libre — buen candidato para nuevas reservas o una promoción.`,
      ].join("\n");
    },
  },
  {
    keywords: [
      "mejor dia",
      "mejor franja",
      "cuando hay mas gente",
      "dia mas fuerte",
      "hora punta",
      "franja fuerte",
    ],
    answer: ({ appointments, employees, now }) => {
      const strong = rankedSlot(appointments, employees, now, "strong");
      if (!strong) return "Todavía no hay reservas suficientes para detectar tu mejor franja.";
      return `Tu franja más fuerte es el ${strong.label}: ${strong.count} reserva${strong.count === 1 ? "" : "s"} en las últimas 8 semanas. Evita tocar horarios ahí.`;
    },
  },

  // --- Clientes -----------------------------------------------------------
  {
    keywords: [
      "clientes inactivos",
      "clientes estan inactivos",
      "clientes que no vuelven",
      "quien no ha vuelto",
      "clientes perdidos",
      "clientes que hace tiempo",
    ],
    answer: ({ appointments, clients, now }) => {
      const inactive = inactiveClients(appointments, clients, now, 45);
      if (!inactive.length) return "No hay clientes inactivos: todos han vuelto en los últimos 45 días.";
      const lines = inactive.slice(0, 5).map(({ client, freq }) => {
        const days = freq.lastVisit ? Math.round((+now - +new Date(freq.lastVisit)) / DAY_MS) : null;
        return `• ${client.name} — ${days === null ? "sin fecha" : `hace ${days} días`}`;
      });
      return [
        `${inactive.length} cliente${inactive.length === 1 ? "" : "s"} sin volver en más de 45 días:`,
        ...lines,
        "",
        "Recomendación: un mensaje personal a los primeros de la lista suele traerlos de vuelta.",
      ].join("\n");
    },
  },
  {
    keywords: [
      "nuevos vs recurrentes",
      "nuevos y recurrentes",
      "recurrencia de clientes",
      "cuantos son recurrentes",
      "clientes son recurrentes",
      "clientes que repiten",
    ],
    answer: ({ appointments }) => {
      const { total, returning, oneOff } = newVsReturning(appointments);
      if (!total) return "Todavía no hay clientes con citas registradas.";
      const ratePct = Math.round((returning / total) * 100);
      return `De ${total} clientes con citas, ${returning} repiten (${ratePct}%) y ${oneOff} han venido una sola vez. Cuanto más alto el porcentaje de recurrencia, menos dependes de captar gente nueva cada semana.`;
    },
  },

  // --- Cancelaciones y no-shows --------------------------------------------
  {
    keywords: [
      "tasa de cancelacion",
      "porcentaje de cancelacion",
      "tasa de no show",
      "no shows porcentaje",
      "tasa de plantones",
      "porcentaje de plantones",
    ],
    answer: ({ appointments }) => {
      const total = appointments.length;
      if (!total) return "Todavía no hay citas registradas con las que calcular una tasa.";
      const cancelled = appointments.filter((a) => a.status === "cancelled").length;
      const noShow = appointments.filter((a) => a.status === "no-show").length;
      const cancelPct = Math.round((cancelled / total) * 100);
      const noShowPct = Math.round((noShow / total) * 100);
      return `Sobre el total de citas: ${cancelPct}% canceladas (${cancelled}) y ${noShowPct}% no-show (${noShow}). ${
        cancelPct + noShowPct > 15
          ? "Está por encima del 15% combinado — vale la pena pedir confirmación el día antes."
          : "Se mantiene en un nivel saludable."
      }`;
    },
  },

  // --- Agenda ---------------------------------------------------------------
  {
    keywords: [
      "proximas citas",
      "agenda de los proximos dias",
      "que citas tengo esta semana",
      "citas de esta semana",
      "siguientes citas",
    ],
    answer: ({ appointments, now }) => {
      const end = +now + 7 * DAY_MS;
      const upcoming = appointments
        .filter((a) => a.status !== "cancelled" && +new Date(a.start) >= +now && +new Date(a.start) <= end)
        .sort((a, b) => +new Date(a.start) - +new Date(b.start));
      if (!upcoming.length) return "No hay citas en los próximos 7 días.";
      const lines = upcoming
        .slice(0, 6)
        .map((a) => `• ${dmes(a.start)} ${hhmm(a.start)} — ${a.clientName} (${eur(a.priceEur)})`);
      return [
        `${upcoming.length} cita${upcoming.length === 1 ? "" : "s"} en los próximos 7 días:`,
        ...lines,
        ...(upcoming.length > 6 ? [`… y ${upcoming.length - 6} más.`] : []),
      ].join("\n");
    },
  },
  {
    keywords: ["proxima cita", "siguiente cita", "quien viene ahora", "quien viene despues"],
    answer: ({ appointments, now }) => {
      const next = activeToday(appointments, now).find((a) => new Date(a.start) >= now);
      if (!next) return "No queda ninguna cita por delante hoy.";
      return `La próxima es a las ${hhmm(next.start)}: ${next.clientName} — ${eur(next.priceEur)}.`;
    },
  },
  {
    keywords: ["citas hoy", "cuantas citas", "agenda de hoy", "cuantos clientes hoy", "citas tengo hoy"],
    answer: ({ appointments, now }) => {
      const list = activeToday(appointments, now);
      if (!list.length) return "Hoy no hay ninguna cita en la agenda.";
      const pend = list.filter((a) => new Date(a.start) >= now).length;
      return `Hoy tienes ${list.length} cita${list.length === 1 ? "" : "s"}: de ${hhmm(list[0].start)} a ${hhmm(
        list[list.length - 1].start,
      )}. Quedan ${pend} por delante.`;
    },
  },

  // --- Recomendación general --------------------------------------------------
  {
    keywords: ["recomendacion", "que deberia hacer", "dame un consejo", "que puedo mejorar", "consejo para hoy"],
    answer: ({ appointments, employees, clients, now }) => {
      const weak = rankedSlot(appointments, employees, now, "weak");
      const inactive = inactiveClients(appointments, clients, now, 45);
      const mix = serviceMix(appointments);
      const bits: string[] = [];
      if (weak) bits.push(`lanza una promo el ${weak.label}, es tu franja más floja`);
      if (inactive.length) bits.push(`escribe a los ${Math.min(3, inactive.length)} clientes que llevan más sin volver`);
      if (mix.length) bits.push(`asegura hueco para "${mix[0].name}", es tu servicio estrella`);
      if (!bits.length) return "Todavía no hay datos suficientes para una recomendación con criterio.";
      return ["Tres cosas con las que empezaría hoy:", ...bits.map((b, i) => `${i + 1}. ${b[0].toUpperCase()}${b.slice(1)}.`)].join("\n");
    },
  },

  // --- Genéricos ya existentes (se mantienen como red de seguridad) -------
  {
    keywords: ["ingresos", "facturacion", "facturado", "cuanto he ganado", "dinero", "caja", "cuanto llevo"],
    answer: ({ appointments }) => {
      const t = revenueTodayTrend(appointments);
      const month = revenueByDay(appointments, 30).reduce((s, d) => s + d.revenue, 0);
      const delta =
        t.deltaPct === null
          ? "sin dato de ayer para comparar"
          : `${Math.round(t.deltaPct) > 0 ? "+" : ""}${Math.round(t.deltaPct)}% respecto a ayer`;
      return `Hoy llevas ${eur(t.current)} (${delta}). En los últimos 30 días: ${eur(month)}.`;
    },
  },
  {
    keywords: ["ocupacion", "lleno", "hueco libre", "cuanto lleno", "agenda llena"],
    answer: ({ appointments }) => {
      const t = weeklyOccupancyTrend(appointments);
      const delta =
        t.deltaPct === null
          ? "no hay semana anterior con la que comparar"
          : `${Math.round(t.deltaPct) > 0 ? "+" : ""}${Math.round(t.deltaPct)}% respecto a la semana pasada`;
      return `La ocupación de los últimos 7 días es del ${Math.round(t.current)}% (${delta}). Se calcula sobre los huecos de media hora que el equipo tiene abiertos.`;
    },
  },
  {
    keywords: [
      "hueco flojo",
      "franja floja",
      "franja mas floja",
      "peor dia",
      "peor franja",
      "cuando hay menos",
      "dia flojo",
      "mas flojo",
    ],
    answer: ({ appointments, employees, now }) => {
      const weak = rankedSlot(appointments, employees, now, "weak");
      if (!weak) return "Todavía no hay reservas suficientes para detectar una franja floja.";
      return `Tu franja más floja es el ${weak.label}: ${weak.count} reserva${weak.count === 1 ? "" : "s"} en las últimas 8 semanas. Es la mejor candidata para una promoción.`;
    },
  },
  {
    keywords: ["servicio estrella", "servicio mas", "que servicio", "mas pedido", "mas vendido"],
    answer: ({ appointments }) => {
      const mix = serviceMix(appointments);
      if (!mix.length) return "Todavía no hay reservas de las que sacar un servicio estrella.";
      const total = mix.reduce((s, m) => s + m.revenue, 0);
      const top = mix[0];
      return `${top.name}: ${top.bookings} reservas y ${eur(top.revenue)}, un ${Math.round(
        (top.revenue / total) * 100,
      )}% de la facturación. El más pedido en número de citas es ${mostBookedService(appointments)}.`;
    },
  },
  {
    keywords: ["cancelacion", "cancelan", "no show", "no se presenta", "plantones"],
    answer: ({ appointments }) => {
      const t = cancellationsTrend(appointments);
      const noShows = appointments.filter((a) => a.status === "no-show").length;
      return `Esta semana van ${t.current} cancelacion${t.current === 1 ? "" : "es"} (la anterior fueron ${t.previous}). En total hay ${noShows} cita${noShows === 1 ? "" : "s"} marcadas como no presentada.`;
    },
  },
  {
    keywords: ["cliente nuevo", "clientes nuevos", "captacion"],
    answer: ({ appointments }) => {
      const t = newClientsTrend(appointments);
      return `Estimación de clientes nuevos esta semana: ${t.current} (la semana pasada, ${t.previous}). Ojo: sale de una heurística sobre los clientes de la semana, no de un registro real de altas.`;
    },
  },
  {
    keywords: ["mejor cliente", "quien gasta", "cliente que mas"],
    answer: ({ appointments }) => {
      const top = topClient(appointments);
      if (!top) return "Todavía no hay historial de gasto por cliente.";
      return `${top.name} es quien más ha dejado en caja: ${eur(top.total)} en ${top.visits} visitas.`;
    },
  },
  {
    keywords: ["equipo", "barbero", "quien factura", "mario", "diego", "ruben"],
    answer: ({ appointments, employees, now }) => {
      const rows = revenueByEmployee(appointments, employees, +now - 30 * 86400_000);
      if (!rows.length) return "No hay barberos dados de alta.";
      return `Facturación por barbero en los últimos 30 días: ${rows
        .map((r) => `${r.name} ${eur(r.revenue)}`)
        .join(" · ")}.`;
    },
  },
  {
    keywords: ["lista de espera", "espera", "waitlist"],
    answer: ({ waitlist }) => {
      if (!waitlist.length) return "La lista de espera está vacía.";
      return `Hay ${waitlist.length} persona${waitlist.length === 1 ? "" : "s"} en lista de espera. La más antigua es ${waitlist[0].clientName} (${waitlist[0].preferredRange}).`;
    },
  },
  {
    keywords: ["precio", "cuanto cuesta", "tarifa", "cuanto vale"],
    answer: ({ services }) => {
      const active = services.filter((s) => s.active !== false);
      if (!active.length) return "No hay servicios activos en el catálogo.";
      return `Tarifas actuales: ${active
        .map((s) => `${s.name} ${eur(s.priceEur)} (${s.durationMin} min)`)
        .join(" · ")}.`;
    },
  },
];

/** Lo que el asistente sabe hacer, mostrado como sugerencias agrupadas por tema y como fallback. */
export const SUGGESTION_GROUPS: { topic: string; items: string[] }[] = [
  {
    topic: "Ingresos",
    items: [
      "¿Cuánto he facturado hoy?",
      "¿Cuáles son mis ingresos por servicio?",
      "¿Cómo va este mes comparado con el anterior?",
    ],
  },
  {
    topic: "Ocupación",
    items: [
      "¿Cómo va la ocupación?",
      "¿Cómo va la ocupación de cada profesional?",
      "¿Cuál es mi franja más floja?",
      "¿Cuál es mi mejor franja?",
    ],
  },
  {
    topic: "Clientes",
    items: ["¿Qué clientes están inactivos?", "¿Cuántos clientes son recurrentes?"],
  },
  {
    topic: "Agenda",
    items: [
      "¿Qué citas tengo hoy?",
      "¿Cuáles son mis próximas citas?",
      "¿Cuál es mi tasa de cancelaciones?",
    ],
  },
  {
    topic: "Rentabilidad y estrategia",
    items: ["¿Qué servicio es más rentable por hora?", "Dame una recomendación para hoy"],
  },
];

/** Versión plana de SUGGESTION_GROUPS, para el mensaje de fallback y por compatibilidad. */
export const SUGGESTIONS: readonly string[] = SUGGESTION_GROUPS.flatMap((g) => g.items);

/**
 * Devuelve la respuesta a `question` con los datos de `ctx`.
 * Si no reconoce la pregunta, lo dice y ofrece lo que sí sabe responder.
 */
export function answerFor(question: string, ctx: SalonContext): string {
  const q = norm(question);
  const full: Required<SalonContext> = { ...ctx, now: ctx.now ?? new Date() };

  const hit = INTENTS.find((intent) => intent.keywords.some((k) => q.includes(norm(k))));
  if (hit) return hit.answer(full);

  return [
    "No sé responder a eso — solo consulto los datos de tu propio salón, no invento.",
    "",
    "Puedo hablarte de ingresos (totales, por servicio, por mes), ocupación (global o por profesional), franjas fuertes y flojas, clientes (nuevos, recurrentes, inactivos, quién gasta más), cancelaciones y no-shows, agenda de hoy y próxima, lista de espera, tarifas o una recomendación para hoy.",
  ].join("\n");
}
