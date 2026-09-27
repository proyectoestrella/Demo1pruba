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

/** Logotipos (nombre en caligrafía, sin fondo) de las demos de venta, por tono. */
export const LOGOTIPOS_DEMO: Record<string, { claro: string; oscuro: string }> = {
  peluchic: { claro: "/demo/peluchic-logotipo-blanco.png", oscuro: "/demo/peluchic-logotipo-oscuro.png" },
};

/**
 * El logotipo para un fondo: `claro` = letras blancas (sobre foto u oscuro),
 * `oscuro` = letras oscuras (sobre fondo claro). El del perfil manda; si no
 * hay y es una demo conocida, el suyo; si no, null (se pinta como siempre).
 */
export function logotipoDelSalon(
  perfil: { name: string; logotipoClaroUrl?: string; logotipoOscuroUrl?: string },
  esDemo: boolean,
  tono: "claro" | "oscuro",
): string | null {
  const propio = (tono === "claro" ? perfil.logotipoClaroUrl : perfil.logotipoOscuroUrl)?.trim();
  if (propio) return propio;
  if (!esDemo) return null;
  return LOGOTIPOS_DEMO[slugify(perfil.name)]?.[tono] ?? null;
}
