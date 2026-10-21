/**
 * El nombre de la clienta llega a la pantalla de confirmación por
 * sessionStorage, no por la URL: una URL acaba en el historial, en capturas,
 * en el portapapeles y en los registros del servidor. Si se recarga la pestaña
 * el nombre sigue ahí (misma pestaña); si se abre el enlace en otra, la
 * confirmación se muestra igual, solo sin el nombre.
 */
const CLAVE = "siShow:confirmacion-nombre";

type Almacen = Pick<Storage, "getItem" | "setItem">;

function almacenPorDefecto(): Almacen | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function guardarNombreConfirmacion(nombre: string, almacen: Almacen | null = almacenPorDefecto()): void {
  try {
    almacen?.setItem(CLAVE, nombre.trim().slice(0, 120));
  } catch {
    // Almacenamiento bloqueado: la confirmación sale sin nombre.
  }
}

export function leerNombreConfirmacion(almacen: Almacen | null = almacenPorDefecto()): string {
  try {
    return almacen?.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
}
