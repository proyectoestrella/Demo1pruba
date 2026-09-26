/**
 * OAuth de Google Calendar, lado servidor. Todo lo que habla con Google entra
 * por `fetchImpl` inyectado (misma convención que `email.server.ts` /
 * `proveedorDeCorreo`), así que se prueba entero sin red.
 *
 * Scopes mínimos: `calendar.events` (crear/editar/borrar SUS eventos, no lee
 * el resto del calendario) + `calendar.freebusy` (solo "ocupado/libre", nunca
 * el título ni el detalle de una cita ajena) + `userinfo.email` (para poder
 * enseñar qué cuenta está conectada en el panel).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SCOPES_GOOGLE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Lo que se necesita recordar entre "iniciar" y "callback", viajando dentro del `state` — nunca en una tabla. */
export interface EstadoOAuth {
  salonSlug: string;
  employeeId: string | null;
  userId: string;
  nonce: string;
  /** Epoch ms de caducidad: un `state` de hace más de 10 minutos no vale. */
  exp: number;
}

const DURACION_STATE_MS = 10 * 60_000;

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Firma y empaqueta el estado. Es autocontenido: no hace falta guardar nada en el servidor entre el paso 1 y el 2. */
export function codificarEstado(datos: Omit<EstadoOAuth, "nonce" | "exp">, secreto: string, ahora = Date.now()): string {
  const payload: EstadoOAuth = { ...datos, nonce: randomBytes(9).toString("hex"), exp: ahora + DURACION_STATE_MS };
  const json = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const firma = base64url(createHmac("sha256", secreto).update(json).digest());
  return `${json}.${firma}`;
}

/** Verifica la firma y la caducidad. Nunca lanza: un `state` inválido devuelve null. */
export function decodificarEstado(state: string, secreto: string, ahora = Date.now()): EstadoOAuth | null {
  const sep = state.indexOf(".");
  if (sep < 0) return null;
  const json = state.slice(0, sep);
  const firma = state.slice(sep + 1);
  const esperada = base64url(createHmac("sha256", secreto).update(json).digest());
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as EstadoOAuth;
    if (typeof payload.exp !== "number" || payload.exp < ahora) return null;
    if (typeof payload.salonSlug !== "string" || typeof payload.userId !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/** La URL a la que se redirige al panel para arrancar el consentimiento de Google. */
export function urlDeAutorizacion(config: ConfigGoogle, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    // `consent` a propósito siempre: sin esto Google solo manda refresh_token
    // la PRIMERA vez que un usuario concede el permiso; si alguna vez se
    // desconecta y reconecta, hace falta el refresh_token de nuevo.
    prompt: "consent",
    scope: SCOPES_GOOGLE.join(" "),
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokensGoogle {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

/** Intercambia el `code` del callback por los tokens. Lanza si Google responde con error. */
export async function intercambiarCodigo(
  config: ConfigGoogle,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokensGoogle> {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google OAuth (token): ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { accessToken: json.access_token, refreshToken: json.refresh_token ?? null, expiresIn: json.expires_in };
}

/** Renueva el access token a partir del refresh token guardado. */
export async function refrescarToken(
  config: Pick<ConfigGoogle, "clientId" | "clientSecret">,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google OAuth (refresh): ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

/** El email de la cuenta conectada, solo para pintarlo en el panel. */
export async function correoDeLaCuenta(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const res = await fetchImpl(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const json = (await res.json()) as { email?: string };
  return json.email ?? null;
}
