import { create } from "zustand";
import type { PeriodoId, RangoPersonalizado } from "./periodos";
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
  PaymentMethod,
  Service,
  SalonProfile,
} from "./mock/types";
import type { DemoProfile } from "./demo-profile";
import { inferBusinessType, type BusinessType } from "./business-type";
import {
  pushAppointment,
  pushAppointmentDeletion,
  pushClientNotes,
  pushPenalty,
  pushPenaltyCleared,
  pushSalonProfilePatch,
  pushWaitlistDeletion,
  pushWaitlistEntry,
  type ClienteDeCita,
} from "./salon-sync";

interface SalonState {
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
  clients: Client[];
  services: Service[];
  // El perfil real vive tipado como `SalonProfile`, pero cuando esta ventana
  // enseña una demo (`useApplyDemoFromUrl` en app.tsx) se le mezclan también
  // los campos de personalización de `DemoProfile` (modulosOcultos,
  // mostrarSolicitudes...), que no forman parte del negocio real.
  salonProfile: SalonProfile &
    Partial<Pick<DemoProfile, "modulosOcultos" | "mostrarSolicitudes" | "duracionFlexible" | "recargoRetraso">>;
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
  /**
   * Slug del salón REAL que se está gestionando, o `null` si esto es una de las
   * ~54 demos de venta (enlace `?d=…`, sin cuenta).
   *
   * Es el interruptor de todo el backend: mientras valga `null`, ni una sola
   * acción de la store llama a Supabase y el panel se comporta exactamente
   * como antes. Lo pone `useRealSalon` cuando `getSalonProfile(slug)` devuelve
   * un perfil, y lo quita cuando devuelve `null`.
   *
   * NO se persiste (ver `partialize`): se vuelve a resolver en cada carga
   * contra Supabase, para que un navegador donde se abrió una vez el panel de
   * Adam no siga creyéndose su panel al abrir luego una demo cualquiera.
   */
  realSalonSlug: string | null;
  /**
   * Hora de la última cita que se ha cancelado en esta sesión (ISO), o `null`.
   *
   * Es el puente entre "se me ha caído la de las 17:00" y "a quién aviso":
   * la pantalla de lista de espera la usa para prerrellenar el mensaje de
   * WhatsApp con la hora concreta, que es lo único que hace que el aviso
   * sirva de algo. No se persiste: un hueco de ayer no es un hueco.
   */
  lastFreedSlot: string | null;
  /** Apunta (o borra) el hueco que se acaba de liberar — ver `lastFreedSlot`. */
  setLastFreedSlot: (startISO: string | null) => void;

  // Appointments
  /**
   * `cliente` son el nombre/teléfono/email de quien reserva, cuando se
   * conocen (reserva pública, cita nueva por teléfono). Solo se usan para
   * crear o enganchar su ficha en Supabase si el salón es real; en local la
   * cita se crea igual que siempre, la lleve o no.
   */
  addAppointment: (a: Omit<Appointment, "id">, cliente?: ClienteDeCita) => Appointment;
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
  addWaitlist: (w: Omit<WaitlistEntry, "id" | "createdAt">) => WaitlistEntry;
  updateWaitlist: (id: string, patch: Partial<WaitlistEntry>) => void;
  deleteWaitlist: (id: string) => void;

  /**
   * Cierre de caja: marca una cita como cobrada con la forma de cobro que
   * diga el dueño, o la desmarca (`null`). No mueve dinero ni habla con
   * ninguna pasarela — ver lib/caja.ts.
   */
  markPaid: (id: string, method: PaymentMethod | null) => void;
  /** Deja constancia de que se ha pedido la señal por Bizum de esta cita. */
  markDepositRequested: (id: string, eur: number) => void;
  /** El dueño confirma a mano que el Bizum llegó (o se desdice). */
  markDepositReceived: (id: string, recibido: boolean) => void;

  // Clients
  addClient: (c: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  /** Marca al cliente con una penalización pendiente (política de plantón — ver mock/types.ts). */
  applyPenalty: (
    clientId: string,
    eur: number,
    note?: string,
    detalle?: { reason?: "no_show" | "late"; lateMinutes?: number; appointmentId?: string },
  ) => void;
  /** Cierra la penalización: cobrada o perdonada, decide siempre el dueño. */
  clearPenalty: (clientId: string, motivo: "cobrado" | "perdonado") => void;
  /**
   * El bloqueo por plantón caduca solo a los 30 días. Esto es el "no, a este
   * lo mantengo" del dueño (o su marcha atrás) — ver lib/plantones.ts.
   */
  setPenaltyKeep: (clientId: string, mantener: boolean) => void;
  /**
   * El dueño ya ha visto este recargo pendiente y decide dejarlo así, sin
   * cobrarlo ni perdonarlo todavía — sale del aviso de "nuevos" en Hoy. Ver
   * RecargosPendientes.tsx.
   */
  reviewPenalty: (clientId: string) => void;
  /**
   * Deja la deuda de un cliente EXACTAMENTE así, sin interpretar nada.
   *
   * Es el punto único por el que pasan las tres decisiones del dueño
   * (anotarla, perdonarla, bloquear) y, sobre todo, el "Deshacer": cada acción
   * guarda antes el estado que había y lo devuelve tal cual llamando otra vez
   * aquí. `{}` = no debe nada.
   */
  setDeuda: (clientId: string, estado: EstadoDeuda) => void;

  // Services (moved from static salon.ts array to reactive store state)
  addService: (s: Omit<Service, "id">) => Service;
  updateService: (id: string, patch: Partial<Service>) => void;
  deleteService: (id: string) => void;

  // Salon profile (Settings)
  updateSalonProfile: (
    patch: Partial<SalonProfile> & Partial<Pick<DemoProfile, "duracionFlexible" | "recargoRetraso">>,
  ) => void;

  /**
   * Cambia el equipo, el catálogo de servicios, los clientes, las citas y la
   * lista de espera de ejemplo para que hablen el idioma de este tipo de
   * negocio. Se llama al abrir un enlace de demo (ver s.$salonSlug.tsx) y al
   * aplicar una demo guardada — nunca al editar Ajustes a mano, para no
   * borrar el trabajo de un negocio real que ya tiene su propio catálogo.
   *
   * `overrides.team`/`overrides.menu` son el equipo/carta reales del enlace
   * (claves "e"/"m" — ver demo-profile.ts): si vienen, sustituyen al equipo
   * y catálogo de ejemplo del tipo; si no, todo sigue como siempre.
   *
   * `overrides.noShowFeeEur`/`overrides.smartSpread` (claves "q"/"k") ajustan
   * el seed para poder enseñar la política de plantón y el reparto de
   * agenda al momento — ver `buildSeed` en mock/seed.ts.
   */
  applyBusinessType: (
    type: BusinessType,
    overrides?: {
      team?: string[];
      menu?: string[];
      noShowFeeEur?: number;
      smartSpread?: boolean;
      duracionFlexible?: boolean;
    },
  ) => void;

  /**
   * Periodo elegido en el selector de la analítica (inicio y Analítica usan el
   * mismo, para que las dos pantallas no cuenten historias distintas).
   * Se persiste: el dueño que trabaja por semanas abre el panel ya en semanas.
   */
  periodoAnalitica: PeriodoId;
  /** Fechas del periodo "a medida", cuando `periodoAnalitica` es `personalizado`. */
  rangoAnalitica: RangoPersonalizado | null;
  /** Cambia el periodo de la analítica. Elegir fechas concretas pasa el rango. */
  setPeriodoAnalitica: (id: PeriodoId, rango?: RangoPersonalizado | null) => void;

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

  /** Enciende o apaga el backend para este navegador — ver `realSalonSlug`. */
  setRealSalonSlug: (slug: string | null) => void;
  /**
   * Sustituye citas, clientes y lista de espera por los que vienen de
   * Supabase. Es una sustitución, no una mezcla: la fuente de verdad de un
   * salón real es la base, y lo que hubiera en este navegador son datos de
   * ejemplo del seed.
   *
   * La lista de espera entró aquí tarde y costó caro: `hydrateFromServer`
   * solo sustituía citas y clientes, así que el panel de un salón REAL seguía
   * enseñando las cuatro entradas de ejemplo del seed —con sus teléfonos
   * +34 611 111 222, 622 333 444…— como si fueran clientes suyos. Ahora la
   * lista llega siempre del servidor: vacía si allí no hay nada, que es lo
   * correcto para un salón que acaba de empezar.
   */
  hydrateFromServer: (data: {
    appointments: Appointment[];
    clients: Client[];
    waitlist: WaitlistEntry[];
  }) => void;
  /**
   * Deja citas, clientes y lista de espera a cero.
   *
   * Lo usa `resolverSalonReal` justo después de `applyBusinessType`: un salón
   * de pago no puede ver ni un segundo las citas y los clientes inventados que
   * ese método siembra, y mucho menos escribir encima de ellos. Mejor un panel
   * vacío mientras carga que un panel con gente que no existe.
   */
  vaciarDatosDeEjemplo: () => void;
}

/**
 * Los cinco campos de deuda de una ficha, juntos. Se mueven siempre en
 * bloque: media deuda aplicada (importe sin fecha, o bloqueo sin importe) es
 * justo lo que hacía que el panel dijera cosas distintas en cada pantalla.
 */
export interface EstadoDeuda {
  penaltyEur?: number;
  penaltyNote?: string;
  penaltyAt?: string;
  penaltyKeep?: boolean;
  penaltyBlock?: boolean;
}

/** Lee de una ficha su estado de deuda, para poder devolverlo con "Deshacer". */
export function estadoDeudaDe(client: Client | undefined): EstadoDeuda {
  if (!client) return {};
  return {
    penaltyEur: client.penaltyEur,
    penaltyNote: client.penaltyNote,
    penaltyAt: client.penaltyAt,
    penaltyKeep: client.penaltyKeep,
    penaltyBlock: client.penaltyBlock,
  };
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

/**
 * Nombre y teléfono del cliente de una cita, si tiene ficha propia. Un "Sin
 * cita" no la tiene (entró sin dar teléfono) y entonces solo viaja el nombre
 * que ya lleva la cita.
 */
function clienteDeLaCita(state: SalonState, appt: Appointment): ClienteDeCita | undefined {
  const c = state.clients.find((x) => x.id === appt.clientId);
  if (!c?.phone) return undefined;
  return { name: c.name, phone: c.phone, email: c.email };
}

/**
 * Sube al backend la cita `id` tal y como ha quedado DESPUÉS de mutarla.
 * Es el único punto por el que sincronizan confirmar, rechazar, cambiar hora,
 * cambiar profesional, marcar plantón y cancelar: todas son la misma fila.
 */
function sincronizarCita(state: SalonState, id: string) {
  if (!state.realSalonSlug) return;
  const appt = state.appointments.find((a) => a.id === id);
  if (!appt) return;
  pushAppointment(state.realSalonSlug, appt, clienteDeLaCita(state, appt));
}

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
      realSalonSlug: null,
      lastFreedSlot: null,
      periodoAnalitica: "hoy",
      rangoAnalitica: null,

      setPeriodoAnalitica: (id, rango) =>
        set((s) => ({
          periodoAnalitica: id,
          // Un rango a medida solo se pisa si llega uno nuevo: volver a "Hoy" y
          // luego a "Fechas" recupera las que ya había elegido.
          rangoAnalitica: rango === undefined ? s.rangoAnalitica : rango,
        })),

      setLastFreedSlot: (startISO) => set({ lastFreedSlot: startISO }),

      addAppointment: (a, cliente) => {
        const appt: Appointment = { ...a, id: `a-new-${Date.now()}` };
        set((s) => ({ appointments: [...s.appointments, appt] }));
        // Y además, si el salón es real, súbela. El `push*` no hace nada
        // cuando `realSalonSlug` es null, que es el caso de todas las demos.
        pushAppointment(get().realSalonSlug, appt, cliente ?? clienteDeLaCita(get(), appt));
        return appt;
      },
      updateAppointment: (id, patch) => {
        set((s) => ({
          appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));
        sincronizarCita(get(), id);
      },
      cancelAppointment: (id) => {
        const hueco = get().appointments.find((a) => a.id === id)?.start ?? null;
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id ? { ...a, status: "cancelled" } : a,
          ),
          // Se queda apuntado el hueco que acaba de quedar libre, para poder
          // avisar al siguiente de la lista de espera con la hora concreta.
          lastFreedSlot: hueco,
        }));
        sincronizarCita(get(), id);
      },

      markClientConfirmed: (id, confirmed) => {
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id
              ? { ...a, clientConfirmedAt: confirmed ? new Date().toISOString() : undefined }
              : a,
          ),
        }));
        sincronizarCita(get(), id);
      },
      deleteAppointment: (id) => {
        set((s) => ({
          appointments: s.appointments.filter((a) => a.id !== id),
        }));
        pushAppointmentDeletion(get().realSalonSlug, id);
      },

      addWaitlist: (w) => {
        const entry: WaitlistEntry = {
          ...w,
          id: `w-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ waitlist: [...s.waitlist, entry] }));
        pushWaitlistEntry(get().realSalonSlug, entry);
        return entry;
      },
      updateWaitlist: (id, patch) => {
        set((s) => ({
          waitlist: s.waitlist.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        }));
        pushWaitlistEntry(
          get().realSalonSlug,
          get().waitlist.find((w) => w.id === id),
        );
      },
      deleteWaitlist: (id) => {
        set((s) => ({
          waitlist: s.waitlist.filter((w) => w.id !== id),
        }));
        pushWaitlistDeletion(get().realSalonSlug, id);
      },

      markPaid: (id, method) => {
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id
              ? method
                ? { ...a, paymentMethod: method, paidAt: new Date().toISOString() }
                : { ...a, paymentMethod: undefined, paidAt: undefined }
              : a,
          ),
        }));
        sincronizarCita(get(), id);
      },

      markDepositRequested: (id, eur) => {
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id
              ? { ...a, depositRequestedAt: new Date().toISOString(), depositEur: eur }
              : a,
          ),
        }));
        sincronizarCita(get(), id);
      },

      markDepositReceived: (id, recibido) => {
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id
              ? { ...a, depositReceivedAt: recibido ? new Date().toISOString() : undefined }
              : a,
          ),
        }));
        sincronizarCita(get(), id);
      },

      addClient: (c) => {
        const client: Client = {
          ...c,
          id: `c-new-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ clients: [...s.clients, client] }));
        return client;
      },
      updateClient: (id, patch) => {
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
        if ("notes" in patch) {
          pushClientNotes(
            get().realSalonSlug,
            get().clients.find((c) => c.id === id),
          );
        }
      },
      deleteClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
        })),

      applyPenalty: (clientId, eur, note, detalle) => {
        // La fecha es lo que hace que el bloqueo pueda caducar solo a los 30
        // días (ver lib/plantones.ts): sin ella no hay desde cuándo contar.
        const ahora = new Date().toISOString();
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  penaltyEur: eur,
                  penaltyNote: note,
                  penaltyAt: ahora,
                  penaltyKeep: false,
                  penaltyReason: detalle?.reason ?? "no_show",
                  penaltyLateMinutes: detalle?.lateMinutes,
                  penaltyAppointmentId: detalle?.appointmentId,
                  penaltyReviewedAt: undefined,
                }
              : c,
          ),
        }));
        pushPenalty(
          get().realSalonSlug,
          get().clients.find((c) => c.id === clientId),
          eur,
          note,
        );
      },
      clearPenalty: (clientId, motivo) => {
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  penaltyEur: undefined,
                  penaltyAt: undefined,
                  penaltyKeep: undefined,
                  penaltyReason: undefined,
                  penaltyLateMinutes: undefined,
                  penaltyAppointmentId: undefined,
                  penaltyReviewedAt: undefined,
                  penaltyNote:
                    motivo === "cobrado"
                      ? `Cobrada el ${new Date().toLocaleDateString("es", { day: "numeric", month: "short" })}`
                      : `Perdonada el ${new Date().toLocaleDateString("es", { day: "numeric", month: "short" })}`,
                }
              : c,
          ),
        }));
        const cliente = get().clients.find((c) => c.id === clientId);
        pushPenaltyCleared(get().realSalonSlug, cliente, cliente?.penaltyNote);
      },

      setDeuda: (clientId, estado) => {
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  penaltyEur: estado.penaltyEur,
                  penaltyNote: estado.penaltyNote,
                  penaltyAt: estado.penaltyAt,
                  penaltyKeep: estado.penaltyKeep,
                  penaltyBlock: estado.penaltyBlock,
                }
              : c,
          ),
        }));
        const cliente = get().clients.find((c) => c.id === clientId);
        if (!cliente) return;
        // Debe algo → se sube la deuda; no debe nada → se cierra en el
        // servidor. Las dos ramas pasan por el mismo sitio para que deshacer
        // una decisión también viaje a Supabase.
        if ((cliente.penaltyEur ?? 0) > 0) {
          pushPenalty(get().realSalonSlug, cliente, cliente.penaltyEur ?? 0, cliente.penaltyNote);
        } else {
          pushPenaltyCleared(get().realSalonSlug, cliente, cliente.penaltyNote);
        }
      },

      setPenaltyKeep: (clientId, mantener) => {
        set((s) => ({
          clients: s.clients.map((c) => (c.id === clientId ? { ...c, penaltyKeep: mantener } : c)),
        }));
        const cliente = get().clients.find((c) => c.id === clientId);
        pushPenalty(get().realSalonSlug, cliente, cliente?.penaltyEur ?? 0, cliente?.penaltyNote);
      },

      reviewPenalty: (clientId) => {
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === clientId ? { ...c, penaltyReviewedAt: new Date().toISOString() } : c,
          ),
        }));
      },

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

      updateSalonProfile: (patch) => {
        set((s) => ({ salonProfile: { ...s.salonProfile, ...patch } }));
        // Sube el PARCHE, no el perfil entero. Antes subía
        // `get().salonProfile` completo, y eso hacía que un navegador con el
        // perfil viejo en localStorage revirtiera lo que se hubiera cambiado
        // desde otro dispositivo: cambias el teléfono en el móvil, tocas el
        // horario en el iPad de ayer, y el teléfono vuelve al viejo. Lo que
        // este navegador no ha tocado ya no viaja. Ver `patchSalonProfile`.
        pushSalonProfilePatch(get().realSalonSlug, patch);
      },

      applyBusinessType: (type, overrides) => {
        // Mutan en sitio los arrays/objetos que exporta mock/salon.ts: las
        // pantallas que los importan de forma estática (la carta pública, la
        // lista de espera del panel, el diálogo de nueva cita…) los leen de
        // nuevo en el siguiente render, que llega enseguida porque el `set`
        // de abajo notifica a todo lo que esté suscrito a la store.
        setEmployeesForType(type, overrides?.team);
        setServicesForType(type, overrides?.menu);
        const seed = buildSeed(type, liveEmployees, [...seedServices], {
          noShowFeeEur: overrides?.noShowFeeEur,
          smartSpread: overrides?.smartSpread,
          duracionFlexible: overrides?.duracionFlexible,
        });
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

      setRealSalonSlug: (slug) => set({ realSalonSlug: slug }),

      hydrateFromServer: ({ appointments, clients, waitlist }) =>
        set({ appointments, clients, waitlist }),

      vaciarDatosDeEjemplo: () => set({ appointments: [], clients: [], waitlist: [] }),

      applyDemo: (id) => {
        const demo = get().savedDemos.find((d) => d.id === id);
        if (!demo) return;
        // Aplicar una demo guardada significa dejar de mirar al salón real:
        // si no, el primer cambio de Ajustes le escribiría la demo encima.
        set({ realSalonSlug: null });
        // `id` y `savedAt` son de la demo, no del salón: no deben colarse en el perfil.
        const { id: _id, savedAt: _savedAt, ...profileFields } = demo;
        set((s) => ({ salonProfile: { ...s.salonProfile, ...profileFields } }));
        get().applyBusinessType(inferBusinessType(profileFields.tagline, profileFields.name), {
          team: profileFields.team,
          menu: profileFields.menu,
          noShowFeeEur: profileFields.noShowFeeEur,
          smartSpread: profileFields.smartSpread,
          duracionFlexible: profileFields.duracionFlexible,
        });
      },

      resetSalonProfile: () => {
        set({ salonProfile: salon, demoActive: false, realSalonSlug: null });
        get().applyBusinessType("barberia");
      },
    }),
    {
      name: "trimly-salon-store",
      storage,
      // Se guarda todo MENOS `realSalonSlug`: saber si este navegador está
      // gestionando un salón real se vuelve a preguntar a Supabase en cada
      // carga. Si se persistiera, un navegador que abrió una vez el panel de
      // un salón real seguiría creyéndose ese panel al abrir después una demo
      // de venta — y le escribiría la demo encima al primer cambio.
      partialize: (state) =>
        ({
          appointments: state.appointments,
          waitlist: state.waitlist,
          clients: state.clients,
          services: state.services,
          salonProfile: state.salonProfile,
          savedDemos: state.savedDemos,
          panelV2: state.panelV2,
          demoActive: state.demoActive,
          periodoAnalitica: state.periodoAnalitica,
          rangoAnalitica: state.rangoAnalitica,
        }) as unknown as SalonState,
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
        setEmployeesForType(type, state.salonProfile?.team);
        setServicesForType(type, state.salonProfile?.menu);
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
