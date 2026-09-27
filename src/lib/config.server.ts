import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** Lote 13: calendarios externos. Ver docs/contrato-calendarios.md §8. */
export function getConfigCalendarios() {
  return {
    googleClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    googleRedirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    claveCifrado: process.env.CALENDARIO_CLAVE_CIFRADO,
    cronSecret: process.env.CRON_SECRET,
    appleBaseUrl: process.env.APPLE_CALDAV_BASE_URL,
    // La propia URL pública del sitio, para construir la `address` del canal
    // watch de Google y la redirect_uri si algún día se deriva sola. Hoy
    // solo se usa para el watch. Ver `urlPublicaDelSitio`.
    siteUrl: urlPublicaDelSitio(),
  };
}

/**
 * URL pública y estable del sitio, sin barra final: la que puede llamar un
 * tercero (el aviso push de Google Calendar) sin toparse con el login.
 *
 * Orden (lote 17): `SITE_URL` (la fija el equipo, p. ej. `https://sishow.es`)
 * → `VERCEL_PROJECT_PRODUCTION_URL` (dominio de producción que expone Vercel,
 * sin protocolo) → `VERCEL_URL` (la URL única del despliegue) solo como
 * último recurso. Antes se usaba `VERCEL_URL` primero, y esa URL la protege
 * la SSO de Vercel (`ssoProtection: all_except_custom_domains`): Google
 * recibía un 302 al login y el canal watch no servía.
 */
export function urlPublicaDelSitio(env: Record<string, string | undefined> = process.env): string | undefined {
  const normalizar = (valor: string | undefined): string | undefined => {
    const v = valor?.trim();
    if (!v) return undefined;
    const conProtocolo = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    return conProtocolo.replace(/\/+$/, "");
  };
  return normalizar(env.SITE_URL) ?? normalizar(env.VERCEL_PROJECT_PRODUCTION_URL) ?? normalizar(env.VERCEL_URL);
}
