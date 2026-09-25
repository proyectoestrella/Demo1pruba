/**
 * Deshacer en toda la app (lote 12). Compatibilidad: adaptador sobre
 * `useSalonStore`, no una maqueta — el registro, el estado y el deshacer son
 * los de la store real:
 *   - el registro, el estado y el deshacer son los de `useSalonStore`
 *     (`cambios`, `estadoDeshacer`, `deshacerCambio`, `marcarAvisoEnviado`);
 *     las acciones ya vienen envueltas en store.ts, así que aquí NO se envuelve
 *     nada (se registraría dos veces);
 *   - `instalarRegistro()` ya no envuelve: ESCUCHA los cambios nuevos de la
 *     store y saca el aviso de 10 s (o los captura `conCambio`);
 *   - se quedan el aviso, la cola, Ctrl+Z y el aviso de «ya avisada».
 */
import { createElement } from "react";
import { toast } from "sonner";
import {
  SEGUNDOS_AVISO,
  textoClientaAvisada,
  textoMotivo,
  type Cambio,
  type EstadoDeshacer,
  type MotivoNoDeshacer,
  type TipoCambio,
} from "./cambios";
import { conRegistroEnPausa, nuevoIdCambio as nuevoIdDeLaStore, useSalonStore } from "./store";
import { whatsappUrl } from "./campanas";
import type { Appointment, SalonProfile } from "./mock/types";

/* ---------- el registro: el de la store ---------- */

/** Selector sobre los cambios de la store (misma forma que antes: `useCambios((s) => s.cambios)`). */
export function useCambios<T>(sel: (s: { cambios: Cambio[] }) => T): T {
  return useSalonStore((st) => sel({ cambios: st.cambios }));
}
useCambios.getState = () => ({ cambios: useSalonStore.getState().cambios });

export const nuevoIdCambio = nuevoIdDeLaStore;

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

/** Antes forzaba el tipo del perfil; la store ya registra campo a campo (perfil.campo). */
export function comoTipo<T>(_tipo: TipoCambio, fn: () => T): T {
  return fn();
}

export function estadoDeshacer(cambioId: string): EstadoDeshacer {
  return useSalonStore.getState().estadoDeshacer(cambioId);
}

export function deshacerCambio(cambioId: string): { ok: true; aviso?: "CLIENTA_AVISADA" } | { ok: false; motivo: MotivoNoDeshacer } {
  return useSalonStore.getState().deshacerCambio(cambioId);
}

export function marcarAvisoDeCita(citaId: string) {
  const c = useSalonStore.getState().cambios.find((x) => x.entidad === "cita" && x.idEntidad === citaId && !x.deshechoEn && !x.deshaceA);
  if (c) useSalonStore.getState().marcarAvisoEnviado(c.id);
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
  // Barra de tiempo discreta (12e): se vacía en 10 s y se para, como el aviso, al pasar el ratón.
  const barra = createElement("span", { className: "barra-deshacer", style: { animationDuration: `${SEGUNDOS_AVISO}s` }, "aria-hidden": true });
  toast(texto, { id: toastId, duration: SEGUNDOS_AVISO * 1000, description: barra, action: { label: "Deshacer", onClick: hacer } });
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
  const c = useSalonStore.getState().cambios.find((x) => x.id === cambioId)!;
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

/* ---------- el perfil ---------- */

function resumenPerfil(claves: string[]): string {
  const hay = (re: RegExp) => claves.some((k) => re.test(k));
  if (hay(/^(team|teamIds|teamSpecialties)$/)) return "Cambiado el equipo";
  if (hay(/^openingHours$/)) return "Cambiado el horario del salón";
  if (hay(/^teamHours$/)) return "Cambiado el horario del equipo";
  if (hay(/^preguntas/)) return "Cambiadas las preguntas al reservar";
  if (hay(/^colores/)) return "Cambiado un color del calendario";
  if (hay(/^plantillas$/)) return "Cambiado un mensaje de WhatsApp";
  if (hay(/^deposit/)) return "Guardada la señal";
  if (hay(/^noShow|^recargo/)) return "Guardados los plantones";
  return "Guardados los ajustes";
}

/**
 * Guardar en el perfil lo que la dueña cambia a mano. La store registra un
 * cambio por campo; aquí se juntan en UN aviso cuyo «Deshacer» los deshace
 * todos (del último al primero). Devuelve el último cambio.
 */
export function guardarPerfil(patch: Partial<SalonProfile> & Record<string, unknown>, _tipo?: TipoCambio): Cambio | null {
  let todos: Cambio[] = [];
  silencio++;
  const previos = capturados;
  capturados = [];
  try {
    useSalonStore.getState().updateSalonProfile(patch);
    todos = capturados;
  } finally {
    capturados = previos;
    silencio--;
  }
  if (!todos.length) return null;
  const ultimoCambio = todos[todos.length - 1];
  if (silencio > 0) capturados.push(...todos);
  else avisar(resumenPerfil(Object.keys(patch)), () => {
    for (const c of [...todos].reverse()) deshacerConAviso(c.id);
  }, ultimoCambio.id);
  return ultimoCambio;
}

/* ---------- escuchar los cambios de la store ---------- */

let instalado = false;
/** Cada cambio nuevo en la store saca su aviso de 10 s (salvo dentro de conCambio/guardarPerfil). */
export function instalarRegistro() {
  if (instalado) return;
  instalado = true;
  let conocidos = new Set(useSalonStore.getState().cambios.map((c) => c.id));
  useSalonStore.subscribe((st) => {
    const nuevos = st.cambios.filter((c) => !conocidos.has(c.id));
    if (!nuevos.length) return;
    conocidos = new Set(st.cambios.map((c) => c.id));
    for (const c of [...nuevos].reverse()) {
      if (c.deshaceA) continue; // el deshacer no se anuncia con otro «Deshacer»
      if (silencio > 0) capturados.push(c);
      else avisar(c.resumen, () => deshacerConAviso(c.id), c.id);
    }
  });
}

export { conRegistroEnPausa };
