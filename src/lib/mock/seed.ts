import { employees, services } from "./salon";
import type { Appointment, Client, EmployeeId, WaitlistEntry } from "./types";

// Deterministic pseudo-random
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const FIRST = ["Sofia", "Lucia", "Mateo", "Diego", "Carmen", "Alejandro", "Valentina", "Pablo", "Elena", "Hugo", "Martina", "Bruno", "Adriana", "Nicolas", "Camila", "Javier", "Paula", "Marcos", "Daniela", "Andres", "Isabella", "Tomas", "Renata", "Emilio"];
const LAST = ["Garcia", "Lopez", "Martin", "Ruiz", "Vega", "Torres", "Romero", "Castillo", "Navarro", "Iglesias", "Serrano", "Mendoza", "Reyes", "Ortega", "Delgado", "Cortes"];

export const clients: Client[] = Array.from({ length: 52 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = pick(LAST);
  const daysAgo = Math.floor(rand() * 400);
  return {
    id: `c${i + 1}`,
    name: `${first} ${last}`,
    phone: `+34 6${String(10 + i).padStart(2, "0")} ${String(100 + Math.floor(rand() * 800)).padStart(3, "0")} ${String(100 + Math.floor(rand() * 800)).padStart(3, "0")}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@mail.com`,
    createdAt: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
  };
});

function isoAt(daysFromToday: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function genAppointments(): Appointment[] {
  const out: Appointment[] = [];
  let nextId = 1;

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
        const service = pick(services);
        const durationSlots = Math.ceil(service.durationMin / 30);

        let startHour = sched.start + Math.floor(rand() * (sched.end - sched.start - 1));
        let attempts = 0;
        while (
          slotsUsed.some((u) => Math.abs(u - startHour) < durationSlots / 2) &&
          attempts < 5
        ) {
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
        }

        out.push({
          id: `a${nextId++}`,
          clientId: client.id,
          clientName: client.name,
          serviceId: service.id,
          employeeId: emp.id as EmployeeId,
          start: isoAt(day, startHour, minute),
          duration: service.durationMin,
          priceEur: service.priceEur,
          status,
        });
      }
    }
  }
  return out;
}

export const seedAppointments: Appointment[] = genAppointments();

export const seedWaitlist: WaitlistEntry[] = [
  { id: "w1", clientName: "Marta Vidal", phone: "+34 611 111 222", serviceId: "highlights", preferredEmployeeId: "manuela", preferredRange: "Sat morning", createdAt: new Date(Date.now() - 86400_000).toISOString() },
  { id: "w2", clientName: "Pedro Sanz", phone: "+34 622 333 444", serviceId: "haircut", preferredEmployeeId: "any", preferredRange: "Tue afternoon", createdAt: new Date(Date.now() - 2 * 86400_000).toISOString() },
  { id: "w3", clientName: "Aitana Roca", phone: "+34 633 555 666", serviceId: "keratin", preferredEmployeeId: "luna", preferredRange: "Fri after 17:00", createdAt: new Date(Date.now() - 3 * 86400_000).toISOString() },
  { id: "w4", clientName: "Iker Mora", phone: "+34 644 777 888", serviceId: "beard", preferredEmployeeId: "ines", preferredRange: "Anytime this week", createdAt: new Date(Date.now() - 5 * 86400_000).toISOString() },
];
