import { useSyncExternalStore } from "react";

/**
 * Cómo se abre cada ficha: «centrada» (pop-up) o «lateral» (anclada a la
 * derecha, como antes). Se recuerda en este navegador, por tipo de ficha:
 * quien ancla las clientas puede seguir viendo las citas centradas.
 * Desactivar el pop-up de las citas = dejar su modo en «lateral».
 */
export type TipoFicha = "clienta" | "cita";
export type ModoFicha = "centrada" | "lateral";
export type PreferenciaFichas = Record<TipoFicha, ModoFicha>;

export const CLAVE_FICHAS = "sishow-fichas-modo";
export const PREFERENCIA_POR_DEFECTO: PreferenciaFichas = { clienta: "centrada", cita: "centrada" };

const oyentes = new Set<() => void>();
let cache: PreferenciaFichas | null = null;

export function leerPreferencia(almacen: Pick<Storage, "getItem"> | null = tryStorage()): PreferenciaFichas {
  try {
    const crudo = almacen?.getItem(CLAVE_FICHAS);
    if (!crudo) return PREFERENCIA_POR_DEFECTO;
    const v = JSON.parse(crudo) as Partial<PreferenciaFichas>;
    return {
      clienta: v.clienta === "lateral" ? "lateral" : "centrada",
      cita: v.cita === "lateral" ? "lateral" : "centrada",
    };
  } catch {
    return PREFERENCIA_POR_DEFECTO;
  }
}

function tryStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function fijarModoFicha(tipo: TipoFicha, modo: ModoFicha, almacen: Pick<Storage, "setItem" | "getItem"> | null = tryStorage()) {
  const nueva = { ...leerPreferencia(almacen), [tipo]: modo };
  try {
    almacen?.setItem(CLAVE_FICHAS, JSON.stringify(nueva));
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
  cache = nueva;
  for (const o of oyentes) o();
}

function instantanea(): PreferenciaFichas {
  if (!cache) cache = leerPreferencia();
  return cache;
}

export function useModoFicha(tipo: TipoFicha): ModoFicha {
  const p = useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      const alStorage = (e: StorageEvent) => {
        if (e.key === CLAVE_FICHAS) {
          cache = leerPreferencia();
          o();
        }
      };
      window.addEventListener("storage", alStorage);
      return () => {
        oyentes.delete(o);
        window.removeEventListener("storage", alStorage);
      };
    },
    instantanea,
    () => PREFERENCIA_POR_DEFECTO,
  );
  return p[tipo];
}

/** Solo para pruebas: olvida la copia en memoria. */
export function reiniciarCachePreferencia() {
  cache = null;
}

/**
 * Cómo se pinta de verdad según la pantalla: en móvil siempre hoja a pantalla
 * completa; por debajo de 1024 px la agenda no cabe al lado, así que siempre
 * centrada; con sitio de sobra, la preferencia.
 */
export type Presentacion = "pantalla" | "centrada" | "lateral";
export function presentacionDeFicha(modo: ModoFicha, anchoVentana: number): Presentacion {
  if (anchoVentana < 640) return "pantalla";
  if (anchoVentana < 1024) return "centrada";
  return modo;
}
