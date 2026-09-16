import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { seedAppointments, seedWaitlist, clients as seedClients, buildSeed } from "./mock/seed";
import {
  serviceMap,
  employeeMap,
  services as seedServices,
  salon,
  setEmployeesForType,
  setServicesForType,
  employees as liveEmployees,
} from "./mock/salon";
import type {
  Appointment,
  Client,
  WaitlistEntry,
  EmployeeId,
  Service,
  SalonProfile,
} from "./mock/types";
import type { DemoProfile } from "./demo-profile";
import { inferBusinessType, type BusinessType } from "./business-type";

interface SalonState {
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
  clients: Client[];
  services: Service[];
  salonProfile: SalonProfile;
  /** Salones preparados para enseñar en visitas — ver demo-profile.ts. */
  savedDemos: SavedDemo[];
  /**
   * Rediseño v2 del panel (`/app/*`). Se activa con `?v=2` en cualquier ruta
   * de `/app` y queda guardado aquí para que el resto de `/app/*` lo respete
   * sin tener que repetir el parámetro en cada enlace — ver
   * `lib/use-panel-v2.ts`. `?v=1` lo desactiva.
   */
  panelV2: boolean;
  /**
   * Se ha abierto un enlace de demo (`/s/<slug>?d=…`) en este navegador. Lo
   * usa `login.tsx` para ofrecer "Entrar como [salón]" sin pedir credenciales
   * — el fallo del botón "Acceso barbero" que no respondió en el iPad no
   * puede volver a dejar a alguien tecleando un email en mitad de una demo.
   */
  demoActive: boolean;

  // Appointments
  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  cancelAppointment: (id: string) => void;
  /**
   * Punto único por el que entra "el cliente confirma que viene".
   * Hoy se dispara a mano desde el panel; cuando exista canal (WhatsApp, SMS o
   * email) lo llamará el webhook y no habrá que tocar nada más.
   */
  markClientConfirmed: (id: string, confirmed: boolean) => void;
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

  /**
   * Cambia el equipo, el catálogo de servicios, los clientes, las citas y la
   * lista de espera de ejemplo para que hablen el idioma de este tipo de
   * negocio. Se llama al abrir un enlace de demo (ver s.$salonSlug.tsx) y al
   * aplicar una demo guardada — nunca al editar Ajustes a mano, para no
   * borrar el trabajo de un negocio real que ya tiene su propio catálogo.
   */
  applyBusinessType: (type: BusinessType) => void;

  /** Activa/desactiva el rediseño v2 del panel — ver `panelV2` arriba. */
  setPanelV2: (v: boolean) => void;
  /** Marca que esta demo se abrió desde un enlace público — ver `demoActive` arriba. */
  markDemoActive: () => void;

  // Demos guardadas
  saveDemo: (demo: DemoProfile, id?: string) => SavedDemo;
  deleteDemo: (id: string) => void;
  /** Vuelca una demo guardada sobre el perfil activo del panel. */
  applyDemo: (id: string) => void;
  /** Devuelve el panel al salón de ejemplo sin borrar las demos guardadas. */
  resetSalonProfile: () => void;
}

/** Una demo guardada es un perfil con identidad propia para poder editarla. */
export interface SavedDemo extends DemoProfile {
  id: string;
  savedAt: string;
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
    (set, get) => ({
      appointments: seedAppointments,
      waitlist: seedWaitlist,
      clients: seedClients,
      services: seedServices,
      salonProfile: salon,
      savedDemos: [],
      panelV2: false,
      demoActive: false,

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

      markClientConfirmed: (id, confirmed) =>
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id
              ? { ...a, clientConfirmedAt: confirmed ? new Date().toISOString() : undefined }
              : a,
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

      applyBusinessType: (type) => {
        // Mutan en sitio los arrays/objetos que exporta mock/salon.ts: las
        // pantallas que los importan de forma estática (la carta pública, la
        // lista de espera del panel, el diálogo de nueva cita…) los leen de
        // nuevo en el siguiente render, que llega enseguida porque el `set`
        // de abajo notifica a todo lo que esté suscrito a la store.
        setEmployeesForType(type);
        setServicesForType(type);
        const seed = buildSeed(type, liveEmployees, [...seedServices]);
        set(() => ({
          services: [...seedServices],
          clients: seed.clients,
          appointments: seed.appointments,
          waitlist: seed.waitlist,
        }));
      },

      setPanelV2: (v) => set({ panelV2: v }),
      markDemoActive: () => set({ demoActive: true }),

      saveDemo: (demo, id) => {
        const entry: SavedDemo = {
          ...demo,
          id: id ?? `demo-${Date.now()}`,
          savedAt: new Date().toISOString(),
        };
        set((s) => {
          const existing = s.savedDemos.findIndex((d) => d.id === entry.id);
          if (existing >= 0) {
            const next = [...s.savedDemos];
            next[existing] = entry;
            return { savedDemos: next };
          }
          return { savedDemos: [entry, ...s.savedDemos] };
        });
        return entry;
      },

      deleteDemo: (id) => set((s) => ({ savedDemos: s.savedDemos.filter((d) => d.id !== id) })),

      applyDemo: (id) => {
        const demo = get().savedDemos.find((d) => d.id === id);
        if (!demo) return;
        // `id` y `savedAt` son de la demo, no del salón: no deben colarse en el perfil.
        const { id: _id, savedAt: _savedAt, ...profileFields } = demo;
        set((s) => ({ salonProfile: { ...s.salonProfile, ...profileFields } }));
        get().applyBusinessType(inferBusinessType(profileFields.tagline, profileFields.name));
      },

      resetSalonProfile: () => {
        set({ salonProfile: salon, demoActive: false });
        get().applyBusinessType("barberia");
      },
    }),
    {
      name: "trimly-salon-store",
      storage,
      // v2: the barbershop identity rewrite (name/tagline/about/instagram,
      // service copy) needs to actually reach browsers that already
      // persisted v1 state — otherwise the old salonProfile/services would
      // win forever. Discard just those two slices on migration and refill
      // them from the current seed data, keeping everything the shopkeeper
      // may have actually created (appointments, clients, waitlist).
      //
      // v3: el perfil gana nota, número de reseñas y especialidades. Un estado
      // v2 no los trae, y sin ellos el hero renderiza "undefined" — se
      // rellenan desde el seed conservando lo que el usuario ya había escrito.
      //
      // v4: el catálogo pasa de peluquería (mechas, keratina, color) a barbería.
      // Los ids cambian, así que un estado v3 se queda con servicios que ya no
      // existen en `copy.ts` y la tabla de citas pinta el nombre en blanco. Se
      // sustituye el catálogo y se remapean las citas ya guardadas en vez de
      // tirarlas: el historial de la demo es parte de lo que se enseña.
      //
      // v5: una cita pasa de un servicio (`serviceId`) a una lista
      // (`serviceIds`). Se envuelve el que había para no perder ninguna cita.
      // v6: el horario pasa de tres filas de texto ("Mon–Fri") a siete cadenas
      // por día, para admitir jornada partida. Un estado anterior no lo trae.
      //
      // v7: los servicios y el equipo pasan a variar por tipo de negocio
      // (ver lib/business-type.ts) y el catálogo de barbería gana el id
      // "degradado". Un estado v6 se queda con el catálogo viejo — se
      // sustituye por el de barbería (el tipo por defecto) y `onRehydrateStorage`,
      // más abajo, lo corrige al tipo real en cuanto se conoce el perfil.
      //
      // Los pasos se encadenan en orden en vez de devolver al primero que
      // aplica: un estado v3 tiene que pasar por el v4, el v5 y el v6.
      version: 7,
      migrate: (persistedState, version) => {
        // Forma de una cita tal y como pudo quedar guardada en cualquier
        // versión anterior: con `serviceId` suelto o ya con la lista.
        type CitaGuardada = Omit<Appointment, "serviceIds"> & {
          serviceId?: string;
          serviceIds?: string[];
        };
        type EstadoGuardado = Omit<SalonState, "appointments"> & { appointments?: CitaGuardada[] };
        let state = persistedState as EstadoGuardado;

        if (version < 2) {
          state = { ...state, salonProfile: salon, services: seedServices };
        }
        if (version < 3) {
          state = {
            ...state,
            salonProfile: {
              ...salon,
              ...state.salonProfile,
              rating: state.salonProfile?.rating ?? salon.rating,
              reviewCount: state.salonProfile?.reviewCount ?? salon.reviewCount,
              specialties: state.salonProfile?.specialties?.length
                ? state.salonProfile.specialties
                : salon.specialties,
            },
          };
        }
        if (version < 4) {
          const equivalencias: Record<string, string> = {
            haircut: "corte",
            beard: "barba",
            color: "corte-barba",
            highlights: "afeitado",
            keratin: "corte-barba",
            styling: "cejas",
          };
          const porId = new Map(seedServices.map((sv) => [sv.id, sv]));
          state = {
            ...state,
            services: seedServices,
            salonProfile: { ...salon, ...state.salonProfile, specialties: salon.specialties },
            appointments: (state.appointments ?? []).map((a) => {
              const nuevoId = equivalencias[a.serviceId ?? ""] ?? a.serviceId;
              const sv = nuevoId ? porId.get(nuevoId) : undefined;
              return sv
                ? { ...a, serviceId: nuevoId, priceEur: sv.priceEur, duration: sv.durationMin }
                : a;
            }),
            waitlist: (state.waitlist ?? []).map((w) => ({
              ...w,
              serviceId: equivalencias[w.serviceId] ?? w.serviceId,
            })),
          };
        }
        if (version < 5) {
          state = {
            ...state,
            appointments: (state.appointments ?? []).map(({ serviceId, serviceIds, ...resto }) => ({
              ...resto,
              serviceIds: serviceIds?.length ? serviceIds : serviceId ? [serviceId] : [],
            })),
          };
        }
        if (version < 6) {
          const perfil = (state.salonProfile ?? {}) as Partial<SalonProfile> & { hours?: unknown };
          const { hours: _viejo, ...resto } = perfil;
          state = {
            ...state,
            salonProfile: {
              ...salon,
              ...resto,
              openingHours:
                Array.isArray(resto.openingHours) && resto.openingHours.length === 7
                  ? resto.openingHours
                  : salon.openingHours,
            } as SalonProfile,
          };
        }
        if (version < 7) {
          state = { ...state, services: seedServices };
        }
        return state as unknown as SalonState;
      },
      // Al recargar la pestaña, el estado persistido (servicios, clientes,
      // citas) vuelve tal cual se guardó, pero `employees`/`employeeMap` de
      // mock/salon.ts son un módulo nuevo: arrancan siempre en barbería. Sin
      // esto, un panel recargado directamente en /app (sin pasar antes por el
      // enlace público) mostraría el equipo de barbería con un perfil de
      // peluquería. Se corrige aquí, una vez, nada más hidratar.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const type = inferBusinessType(state.salonProfile?.tagline, state.salonProfile?.name);
        setEmployeesForType(type);
        setServicesForType(type);
      },
    },
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
