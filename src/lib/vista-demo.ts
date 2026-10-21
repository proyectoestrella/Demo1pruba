/**
 * Cómo se enseña una demo: «cliente» (como la ve la dueña del salón, con su
 * plan fijo y sin selector) o «prospecto» (con el conmutador de plan para
 * vender). Solo la demo de PeluChic tiene vista de cliente, y es la que abre
 * por defecto. La seguridad real nunca depende de esto: es solo presentación.
 */
import { create } from "zustand";
import type { PlanSishow } from "./plan";

export type VistaDemo = "cliente" | "prospecto";

/** Demos con vista de cliente, y el plan que contrata ese cliente. */
/**
 * PeluChic contrató el plan Básico anual (contrato del 28-sep, Anexo I):
 * sin asistente, sin caja ni analítica avanzada. Antes aquí ponía Estándar y
 * a María le salían Caja y el asistente como si fueran suyos (21-oct).
 */
export const PLAN_DEL_CLIENTE_DE_DEMO: Record<string, PlanSishow> = { peluchic: "reservas" };

export const CLAVE_VISTA_DEMO = "sishow-vista-demo-v1";

export function tieneVistaCliente(slug: string): boolean {
  return slug in PLAN_DEL_CLIENTE_DE_DEMO;
}

/**
 * La vista que toca: el parámetro del enlace (`?cliente=1` o `?prospecto=1`)
 * manda; si no, la recordada en la sesión; si no, cliente en PeluChic y
 * prospecto en cualquier otra demo.
 */
export function resolverVistaDemo(entrada: { slug: string; cliente?: unknown; prospecto?: unknown; guardada?: unknown }): VistaDemo {
  if (!tieneVistaCliente(entrada.slug)) return "prospecto";
  const activo = (v: unknown) => v === 1 || v === "1" || v === true || v === "true";
  if (activo(entrada.prospecto)) return "prospecto";
  if (activo(entrada.cliente)) return "cliente";
  if (entrada.guardada === "cliente" || entrada.guardada === "prospecto") return entrada.guardada;
  return "cliente";
}

export function leerVistaGuardada(slug: string, almacen?: Pick<Storage, "getItem"> | null): VistaDemo | null {
  try {
    const v = almacen?.getItem(`${CLAVE_VISTA_DEMO}:${slug}`);
    return v === "cliente" || v === "prospecto" ? v : null;
  } catch {
    return null;
  }
}

export function guardarVista(slug: string, vista: VistaDemo, almacen?: Pick<Storage, "setItem"> | null): void {
  try {
    almacen?.setItem(`${CLAVE_VISTA_DEMO}:${slug}`, vista);
  } catch {
    // Sin almacenamiento la vista vale solo para esta visita.
  }
}

function sesion(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

interface EstadoVista {
  vista: VistaDemo;
  fijar: (slug: string, vista: VistaDemo) => void;
}

export const useVistaDemo = create<EstadoVista>((set) => ({
  vista: "prospecto",
  fijar: (slug, vista) => {
    guardarVista(slug, vista, sesion());
    set({ vista });
  },
}));

/** Resuelve y fija la vista al entrar en una demo. */
export function entrarEnVistaDemo(slug: string, parametros: { cliente?: unknown; prospecto?: unknown } = {}): VistaDemo {
  const vista = resolverVistaDemo({ slug, ...parametros, guardada: leerVistaGuardada(slug, sesion()) });
  useVistaDemo.getState().fijar(slug, vista);
  return vista;
}

/**
 * Al recargar el panel de una demo (`/app/...` sin pasar por `/demo/<slug>`)
 * la store arranca en «prospecto» aunque la sesión recordara «cliente», y a
 * PeluChic le volvía a salir el selector de planes (revisión 21-oct). Vuelve
 * a resolver la vista con lo guardado y la fija si cambia.
 */
export function restaurarVistaDemo(slug: string): VistaDemo {
  const vista = resolverVistaDemo({ slug, guardada: leerVistaGuardada(slug, sesion()) });
  if (useVistaDemo.getState().vista !== vista) useVistaDemo.getState().fijar(slug, vista);
  return vista;
}

/** ¿Se está enseñando como cliente? Solo si la demo lo admite. */
export function esVistaCliente(slug: string, vista: VistaDemo): boolean {
  return vista === "cliente" && tieneVistaCliente(slug);
}
