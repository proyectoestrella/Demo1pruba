/**
 * Almacén de `persist` que NO escribe en cada cambio.
 *
 * La copia local del salón pesa ~1,3 MB en la demo y cada `set` de la store la
 * serializaba y la escribía entera, en el hilo principal (medido: ~235 ms con
 * la CPU a x4 solo al entrar en el panel). Aquí se guarda en memoria el último
 * estado y se escribe UNA vez, cuando la pestaña lleva un rato sin cambios o
 * en cuanto se oculta o se cierra (`pagehide` / `visibilitychange`), de modo
 * que no se pierde nada. Las lecturas ven siempre lo último, escrito o no.
 */
import type { PersistStorage, StorageValue } from "zustand/middleware";

const ESPERA_MS = 700;

let pendiente: { clave: string; valor: StorageValue<unknown> } | null = null;
let temporizador: ReturnType<typeof setTimeout> | undefined;
let escuchando = false;
let puedeEscribir: () => boolean = () => true;

function volcar(): void {
  if (temporizador !== undefined) clearTimeout(temporizador);
  temporizador = undefined;
  const p = pendiente;
  pendiente = null;
  if (!p || !puedeEscribir()) return;
  try {
    window.localStorage.setItem(p.clave, JSON.stringify(p.valor));
  } catch (err) {
    console.warn("No se pudo guardar la copia local:", err);
  }
}

/** Descarta lo que esté esperando para escribirse (cierre de sesión: nada debe resucitar). */
export function cancelarEscrituraDiferida(): void {
  if (temporizador !== undefined) clearTimeout(temporizador);
  temporizador = undefined;
  pendiente = null;
}

/** Escribe ya lo pendiente (pruebas, y antes de navegar fuera). */
export function volcarEscrituraDiferida(): void {
  volcar();
}

function escuchar(): void {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;
  window.addEventListener("pagehide", volcar);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") volcar();
  });
}

export function crearAlmacenDiferido<S>(opciones?: { puedeEscribir?: () => boolean }): PersistStorage<S> {
  if (opciones?.puedeEscribir) puedeEscribir = opciones.puedeEscribir;
  return {
    getItem: (clave) => {
      if (typeof window === "undefined") return null;
      if (pendiente?.clave === clave) return pendiente.valor as StorageValue<S>;
      const crudo = window.localStorage.getItem(clave);
      return crudo === null ? null : (JSON.parse(crudo) as StorageValue<S>);
    },
    setItem: (clave, valor) => {
      if (typeof window === "undefined") return;
      escuchar();
      pendiente = { clave, valor: valor as StorageValue<unknown> };
      if (temporizador !== undefined) clearTimeout(temporizador);
      temporizador = setTimeout(volcar, ESPERA_MS);
    },
    removeItem: (clave) => {
      if (typeof window === "undefined") return;
      if (pendiente?.clave === clave) cancelarEscrituraDiferida();
      window.localStorage.removeItem(clave);
    },
  };
}
