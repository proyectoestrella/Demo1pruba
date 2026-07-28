import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { seedAppointments, seedWaitlist, clients as seedClients } from "./mock/seed";
import { serviceMap, employeeMap, services as seedServices, salon } from "./mock/salon";
import type {
  Appointment,
  Client,
  WaitlistEntry,
  EmployeeId,
  Service,
  SalonProfile,
} from "./mock/types";

interface SalonState {
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
  clients: Client[];
  services: Service[];
  salonProfile: SalonProfile;

  // Appointments
  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  cancelAppointment: (id: string) => void;
  deleteAppointment: (id: string) => void;

  // Waitlist
  addWaitlist: (w: Omit<WaitlistEntry, "id" | "createdAt">) => void;
  updateWaitlist: (id: string, patch: Partial<WaitlistEntry>) => void;
  deleteWaitlist: (id: string) => void;

  // Clients
  addClient: (c: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Services (moved from static salon.ts array to reactive store state)
  addService: (s: Omit<Service, "id">) => Service;
  updateService: (id: string, patch: Partial<Service>) => void;
  deleteService: (id: string) => void;

  // Salon profile (Settings)
  updateSalonProfile: (patch: Partial<SalonProfile>) => void;
}

// Guarded storage: `localStorage` doesn't exist during SSR, so this
// no-ops on the server and only persists once hydrated in the browser —
// otherwise every dashboard edit (rename, service CRUD, etc.) would be
// lost on refresh, which is exactly what looked "broken" before.
const storage = createJSONStorage<SalonState>(() =>
  typeof window !== "undefined"
    ? window.localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
);

export const useSalonStore = create<SalonState>()(
  persist(
    (set) => ({
  appointments: seedAppointments,
  waitlist: seedWaitlist,
  clients: seedClients,
  services: seedServices,
  salonProfile: salon,

  addAppointment: (a) => {
    const appt: Appointment = { ...a, id: `a-new-${Date.now()}` };
    set((s) => ({ appointments: [...s.appointments, appt] }));
    return appt;
  },
  updateAppointment: (id, patch) =>
    set((s) => ({
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  cancelAppointment: (id) =>
    set((s) => ({
      appointments: s.appointments.map((a) =>
        a.id === id ? { ...a, status: "cancelled" } : a,
      ),
    })),
  deleteAppointment: (id) =>
    set((s) => ({
      appointments: s.appointments.filter((a) => a.id !== id),
    })),

  addWaitlist: (w) =>
    set((s) => ({
      waitlist: [
        ...s.waitlist,
        { ...w, id: `w-${Date.now()}`, createdAt: new Date().toISOString() },
      ],
    })),
  updateWaitlist: (id, patch) =>
    set((s) => ({
      waitlist: s.waitlist.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),
  deleteWaitlist: (id) =>
    set((s) => ({
      waitlist: s.waitlist.filter((w) => w.id !== id),
    })),

  addClient: (c) => {
    const client: Client = {
      ...c,
      id: `c-new-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ clients: [...s.clients, client] }));
    return client;
  },
  updateClient: (id, patch) =>
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  deleteClient: (id) =>
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
    })),

  addService: (svc) => {
    const service: Service = { ...svc, id: `svc-${Date.now()}` };
    set((s) => ({ services: [...s.services, service] }));
    return service;
  },
  updateService: (id, patch) =>
    set((s) => ({
      services: s.services.map((sv) => (sv.id === id ? { ...sv, ...patch } : sv)),
    })),
  deleteService: (id) =>
    set((s) => ({
      services: s.services.filter((sv) => sv.id !== id),
    })),

  updateSalonProfile: (patch) =>
    set((s) => ({ salonProfile: { ...s.salonProfile, ...patch } })),
    }),
    { name: "trimly-salon-store", storage },
  ),
);

// Derive helpers
export function isSlotTaken(
  appointments: Appointment[],
  employeeId: EmployeeId,
  startISO: string,
  durationMin: number,
) {
  const start = new Date(startISO).getTime();
  const end = start + durationMin * 60_000;
  return appointments.some((a) => {
    if (a.employeeId !== employeeId) return false;
    if (a.status === "cancelled" || a.status === "no-show") return false;
    const aStart = new Date(a.start).getTime();
    const aEnd = aStart + a.duration * 60_000;
    return start < aEnd && end > aStart;
  });
}

/**
 * Builds a lookup map (by id) from a live `services` array, e.g.:
 *   const services = useSalonStore((s) => s.services);
 *   const serviceMap = selectServiceMap(services);
 * Use this instead of the static `serviceMap` re-export below whenever the
 * page needs services created/edited/deleted at runtime (e.g. app.services).
 */
export function selectServiceMap(services: Service[]): Record<string, Service> {
  return Object.fromEntries(services.map((sv) => [sv.id, sv]));
}

// Static re-exports kept for backward compatibility with pages that still read
// services/serviceMap directly from mock/salon.ts (initial seed data only —
// NOT reactive to store mutations). New/updated pages should prefer the
// `services` state + `selectServiceMap` above.
export { serviceMap, employeeMap };
