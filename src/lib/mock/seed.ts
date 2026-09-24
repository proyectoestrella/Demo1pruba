import { employees as defaultEmployees, services as defaultServices } from "./salon";
import { recargoActivo } from "../recargo-activo";
import type { Appointment, Client, Employee, EmployeeId, Service, WaitlistEntry } from "./types";
import {
  FIRST_NAMES_BY_TYPE,
  LAST_NAMES,
  withExampleNotes,
  type BusinessType,
} from "../business-type";

// Deterministic pseudo-random
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cuántos días atrás se sitúa el plantón del cliente sembrado, y su hueco en la lista (0-based). */
const PENALIZED_CLIENT_INDEX = 2;
const PENALIZED_DAYS_AGO = 5;
/** Teléfono estable y fácil de teclear en la tablet delante del cliente — ver demo-profile.ts. */
export const PENALIZED_CLIENT_PHONE = "+34 600 000 007";

/**
 * Segundo cliente sembrado con recargo pendiente, esta vez por llegar tarde
 * en vez de por no presentarse — para que la demo enseñe los dos motivos
 * (RecargosPendientes.tsx) sin depender de que Tomás genere el caso a mano.
 */
const LATE_PENALIZED_CLIENT_INDEX = 3;
const LATE_PENALIZED_DAYS_AGO = 2;
const LATE_PENALIZED_MINUTES = 20;
export const LATE_PENALIZED_CLIENT_PHONE = "+34 600 000 008";

function buildClients(type: BusinessType, penalizedFeeEur?: number): Client[] {
  const rand = mulberry32(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const FIRST = FIRST_NAMES_BY_TYPE[type];

  const clients: Client[] = Array.from({ length: 52 }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = pick(LAST_NAMES);
    const daysAgo = Math.floor(rand() * 400);
    return {
      id: `c${i + 1}`,
      name: `${first} ${last}`,
      phone: `+34 6${String(10 + i).padStart(2, "0")} ${String(100 + Math.floor(rand() * 800)).padStart(3, "0")} ${String(100 + Math.floor(rand() * 800)).padStart(3, "0")}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@mail.com`,
      createdAt: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
    };
  });

  const withNotes = withExampleNotes(clients, type);

  // Con la política de plantón activa (q > 0 en el enlace de demo), el 3er
  // cliente de la lista se marca con una penalización pendiente — así en 20 s
  // se puede enseñar el rojo en Clientes y, con SU teléfono, el bloqueo en la
  // reserva pública. Se le fuerza también el teléfono a uno fácil de teclear
  // (+34 600 000 007): un número aleatorio del seed vale para enseñar la
  // ficha, pero no para que Tomás lo teclee delante de un cliente.
  if (recargoActivo({ noShowFeeEur: penalizedFeeEur })) {
    const fechaNoShow = new Date(Date.now() - PENALIZED_DAYS_AGO * 86400_000).toLocaleDateString(
      "es",
      { day: "numeric", month: "long" },
    );
    const fechaTarde = new Date(
      Date.now() - LATE_PENALIZED_DAYS_AGO * 86400_000,
    ).toLocaleDateString("es", { day: "numeric", month: "long" });
    return withNotes.map((c, i) => {
      if (i === PENALIZED_CLIENT_INDEX) {
        return {
          ...c,
          phone: PENALIZED_CLIENT_PHONE,
          penaltyEur: penalizedFeeEur,
          penaltyNote: `No se presentó el ${fechaNoShow} · Corte`,
          penaltyReason: "no_show" as const,
        };
      }
      if (i === LATE_PENALIZED_CLIENT_INDEX) {
        return {
          ...c,
          phone: LATE_PENALIZED_CLIENT_PHONE,
          penaltyEur: penalizedFeeEur,
          penaltyNote: `Llegó tarde el ${fechaTarde} · Corte`,
          penaltyReason: "late" as const,
          penaltyLateMinutes: LATE_PENALIZED_MINUTES,
        };
      }
      return c;
    });
  }

  return withNotes;
}

/**
 * Clienta sembrada cuando el salón tiene `duracionFlexible` activo ("la
 * duración final la decide el salón" — commit 7be115a): trae una cita pasada
 * cuya duración real se disparó sobre la de catálogo, más una solicitud
 * pendiente de ese mismo servicio, para que `duracionRecordada()` (ver
 * lib/derive.ts) pueda avisar en el bloque de solicitudes sin que Tomás
 * tenga que sembrarlo a mano cada vez que cambia de dispositivo.
 */
export const DURACION_FLEXIBLE_CLIENT_NAME = "Marisol Iglesias";
export const DURACION_FLEXIBLE_CLIENT_PHONE = "+34 600 000 009";
const DURACION_FLEXIBLE_DAYS_AGO = 7;
/** Cuánto se dispara la duración real sobre la de catálogo (dentro del 40-60% pedido). */
const DURACION_FLEXIBLE_FACTOR = 1.47;

function isoAt(daysFromToday: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Con el reparto de agenda activo (`smartSpread`), sesga la hora de inicio
 * dentro del horario del profesional: nada en 10–11 (la franja floja que
 * Cardedal quiere ofrecer por teléfono) y el cuádruple de peso en 12–13 (la
 * franja "por seguridad" que todo el mundo pide) frente al resto. Solo se usa
 * en los días objetivo (hoy y el próximo sábado) — el resto de la agenda
 * sigue exactamente igual que sin la función activada.
 */
function pickSpreadStartHour(sched: { start: number; end: number }, rand: () => number): number {
  const pool: number[] = [];
  for (let h = sched.start; h < sched.end; h++) {
    if (h === 10 || h === 11) continue;
    const weight = h === 12 || h === 13 ? 4 : 1;
    for (let w = 0; w < weight; w++) pool.push(h);
  }
  if (pool.length === 0) return sched.start + Math.floor(rand() * (sched.end - sched.start - 1));
  return pool[Math.floor(rand() * pool.length)];
}

function buildAppointments(
  type: BusinessType,
  clients: Client[],
  employees: Employee[],
  services: Service[],
  smartSpread?: boolean,
): Appointment[] {
  const rand = mulberry32(1042);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const out: Appointment[] = [];
  let nextId = 1;
  // Próximo sábado (0 si hoy ya lo es): junto con "hoy" (day === 0), son los
  // dos días que la demo carga a propósito para que "Cómo va el día" y la
  // reserva pública cuenten la misma historia sin esperar a que pase una semana.
  const nextSaturdayOffset = (6 - new Date().getDay() + 7) % 7;
  // Un par de solicitudes "de hoy" sin revisar, para que la franja de
  // pendientes del panel no aparezca vacía en la demo. Determinista: no
  // depende de qué tipo de negocio esté activo.
  let pendingHoyAsignados = 0;

  // Reparto de clientes pensado para que las campañas de marketing tengan a
  // quién dirigirse (ver lib/campanas.ts): los 40 primeros son la clientela
  // habitual; los 8 últimos solo tienen citas de hace más de 6 semanas
  // («clientes que no vuelven»); los 4 de en medio se añaden a mano al final
  // con una única cita reciente («segunda visita»). Con 52 clientes y ~1.000
  // citas al azar nadie llegaba a estar cinco semanas sin venir.
  const habituales = clients.slice(0, 40);
  const dormidos = clients.slice(48);
  const primeraVisita = clients.slice(40, 48);
  const DIAS_DORMIDO = 42;

  // Spread across last 90 days + next 21
  for (let day = -90; day <= 21; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    const weekday = date.getDay();

    // Día objetivo del reparto de agenda: hoy o el próximo sábado (ver arriba).
    const isSpreadDay = !!smartSpread && (day === 0 || day === nextSaturdayOffset);

    for (const emp of employees) {
      const sched = emp.schedule[weekday];
      if (!sched) continue;

      // 3-7 bookings per day per stylist, lower on Tuesday/Wednesday afternoons for insight
      let count = Math.floor(rand() * 4) + 3;
      if (weekday === 2) count = Math.max(2, count - 2); // Tuesday low
      if (day > 14) count = Math.max(1, count - 2); // sparser future
      // Más citas en el día objetivo: sin esto, sesgar 12-14 a base de mover
      // huecos que ya existían dejaría el día igual de flojo en total, solo
      // que reordenado — hace falta densidad real para que la franja salga
      // ocupada de verdad, no solo etiquetada.
      if (isSpreadDay) count = Math.min(sched.end - sched.start, count + 2);

      const slotsUsed: number[] = [];
      for (let i = 0; i < count; i++) {
        // Una de cada cinco citas lleva un segundo servicio ("corte y luego
        // barba"): así la demo enseña la suma de tiempo y precio sin buscarla.
        const service = pick(services);
        const extra = rand() < 0.2 ? pick(services.filter((s) => s.id !== service.id)) : undefined;
        const chosen = extra ? [service, extra] : [service];
        const durationMin = chosen.reduce((s, sv) => s + sv.durationMin, 0);
        const priceEur = chosen.reduce((s, sv) => s + sv.priceEur, 0);
        const durationSlots = Math.ceil(durationMin / 30);

        let startHour = isSpreadDay
          ? pickSpreadStartHour(sched, rand)
          : sched.start + Math.floor(rand() * (sched.end - sched.start - 1));
        let attempts = 0;
        while (slotsUsed.some((u) => Math.abs(u - startHour) < durationSlots / 2) && attempts < 5) {
          startHour = isSpreadDay
            ? pickSpreadStartHour(sched, rand)
            : sched.start + Math.floor(rand() * (sched.end - sched.start - 1));
          attempts++;
        }
        slotsUsed.push(startHour);

        const minute = rand() < 0.5 ? 0 : 30;
        const client = day < -DIAS_DORMIDO ? pick([...habituales, ...dormidos]) : pick(habituales);

        let status: Appointment["status"] = "confirmed";
        if (day < 0) {
          const r = rand();
          if (r < 0.08) status = "no-show";
          else if (r < 0.13) status = "cancelled";
          else status = "completed";
        } else if (day === 0 && i <= 1 && pendingHoyAsignados < 3) {
          // Llegó de la web pública y el salón todavía no la ha revisado.
          status = "pending";
          pendingHoyAsignados++;
        }

        out.push({
          id: `a${nextId++}`,
          clientId: client.id,
          clientName: client.name,
          serviceIds: chosen.map((sv) => sv.id),
          employeeId: emp.id as EmployeeId,
          start: isoAt(day, startHour, minute),
          duration: durationMin,
          priceEur,
          status,
          ...(type === "peluqueria" && day < 0 && i === 0 && client.id < "c9" ? {
            colorFormula: ["7.1 + 8.0 al 50 %, oxidante 20 vol, 35 min", "6.3 raíz, 8.1 medios y puntas, 30 min", "Baño de color 7.13, 20 vol, 25 min"][nextId % 3],
            technicalNotes: "Matizar puntas al final y revisar porosidad.",
          } : {}),
        });
      }
    }
  }

  // Una sola cita, ya pasada, por cada cliente de primera visita: entre hace
  // una y siete semanas, repartidas entre el equipo, a una hora en que todos
  // trabajan.
  primeraVisita.forEach((client, i) => {
    const emp = employees[i % employees.length];
    const service = services[i % services.length];
    out.push({
      id: `a${nextId++}`,
      clientId: client.id,
      clientName: client.name,
      serviceIds: [service.id],
      employeeId: emp.id as EmployeeId,
      start: isoAt(-(7 + i * 6), 12, 0),
      duration: service.durationMin,
      priceEur: service.priceEur,
      status: "completed",
    });
  });

  return out;
}

/**
 * Cuatro entradas fijas de lista de espera. Los ids de servicio ("corte",
 * "corte-barba", "barba", "afeitado") son de los que existen en los cuatro
 * catálogos de ejemplo — ver `business-type.ts` — así que resuelven a un
 * nombre válido sea cual sea el tipo activo. Los nombres de pila salen de la
 * lista del tipo (los cuatro primeros): en una barbería «corte y barba» o
 * «afeitado» no pueden ir a nombre de mujer.
 *
 * Cuando el enlace trae una carta o un equipo reales (`servicesForType`/
 * `employeesForType` con overrides) esos ids fijos pueden no existir: se
 * sustituyen por los primeros de la carta/equipo activos, nunca por un id
 * inexistente que dejaría el nombre del servicio o del profesional en blanco.
 */
function buildWaitlist(
  type: BusinessType,
  employees: Employee[],
  services: Service[],
): WaitlistEntry[] {
  const FIRST = FIRST_NAMES_BY_TYPE[type];
  const nombre = (i: number, apellido: string) => `${FIRST[i % FIRST.length]} ${apellido}`;
  const serviceIds = new Set(services.map((s) => s.id));
  const resolveService = (preferido: string, i: number) =>
    serviceIds.has(preferido) ? preferido : (services[i % services.length]?.id ?? preferido);
  const employeeIds = new Set(employees.map((e) => e.id));
  const resolveEmployee = (preferido: EmployeeId | "any", i: number): EmployeeId | "any" =>
    preferido === "any" || employeeIds.has(preferido)
      ? preferido
      : (employees[i % employees.length]?.id ?? preferido);

  return [
    {
      id: "w1",
      clientName: nombre(0, "Vidal"),
      phone: "+34 611 111 222",
      serviceId: resolveService("corte-barba", 0),
      preferredEmployeeId: resolveEmployee("diego", 1),
      preferredRange: "Sábado por la mañana",
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
    },
    {
      id: "w2",
      clientName: nombre(1, "Sanz"),
      phone: "+34 622 333 444",
      serviceId: resolveService("corte", 1),
      preferredEmployeeId: "any",
      preferredRange: "Martes por la tarde",
      createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
    },
    {
      id: "w3",
      clientName: nombre(2, "Roca"),
      phone: "+34 633 555 666",
      serviceId: resolveService("afeitado", 2),
      preferredEmployeeId: resolveEmployee("ruben", 2),
      preferredRange: "Viernes a partir de las 17:00",
      createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    },
    {
      id: "w4",
      clientName: nombre(3, "Mora"),
      phone: "+34 644 777 888",
      serviceId: resolveService("barba", 3),
      preferredEmployeeId: resolveEmployee("mario", 0),
      preferredRange: "Cualquier día de esta semana",
      createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    },
  ];
}

/**
 * Añade la clienta y las dos citas de `duracionFlexible` (ver la constante de
 * arriba). Genérico: el servicio elegido es el de más minutos de LA CARTA
 * activa en esta demo, nunca un id fijo, así que funciona con cualquier tipo
 * de negocio o carta personalizada del enlace.
 */
function seedDuracionFlexible(
  clients: Client[],
  appointments: Appointment[],
  employees: Employee[],
  services: Service[],
): { clients: Client[]; appointments: Appointment[] } {
  const servicioLargo = [...services].sort((a, b) => b.durationMin - a.durationMin)[0];
  if (!servicioLargo || employees.length === 0) return { clients, appointments };

  const cliente: Client = {
    id: "c-duracion-flexible",
    name: DURACION_FLEXIBLE_CLIENT_NAME,
    phone: DURACION_FLEXIBLE_CLIENT_PHONE,
    createdAt: new Date(Date.now() - 200 * 86400_000).toISOString(),
  };

  const catalogoMin = servicioLargo.durationMin;
  const realMin = Math.round((catalogoMin * DURACION_FLEXIBLE_FACTOR) / 5) * 5;
  const emp = employees[0];

  const citaPasada: Appointment = {
    id: "a-duracion-flexible-pasada",
    clientId: cliente.id,
    clientName: cliente.name,
    serviceIds: [servicioLargo.id],
    employeeId: emp.id as EmployeeId,
    start: isoAt(-DURACION_FLEXIBLE_DAYS_AGO, 12, 0),
    duration: realMin,
    priceEur: servicioLargo.priceEur,
    status: "completed",
  };

  const solicitudPendiente: Appointment = {
    id: "a-duracion-flexible-pendiente",
    clientId: cliente.id,
    clientName: cliente.name,
    serviceIds: [servicioLargo.id],
    employeeId: emp.id as EmployeeId,
    start: isoAt(0, 17, 0),
    duration: catalogoMin,
    priceEur: servicioLargo.priceEur,
    status: "pending",
  };

  return {
    clients: [...clients, cliente],
    appointments: [...appointments, citaPasada, solicitudPendiente],
  };
}

export interface DemoSeed {
  clients: Client[];
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
}

/**
 * Genera clientes, citas y lista de espera coherentes con un tipo de negocio
 * y su equipo/catálogo activos. Determinista (misma semilla siempre) para
 * que la demo no cambie de una recarga a otra dentro del mismo tipo.
 *
 * `opts.noShowFeeEur` y `opts.smartSpread` vienen del perfil de la demo
 * (claves "q"/"k" del enlace — ver demo-profile.ts): cuando están activos,
 * el seed se ajusta para poder enseñar la función en el momento (cliente
 * penalizado, agenda cargada en 12–14) sin tocar nada a mano.
 *
 * `opts.duracionFlexible` (clave "df") añade la clienta y el par de citas de
 * `seedDuracionFlexible` para que el aviso de `duracionRecordada()` (ver
 * lib/derive.ts) salte solo en el bloque de solicitudes pendientes.
 */
export function buildSeed(
  type: BusinessType,
  employees: Employee[],
  services: Service[],
  opts?: { noShowFeeEur?: number; smartSpread?: boolean; duracionFlexible?: boolean },
): DemoSeed {
  const clients = buildClients(type, opts?.noShowFeeEur);
  let appointments = buildAppointments(type, clients, employees, services, opts?.smartSpread);
  let finalClients = clients;

  // Engancha cada recargo pendiente sembrado a una cita pasada real de ESE
  // cliente, para que RecargosPendientes y la vista de Citas puedan enseñar
  // su fecha y servicio en vez de solo el texto libre de la nota.
  if (recargoActivo({ noShowFeeEur: opts?.noShowFeeEur })) {
    linkSeededPenalty(clients[PENALIZED_CLIENT_INDEX], appointments, { status: "no-show" });
    linkSeededPenalty(clients[LATE_PENALIZED_CLIENT_INDEX], appointments, {
      status: "completed",
      lateMinutes: LATE_PENALIZED_MINUTES,
    });
  }

  if (opts?.duracionFlexible) {
    const conFlexible = seedDuracionFlexible(clients, appointments, employees, services);
    finalClients = conFlexible.clients;
    appointments = conFlexible.appointments;
  }

  return {
    clients: finalClients,
    appointments,
    waitlist: buildWaitlist(type, employees, services),
  };
}

/**
 * Toma la cita pasada más reciente de este cliente y la deja coherente con
 * su recargo pendiente sembrado (estado y, si llegó tarde, los minutos),
 * enlazándola desde `Client.penaltyAppointmentId`. Si el cliente no tiene
 * ninguna cita pasada (semilla muy corta), no hace nada — el recargo se
 * sigue viendo por su nota y su fecha, solo sin cita asociada.
 */
function linkSeededPenalty(
  client: Client | undefined,
  appointments: Appointment[],
  patch: { status: Appointment["status"]; lateMinutes?: number },
): void {
  if (!client) return;
  const now = Date.now();
  const propia = appointments
    .filter((a) => a.clientId === client.id && +new Date(a.start) < now)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start));
  const cita = propia[0];
  if (!cita) return;
  cita.status = patch.status;
  if (patch.lateMinutes) cita.lateMinutes = patch.lateMinutes;
  client.penaltyAppointmentId = cita.id;
}

const DEFAULT_SEED = buildSeed("barberia", defaultEmployees, defaultServices);

export const clients: Client[] = DEFAULT_SEED.clients;
export const seedAppointments: Appointment[] = DEFAULT_SEED.appointments;
export const seedWaitlist: WaitlistEntry[] = DEFAULT_SEED.waitlist;
