import { decodeDemoProfile } from "./demo-profile";

/**
 * El slug que puede resolver el panel contra el servidor.
 *
 * Una demo codificada nunca usa el salón guardado en el navegador: el perfil
 * de la URL se aplica después de la puerta, y una respuesta asíncrona del
 * salón anterior no debe poder sobrescribirlo.
 */
export function slugResolvibleDelPanel({
  slugDesdeUrl,
  demoRaw,
  slugGuardado,
}: {
  slugDesdeUrl: unknown;
  demoRaw: unknown;
  slugGuardado: string | null | undefined;
}): string | undefined {
  if (decodeDemoProfile(typeof demoRaw === "string" ? demoRaw : undefined)) return undefined;
  return typeof slugDesdeUrl === "string" && slugDesdeUrl
    ? slugDesdeUrl
    : slugGuardado || undefined;
}
