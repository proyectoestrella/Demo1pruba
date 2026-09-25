import { slugify } from "./demo-profile";

/**
 * Logos de las demos de venta, servidos desde `public/demo/`. Lista estática
 * y no un campo en el enlace `?d=`: el logo no engorda el enlace, y basta con
 * dejar el fichero y añadir aquí su salón. Solo se usan en modo demo; un salón
 * real que se llame igual no hereda el logo de la demo.
 */
export const LOGOS_DEMO: Record<string, string> = {
  peluchic: "/demo/peluchic-logo.png",
};

/** El logo que se pinta: el del perfil; si no hay y es una demo conocida, el suyo; si no, ninguno. */
export function logoDelSalon(perfil: { name: string; logoUrl?: string }, esDemo: boolean): string | null {
  const propio = perfil.logoUrl?.trim();
  if (propio) return propio;
  if (!esDemo) return null;
  return LOGOS_DEMO[slugify(perfil.name)] ?? null;
}
