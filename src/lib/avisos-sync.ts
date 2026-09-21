/**
 * Los avisos que el DUEÑO tiene que ver cuando algo no se ha guardado.
 *
 * Hasta ahora todo fallo de sincronización acababa en `console.error`: el
 * dueño movía una cita, la veía moverse en pantalla, cerraba el iPad y nunca
 * se enteraba de que ese cambio no había subido a ningún sitio. Aquí se
 * recogen esos fallos para que una franja en pantalla los cuente en español
 * llano y ofrezca volver a intentarlo.
 *
 * Es deliberadamente diminuto y sin dependencias de React: así lo pueden usar
 * tanto la store como los módulos de sincronización, y se puede probar en
 * unidad sin montar nada. El componente que lo pinta es
 * `src/components/AvisosDeSincronizacion.tsx`, que se suscribe con
 * `useSyncExternalStore`.
 */

export interface AvisoSync {
  /** Identificador estable de este aviso, para poder descartarlo. */
  id: string;
  /** Texto para el dueño. En español llano y SIN jerga técnica. */
  mensaje: string;
  /** Si existe, la franja ofrece un botón «Reintentar» que llama a esto. */
  reintentar?: () => void;
}

const VACIO: AvisoSync[] = [];

let avisos: AvisoSync[] = VACIO;
const oyentes = new Set<() => void>();
let contador = 0;

function emitir(): void {
  for (const oyente of oyentes) oyente();
}

/** Se suscribe a los cambios. Devuelve la función para darse de baja. */
export function suscribirAvisos(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Lista actual de avisos. La identidad del array solo cambia cuando cambia el
 * contenido: es lo que `useSyncExternalStore` necesita para no repintar en
 * bucle.
 */
export function leerAvisos(): AvisoSync[] {
  return avisos;
}

/** En el servidor nunca hay avisos: el fallo de guardado ocurre en el navegador. */
export function leerAvisosEnServidor(): AvisoSync[] {
  return VACIO;
}

/**
 * Registra un fallo visible.
 *
 * Se agrupa por mensaje: si el dueño mueve cinco citas y la red está caída, ve
 * un aviso por cada cosa distinta que no se guardó, no cinco veces el mismo
 * texto. El reintento que se guarda es siempre el último, que es el que
 * corresponde al estado actual de la pantalla.
 */
export function registrarAviso(mensaje: string, reintentar?: () => void): string {
  const existente = avisos.find((a) => a.mensaje === mensaje);
  if (existente) {
    avisos = avisos.map((a) => (a.id === existente.id ? { ...a, reintentar } : a));
    emitir();
    return existente.id;
  }
  contador += 1;
  const aviso: AvisoSync = { id: `aviso-${contador}`, mensaje, reintentar };
  avisos = [...avisos, aviso];
  emitir();
  return aviso.id;
}

/** Quita un aviso: o lo cerró el dueño, o el reintento funcionó. */
export function descartarAviso(id: string): void {
  if (!avisos.some((a) => a.id === id)) return;
  avisos = avisos.filter((a) => a.id !== id);
  if (avisos.length === 0) avisos = VACIO;
  emitir();
}

/** Borra todos los avisos. Solo para las pruebas y para cambios de salón. */
export function limpiarAvisos(): void {
  if (avisos.length === 0) return;
  avisos = VACIO;
  emitir();
}
