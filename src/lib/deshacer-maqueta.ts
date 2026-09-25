/**
 * Deshacer en toda la app (lote 12), sobre el registro de cambios PURO de
 * BACKEND (`cambios.ts`, `registro-cambios.ts`).
 *
 * CONECTAR: en la rama de BACKEND esto vive en la store (`cambios`,
 * `registrarCambio`, `marcarAvisoEnviado`, `estadoDeshacer`, `deshacerCambio`)
 * y las acciones ya vienen envueltas al final de `store.ts`. Al fusionar se
 * borra `instalarRegistro()` (envolvería dos veces) y `useCambios` pasa a
 * leer `useSalonStore`. Lo de pantalla (el aviso de 10 s, la cola, Ctrl+Z,
 * el aviso de «ya avisada») se queda.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import {
  aplicarDeshacerEnLista,
  accionDe,
  cambioDeDeshacer,
  inverso,
  podar,
  puedeDeshacer,
  registrarCambio as registrarCambioPuro,
  SEGUNDOS_AVISO,
  textoClientaAvisada,
  textoMotivo,
  type Cambio,
  type ContextoDeshacer,
  type EntidadCambio,
  type EstadoDeshacer,
  type MotivoNoDeshacer,
  type TipoCambio,
} from "./cambios";
import { ACCIONES_REGISTRADAS, ACCIONES_SIN_REGISTRO, resumenCita, resumenClienta, resumenServicio, tipoCambioCita, tipoCambioClienta } from "./registro-cambios";
import { useSalonStore } from "./store";
import { permisosDe, puede } from "./permisos";
import { miembroAhora } from "./accesos-panel";
import { solapaConAgenda } from "./solape-maqueta";
import { whatsappUrl } from "./campanas";
import type { Appointment, Client, SalonProfile, Service } from "./mock/types";

/* ---------- el registro ---------- */

interface EstadoCambios {
  cambios: Cambio[];
  registrar: (c: Cambio) => void;
  marcarAvisoEnviado: (cambioId: string) => void;
  aplicarDeshacer: (original: Cambio, d: Cambio) => void;
}

export const useCambios = create<EstadoCambios>()(
  persist(
    (set) => ({
      cambios: [],
      registrar: (c) => set((s) => ({ cambios: podar([c, ...s.cambios.filter((x) => x.id !== c.id)], new Date()) })),
      marcarAvisoEnviado: (id) => set((s) => ({ cambios: s.cambios.map((c) => (c.id === id ? { ...c, avisoEnviado: true } : c)) })),
      aplicarDeshacer: (original, d) => set((s) => ({ cambios: podar(aplicarDeshacerEnLista(s.cambios, original, d), new Date()) })),
    }),
    { name: "sishow-cambios", storage: createJSONStorage(() => localStorage) },
  ),
);

export function nuevoIdCambio(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cambio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

let pausa = 0;
function enPausa<T>(fn: () => T): T {
  pausa++;
  try {
    return fn();
  } finally {
    pausa--;
  }
}

/** Mientras corre, los cambios se registran pero no sacan su aviso: el que llama pinta el suyo. */
let silencio = 0;
let capturados: Cambio[] = [];
export function conCambio<T>(fn: () => T): { r: T; cambio: Cambio | null } {
  silencio++;
  const previos = capturados;
  capturados = [];
  try {
    const r = fn();
    return { r, cambio: capturados[capturados.length - 1] ?? null };
  } finally {
    capturados = previos;
    silencio--;
  }
}

/** Tipo forzado para el perfil (publicar la web, restaurar una versión). */
let tipoPerfil: TipoCambio | null = null;
export function comoTipo<T>(tipo: TipoCambio, fn: () => T): T {
  const previo = tipoPerfil;
  tipoPerfil = tipo;
  try {
    return fn();
  } finally {
    tipoPerfil = previo;
  }
}

function registrar(c: Cambio) {
  useCambios.getState().registrar(c);
  if (silencio > 0) capturados.push(c);
  else avisar(c.resumen, () => deshacerConAviso(c.id), c.id);
}

/* ---------- estado y deshacer ---------- */

function sinNulos(p: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === null ? undefined : v]));
}

function actualDe(c: Cambio): Record<string, unknown> | null {
  const s = useSalonStore.getState();
  if (c.entidad === "cita") return (s.appointments.find((a) => a.id === c.idEntidad) as unknown as Record<string, unknown>) ?? null;
  if (c.entidad === "clienta") return (s.clients.find((x) => x.id === c.idEntidad) as unknown as Record<string, unknown>) ?? null;
  if (c.entidad === "servicio") return { servicio: s.services.find((x) => x.id === c.idEntidad) ?? null };
  return s.salonProfile as unknown as Record<string, unknown>;
}

function contexto(c: Cambio): ContextoDeshacer {
  const s = useSalonStore.getState();
  const m = miembroAhora();
  const permisos = permisosDe(m?.rol ?? "gerente");
  const cita = c.entidad === "cita" ? s.appointments.find((a) => a.id === c.idEntidad) : undefined;
  let huecoLibre: boolean | undefined;
  if (c.tipo === "cita.mover" && cita) {
    const destino = { ...cita, ...sinNulos(c.antes) } as Appointment;
    huecoLibre = solapaConAgenda(s.appointments, { employeeId: destino.employeeId, start: destino.start, duration: destino.duration, excluirId: cita.id }).length === 0;
  }
  const empleadas = [cita?.employeeId, c.antes.employeeId as string | undefined].filter(Boolean) as string[];
  const accion = accionDe(c.tipo);
  const puedeLaAccion = empleadas.length
    ? empleadas.every((e) => puede(permisos, accion, { employeeId: e, miEmployeeId: m?.employeeId ?? null }))
    : puede(permisos, accion);
  return {
    actual: actualDe(c),
    cambios: useCambios.getState().cambios,
    quien: m?.userId ?? null,
    puedeLaAccion,
    puedeAjeno: puede(permisos, "historial.deshacer-ajeno"),
    ahora: new Date(),
    huecoLibre,
  };
}

export function estadoDeshacer(cambioId: string): EstadoDeshacer {
  const c = useCambios.getState().cambios.find((x) => x.id === cambioId);
  if (!c) return { puede: false, motivo: "CADUCADO" };
  return puedeDeshacer(c, contexto(c));
}

export function deshacerCambio(cambioId: string): { ok: true; aviso?: "CLIENTA_AVISADA" } | { ok: false; motivo: MotivoNoDeshacer } {
  const c = useCambios.getState().cambios.find((x) => x.id === cambioId);
  if (!c) return { ok: false, motivo: "CADUCADO" };
  const e = puedeDeshacer(c, contexto(c));
  if (!e.puede) return { ok: false, motivo: e.motivo };
  const parche = sinNulos(inverso(c));
  const st = useSalonStore.getState();
  enPausa(() => {
    if (c.entidad === "cita") st.updateAppointment(c.idEntidad, parche as Partial<Appointment>);
    else if (c.entidad === "clienta") {
      if ("manualBlock" in parche) st.setManualBlock(c.idEntidad, !!parche.manualBlock);
      st.updateClient(c.idEntidad, parche as Partial<Client>);
    } else if (c.entidad === "servicio") {
      const previo = c.antes.servicio as Service | null | undefined;
      useSalonStore.setState((s) => ({
        services: previo
          ? s.services.some((x) => x.id === c.idEntidad)
            ? s.services.map((x) => (x.id === c.idEntidad ? previo : x))
            : [...s.services, previo]
          : s.services.filter((x) => x.id !== c.idEntidad),
      }));
    } else st.updateSalonProfile(parche as Partial<SalonProfile>);
  });
  const m = miembroAhora();
  const d = cambioDeDeshacer(c, { id: nuevoIdCambio(), autor: m?.userId ?? null, autorNombre: m?.displayName ?? null, fecha: new Date().toISOString() });
  useCambios.getState().aplicarDeshacer(c, d);
  return e.aviso ? { ok: true, aviso: e.aviso } : { ok: true };
}

/** Marca que la clienta recibió un WhatsApp por el último cambio de esta cita. */
export function marcarAvisoDeCita(citaId: string) {
  const c = useCambios.getState().cambios.find((x) => x.entidad === "cita" && x.idEntidad === citaId && !x.deshechoEn && !x.deshaceA);
  if (c) useCambios.getState().marcarAvisoEnviado(c.id);
}

/* ---------- el aviso de 10 s ---------- */

/** El último aviso con «Deshacer» todavía a la vista, para Ctrl+Z. */
let ultimo: { deshacer: () => void; hasta: number; toastId: string | number } | null = null;

/**
 * «Cita de Ana rechazada · Deshacer», 10 s, abajo. Sirve también para lo que no
 * pasa por el registro (crear una cita, la lista de espera, los accesos).
 */
export function avisar(texto: string, deshacer: () => void, id?: string) {
  const toastId = id ?? nuevoIdCambio();
  const hacer = () => {
    if (ultimo?.toastId === toastId) ultimo = null;
    toast.dismiss(toastId);
    deshacer();
  };
  toast(texto, { id: toastId, duration: SEGUNDOS_AVISO * 1000, action: { label: "Deshacer", onClick: hacer } });
  ultimo = { deshacer: hacer, hasta: Date.now() + SEGUNDOS_AVISO * 1000, toastId };
}

export const HECHO = "Hecho: vuelve a estar como antes";

function nombreDeCambio(c: Cambio): { nombre: string; telefono: string | null; cita: Appointment | null } {
  const s = useSalonStore.getState();
  const cita = c.entidad === "cita" ? (s.appointments.find((a) => a.id === c.idEntidad) ?? null) : null;
  const cliente = cita ? s.clients.find((x) => x.id === cita.clientId) : c.entidad === "clienta" ? s.clients.find((x) => x.id === c.idEntidad) : undefined;
  const nombre = (cita?.clientName ?? cliente?.name ?? "la clienta").split(" ")[0];
  return { nombre, telefono: cliente?.phone ?? null, cita };
}

/** Mensaje de corrección cuando se deshace algo que ya se le había contado a la clienta. */
function mensajeCorreccion(c: Cambio, nombre: string, cita: Appointment | null): string {
  const cuando = cita ? new Date(cita.start).toLocaleString("es-ES", { weekday: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  if (c.tipo === "cita.confirmar") return `Hola ${nombre}, perdona: tu cita${cuando ? ` del ${cuando}` : ""} aún no está confirmada. Te escribimos en cuanto lo esté.`;
  if (c.tipo === "cita.rechazar" || c.tipo === "cita.cancelar") return `Hola ${nombre}, perdona el lío: tu cita${cuando ? ` del ${cuando}` : ""} sigue en pie.`;
  if (c.tipo === "cita.mover") return `Hola ${nombre}, perdona: tu cita vuelve a ser${cuando ? ` el ${cuando}` : " a la hora de antes"}.`;
  if (c.tipo === "senal.pedir") return `Hola ${nombre}, perdona: no hace falta que envíes la señal.`;
  return `Hola ${nombre}, perdona: el último mensaje no es correcto, te escribimos enseguida.`;
}

/** Deshacer desde un aviso, el historial o Ctrl+Z, con los textos de cada caso. */
export function deshacerConAviso(cambioId: string, confirmado = false) {
  const e = estadoDeshacer(cambioId);
  if (!e.puede) {
    if (e.motivo !== "DESHECHO") toast.error(textoMotivo(e.motivo));
    return;
  }
  const c = useCambios.getState().cambios.find((x) => x.id === cambioId)!;
  const { nombre, telefono, cita } = nombreDeCambio(c);
  if (e.aviso === "CLIENTA_AVISADA" && !confirmado) {
    toast(textoClientaAvisada(nombre), {
      duration: Infinity,
      action: { label: "Deshacer igualmente", onClick: () => deshacerConAviso(cambioId, true) },
      cancel: { label: "Dejarlo así", onClick: () => undefined },
    });
    return;
  }
  const r = deshacerCambio(cambioId);
  if (!r.ok) {
    toast.error(textoMotivo(r.motivo));
    return;
  }
  if (e.aviso === "CLIENTA_AVISADA") {
    const citaAhora = cita ? (useSalonStore.getState().appointments.find((a) => a.id === cita.id) ?? cita) : null;
    toast(`${HECHO}. Ojo: ${nombre} ya tenía un WhatsApp.`, {
      duration: Infinity,
      action: telefono
        ? { label: `Escribirle a ${nombre}`, onClick: () => void window.open(whatsappUrl(telefono, mensajeCorreccion(c, nombre, citaAhora)), "_blank", "noopener") }
        : undefined,
      cancel: { label: "Cerrar", onClick: () => undefined },
    });
  } else toast.success(HECHO, { duration: 2500 });
}

/** Ctrl/Cmd + Z deshace el último aviso que siga a la vista. */
export function instalarAtajoDeshacer() {
  if (typeof window === "undefined") return () => undefined;
  const alPulsar = (ev: KeyboardEvent) => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.key.toLowerCase() !== "z") return;
    const t = ev.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; // el deshacer del propio campo
    if (!ultimo || Date.now() > ultimo.hasta) return;
    ev.preventDefault();
    ultimo.deshacer();
  };
  window.addEventListener("keydown", alPulsar);
  return () => window.removeEventListener("keydown", alPulsar);
}

/* ---------- envolver las acciones de la store (CONECTAR: lo hace store.ts de BACKEND) ---------- */

const TIPO_PERFIL: Array<[RegExp, TipoCambio]> = [
  [/^(team|teamIds|teamSpecialties)$/, "profesional.editar"],
  [/^(teamHours|openingHours)$/, "horario.editar"],
  [/^preguntas/, "preguntas.editar"],
];

function resumenPerfil(tipo: TipoCambio, claves: string[]): string {
  if (tipo === "perfil.publicar") return "Publicada tu web";
  if (tipo === "perfil.restaurar") return "Restaurada una versión de tu web";
  if (tipo === "profesional.editar") return "Cambiado el equipo";
  if (tipo === "horario.editar") return claves.includes("openingHours") ? "Cambiado el horario del salón" : "Cambiado el horario del equipo";
  if (tipo === "preguntas.editar") return "Cambiadas las preguntas al reservar";
  const hay = (re: RegExp) => claves.some((k) => re.test(k));
  if (hay(/^colores/)) return "Cambiado un color del calendario";
  if (hay(/^plantillas$/)) return "Cambiado un mensaje de WhatsApp";
  if (hay(/^deposit/)) return "Guardada la señal";
  if (hay(/^noShow|^recargo/)) return "Guardados los plantones";
  return "Guardados los ajustes";
}

/**
 * Guardar en el perfil lo que la dueña cambia a mano (equipo, horarios,
 * preguntas, ajustes, la web), con su cambio deshacible. Las escrituras
 * automáticas (sincronizar, cargar una demo) siguen llamando a
 * `updateSalonProfile` y no dejan rastro.
 */
export function guardarPerfil(patch: Partial<SalonProfile> & Record<string, unknown>, tipo?: TipoCambio): Cambio | null {
  const st = useSalonStore.getState();
  if (pausa > 0) {
    st.updateSalonProfile(patch);
    return null;
  }
  const claves = Object.keys(patch);
  const perfil = () => useSalonStore.getState().salonProfile as unknown as Record<string, unknown>;
  const antes = Object.fromEntries(claves.map((k) => [k, perfil()[k] ?? null]));
  st.updateSalonProfile(patch);
  const despues = Object.fromEntries(claves.map((k) => [k, perfil()[k] ?? null]));
  const t: TipoCambio = tipo ?? tipoPerfil ?? TIPO_PERFIL.find(([re]) => claves.some((k) => re.test(k)))?.[1] ?? "ajustes.editar";
  const m = miembroAhora();
  const c = registrarCambioPuro({
    id: nuevoIdCambio(), tipo: t, entidad: "perfil", idEntidad: claves.join(","), antes, despues, resumen: resumenPerfil(t, claves),
    autor: m?.userId ?? null, autorNombre: m?.displayName ?? null, fecha: new Date().toISOString(),
  });
  if (c) registrar(c);
  return c;
}

let instalado = false;
export function instalarRegistro() {
  if (instalado) return;
  instalado = true;
  let profundidad = 0;
  const st = useSalonStore.getState() as unknown as Record<string, unknown>;
  const envueltas: Record<string, unknown> = {};

  const foto = (entidad: EntidadCambio, id: string): Record<string, unknown> | null => {
    const s = useSalonStore.getState();
    if (entidad === "cita") return (s.appointments.find((a) => a.id === id) as unknown as Record<string, unknown>) ?? null;
    if (entidad === "clienta") return (s.clients.find((c) => c.id === id) as unknown as Record<string, unknown>) ?? null;
    return { servicio: s.services.find((x) => x.id === id) ?? null };
  };
  const autoria = () => {
    const m = miembroAhora();
    return { autor: m?.userId ?? null, autorNombre: m?.displayName ?? null, fecha: new Date().toISOString() };
  };

  for (const { accion, entidad } of ACCIONES_REGISTRADAS) {
    const original = st[accion] as ((...a: unknown[]) => unknown) | undefined;
    if (typeof original !== "function") continue;
    envueltas[accion] = (...args: unknown[]) => {
      if (profundidad > 0 || pausa > 0) return original(...args);
      const id = String(args[0]);
      profundidad++;
      try {
        const antes = foto(entidad, id);
        const r = original(...args);
        const despues = foto(entidad, id);
        if (antes && despues) {
          const tz = (useSalonStore.getState().salonProfile as { timeZone?: string }).timeZone || "Europe/Madrid";
          let tipo: TipoCambio;
          let resumen: string;
          if (entidad === "cita") {
            tipo = tipoCambioCita(antes as Partial<Appointment>, despues as Partial<Appointment>);
            resumen = resumenCita(tipo, antes as Partial<Appointment>, despues as Partial<Appointment>, tz);
          } else if (entidad === "clienta") {
            tipo = tipoCambioClienta(accion, args, antes as Partial<Client>, despues as Partial<Client>);
            resumen = resumenClienta(tipo, despues as Partial<Client>);
          } else {
            tipo = accion === "deleteService" ? "servicio.borrar" : "servicio.editar";
            resumen = resumenServicio(tipo, (antes.servicio as Service) ?? null, (despues.servicio as Service) ?? null);
          }
          const c = registrarCambioPuro({ id: nuevoIdCambio(), tipo, entidad, idEntidad: id, antes, despues, resumen, ...autoria() });
          if (c) registrar(c);
        }
        return r;
      } finally {
        profundidad--;
      }
    };
  }

  for (const accion of ACCIONES_SIN_REGISTRO) {
    const original = st[accion] as ((...a: unknown[]) => unknown) | undefined;
    if (typeof original === "function") envueltas[accion] = (...args: unknown[]) => enPausa(() => original(...args));
  }
  useSalonStore.setState(envueltas);
}
