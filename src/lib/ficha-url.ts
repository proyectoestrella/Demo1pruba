/**
 * Las fichas (clienta y cita) viven en la URL: `?clienta=<id>` y `?cita=<id>`.
 * Así un enlace abre la ficha, recargar la conserva y «atrás» la cierra.
 * Solo hay una abierta a la vez; si por lo que sea llegan las dos, manda la cita.
 * Lo demás de la URL (`?d=` de la demo, `?s=`, `?v=`…) se respeta tal cual.
 */
export const PARAM_CLIENTA = "clienta";
export const PARAM_CITA = "cita";

export type FichaAbierta =
  | { tipo: "clienta"; id: string }
  | { tipo: "cita"; id: string }
  | null;

function texto(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Qué ficha pide la URL (null = ninguna). */
export function fichaDeBusqueda(search: Record<string, unknown> | undefined | null): FichaAbierta {
  const cita = texto(search?.[PARAM_CITA]);
  if (cita) return { tipo: "cita", id: cita };
  const clienta = texto(search?.[PARAM_CLIENTA]);
  if (clienta) return { tipo: "clienta", id: clienta };
  return null;
}

/** La misma búsqueda con otra ficha abierta (o ninguna), sin tocar el resto. */
export function busquedaConFicha(search: Record<string, unknown> | undefined | null, ficha: FichaAbierta): Record<string, unknown> {
  const salida: Record<string, unknown> = { ...(search ?? {}) };
  delete salida[PARAM_CLIENTA];
  delete salida[PARAM_CITA];
  if (ficha) salida[ficha.tipo === "clienta" ? PARAM_CLIENTA : PARAM_CITA] = ficha.id;
  return salida;
}

/** Enlace compartible a una ficha, partiendo de la URL actual. */
export function enlaceDeFicha(href: string, ficha: Exclude<FichaAbierta, null>): string {
  const url = new URL(href);
  url.searchParams.delete(PARAM_CLIENTA);
  url.searchParams.delete(PARAM_CITA);
  url.searchParams.set(ficha.tipo === "clienta" ? PARAM_CLIENTA : PARAM_CITA, ficha.id);
  return url.toString();
}

export function mismaFicha(a: FichaAbierta, b: FichaAbierta): boolean {
  return a?.tipo === b?.tipo && a?.id === b?.id;
}
