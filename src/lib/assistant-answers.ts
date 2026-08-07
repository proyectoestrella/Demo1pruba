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
import type { Appointment, Employee, Service, WaitlistEntry } from "./mock/types";
import {
  cancellationsTrend,
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
  salonName: string;
  /**
   * Instante de referencia para las intenciones que se calculan en este
   * módulo (próxima cita, franja floja, facturación por barbero). Ojo: las
   * que delegan en `derive.ts` — ingresos, ocupación, cancelaciones — usan
   * siempre el reloj real, porque esas funciones no aceptan una fecha.
   */
  now?: Date;
}

const eur = (n: number) => `${Math.round(n).toLocaleString("es")} €`;
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false });

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Normaliza para comparar: minúsculas y sin tildes. */
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function activeToday(appts: Appointment[], now: Date) {
  return appts
    .filter((a) => isSameDay(new Date(a.start), now) && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

/**
 * Franja (día de la semana × mañana/tarde) con menos reservas de las últimas
 * 8 semanas, ignorando las franjas en las que no abre nadie.
 */
function weakestSlot(appts: Appointment[], employees: Employee[], now: Date) {
  const since = +now - 56 * 86400_000;
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
  const [key, count] = entries.sort((a, b) => a[1] - b[1])[0];
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
 * que las intenciones más específicas van antes que las genéricas
 * ("cuánto he facturado esta semana" antes que "ingresos").
 */
const INTENTS: Intent[] = [
  {
    keywords: ["proxima cita", "siguiente cita", "quien viene ahora", "quien viene despues"],
    answer: ({ appointments, now }) => {
      const next = activeToday(appointments, now).find((a) => new Date(a.start) >= now);
      if (!next) return "No queda ninguna cita por delante hoy.";
      return `La próxima es a las ${hhmm(next.start)}: ${next.clientName} — ${eur(next.priceEur)}.`;
    },
  },
  {
    keywords: ["citas hoy", "cuantas citas", "agenda de hoy", "cuantos clientes hoy"],
    answer: ({ appointments, now }) => {
      const list = activeToday(appointments, now);
      if (!list.length) return "Hoy no hay ninguna cita en la agenda.";
      const pend = list.filter((a) => new Date(a.start) >= now).length;
      return `Hoy tienes ${list.length} cita${list.length === 1 ? "" : "s"}: de ${hhmm(list[0].start)} a ${hhmm(
        list[list.length - 1].start,
      )}. Quedan ${pend} por delante.`;
    },
  },
  {
    keywords: ["ingresos", "facturacion", "facturado", "cuanto he ganado", "dinero", "caja"],
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
    keywords: ["ocupacion", "lleno", "hueco libre", "cuanto lleno"],
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
      "peor dia",
      "peor franja",
      "cuando hay menos",
      "dia flojo",
      "mas flojo",
    ],
    answer: ({ appointments, employees, now }) => {
      const weak = weakestSlot(appointments, employees, now);
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

/** Lo que el asistente sabe hacer, mostrado como sugerencias y como fallback. */
export const SUGGESTIONS = [
  "¿Cuánto he facturado hoy?",
  "¿Cuál es mi franja más floja?",
  "¿Cuál es mi servicio estrella?",
  "¿Cómo va la ocupación?",
] as const;

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
    "Puedes preguntarme por ingresos, ocupación, citas de hoy, servicio estrella, cancelaciones, clientes nuevos, lista de espera, tarifas o facturación por barbero.",
  ].join("\n");
}
