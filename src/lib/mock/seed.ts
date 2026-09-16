import { employees as defaultEmployees, services as defaultServices } from "./salon";
import type { Appointment, Client, Employee, EmployeeId, Service, WaitlistEntry } from "./types";
import { FIRST_NAMES_BY_TYPE, LAST_NAMES, withExampleNotes, type BusinessType } from "../business-type";

// Deterministic pseudo-random
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildClients(type: BusinessType): Client[] {
  const rand = mulberry32(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
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

  return withExampleNotes(clients, type);
}

function isoAt(daysFromToday: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildAppointments(
  clients: Client[],
  employees: Employee[],
  services: Service[],
): Appointment[] {
  const rand = mulberry32(1042);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const out: Appointment[] = [];
  let nextId = 1;
  // Un par de solicitudes "de hoy" sin revisar, para que la franja de
  // pendientes del panel no aparezca vacía en la demo. Determinista: no
  // depende de qué tipo de negocio esté activo.
  let pendingHoyAsignados = 0;

  // Spread across last 90 days + next 21
  for (let day = -90; day <= 21; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    const weekday = date.getDay();

    for (const emp of employees) {
      const sched = emp.schedule[weekday];
      if (!sched) continue;

      // 3-7 bookings per day per stylist, lower on Tuesday/Wednesday afternoons for insight
      let count = Math.floor(rand() * 4) + 3;
      if (weekday === 2) count = Math.max(2, count - 2); // Tuesday low
      if (day > 14) count = Math.max(1, count - 2); // sparser future

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

        let startHour = sched.start + Math.floor(rand() * (sched.end - sched.start - 1));
        let attempts = 0;
        while (slotsUsed.some((u) => Math.abs(u - startHour) < durationSlots / 2) && attempts < 5) {
          startHour = sched.start + Math.floor(rand() * (sched.end - sched.start - 1));
          attempts++;
        }
        slotsUsed.push(startHour);

        const minute = rand() < 0.5 ? 0 : 30;
        const client = pick(clients);

        let status: Appointment["status"] = "confirmed";
        if (day < 0) {
          const r = rand();
          if (r < 0.08) status = "no-show";
          else if (r < 0.13) status = "cancelled";
          else status = "completed";
        } else if (day === 0 && i === 0 && pendingHoyAsignados < 2) {
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
        });
      }
    }
  }
  return out;
}

/**
 * Cuatro entradas fijas de lista de espera. Los ids de servicio ("corte",
 * "corte-barba", "barba", "afeitado") son de los que existen en los cuatro
 * catálogos — ver `business-type.ts` — así que resuelven a un nombre válido
 * sea cual sea el tipo activo, y los nombres de ejemplo son suficientemente
 * neutros para cualquier tipo de salón.
 */
function buildWaitlist(): WaitlistEntry[] {
  return [
    {
      id: "w1",
      clientName: "Marta Vidal",
      phone: "+34 611 111 222",
      serviceId: "corte-barba",
      preferredEmployeeId: "diego",
      preferredRange: "Sat morning",
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
    },
    {
      id: "w2",
      clientName: "Pedro Sanz",
      phone: "+34 622 333 444",
      serviceId: "corte",
      preferredEmployeeId: "any",
      preferredRange: "Tue afternoon",
      createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
    },
    {
      id: "w3",
      clientName: "Aitana Roca",
      phone: "+34 633 555 666",
      serviceId: "afeitado",
      preferredEmployeeId: "ruben",
      preferredRange: "Fri after 17:00",
      createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    },
    {
      id: "w4",
      clientName: "Iker Mora",
      phone: "+34 644 777 888",
      serviceId: "barba",
      preferredEmployeeId: "mario",
      preferredRange: "Anytime this week",
      createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    },
  ];
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
 */
export function buildSeed(type: BusinessType, employees: Employee[], services: Service[]): DemoSeed {
  const clients = buildClients(type);
  return {
    clients,
    appointments: buildAppointments(clients, employees, services),
    waitlist: buildWaitlist(),
  };
}

const DEFAULT_SEED = buildSeed("barberia", defaultEmployees, defaultServices);

export const clients: Client[] = DEFAULT_SEED.clients;
export const seedAppointments: Appointment[] = DEFAULT_SEED.appointments;
export const seedWaitlist: WaitlistEntry[] = DEFAULT_SEED.waitlist;
