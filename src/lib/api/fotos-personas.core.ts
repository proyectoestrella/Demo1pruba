/**
 * Lógica de las fotos reales de personas, sin cableado: recibe el cliente de
 * Supabase (service role) y quién llama. Así se prueba con un doble.
 *
 * Quién puede qué:
 *  - Ver las fotos: equipo, cualquier miembro; clientas, quien pueda ver clientas.
 *  - Cambiarlas: equipo, `equipo.editar` o la propia profesional vinculada a su
 *    ficha; clientas, `clienta.editar`.
 * La autora sale de la sesión, nunca del cuerpo de la petición.
 */
import { PermisoDenegado, tienePermiso, type Acceso } from "./autorizacion";
import {
  MAX_FOTOS_POR_PERSONA,
  MENSAJE_VALIDACION,
  VIGENCIA_URL_S,
  bytesDeBase64,
  carpetaDeTipo,
  claveFoto,
  esTipoFoto,
  idPersonaValido,
  rutaFoto,
  validarBytesFoto,
  type TipoFoto,
} from "../fotos-personas";

export const BUCKET_FOTOS = "fotos-personas";
type Miembro = Extract<Acceso, { tipo: "miembro" }>;

/* eslint-disable @typescript-eslint/no-explicit-any */
export type SupabaseFotos = any;

export class FotoInvalida extends Error {
  readonly code = "FOTO_INVALIDA";
}

export interface FotoPersona {
  id: string;
  creado: string;
  activa: boolean;
  url: string;
}

export function puedeVerFotos(a: Acceso, tipo: TipoFoto): boolean {
  if (a.tipo !== "miembro") return false;
  return tipo === "equipo" ? true : tienePermiso(a, "clienta.ver");
}

export function puedeCambiarFotos(a: Acceso, tipo: TipoFoto, personaId: string): boolean {
  if (a.tipo !== "miembro") return false;
  if (tipo === "equipo") return tienePermiso(a, "equipo.editar") || (!!a.employeeId && a.employeeId === personaId);
  return tienePermiso(a, "clienta.editar");
}

function exigirCambiar(a: Acceso, tipo: TipoFoto, personaId: string): Miembro {
  if (!esTipoFoto(tipo) || !idPersonaValido(personaId)) throw new FotoInvalida("Persona no válida.");
  if (!puedeCambiarFotos(a, tipo, personaId)) throw new PermisoDenegado(tipo === "equipo" ? "equipo.editar" : "clienta.editar");
  return a as Miembro;
}

/** La tabla o el bucket aún no existen (el SQL no está aplicado). */
export function faltaEsquema(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return err.code === "42P01" || err.code === "PGRST205" || m.includes("fotos_personas") || m.includes("bucket not found") || m.includes("schema cache");
}

export type Resultado<T> = ({ disponible: true } & T) | { disponible: false };
const NO_DISPONIBLE = { disponible: false } as const;

async function firmar(sb: SupabaseFotos, rutas: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rutas.length === 0) return out;
  const { data, error } = await sb.storage.from(BUCKET_FOTOS).createSignedUrls(rutas, VIGENCIA_URL_S);
  if (error) throw new Error(error.message);
  for (const f of (data ?? []) as Array<{ path: string; signedUrl: string | null }>) if (f.signedUrl) out.set(f.path, f.signedUrl);
  return out;
}

type Fila = { id: string; tipo: TipoFoto; persona_id: string; ruta: string; creado: string; activa: boolean };

/** Foto activa de cada persona del salón: clave `tipo:id` → URL firmada. */
export async function fotosActivas(sb: SupabaseFotos, slug: string, a: Acceso): Promise<Resultado<{ fotos: Record<string, string> }>> {
  if (a.tipo !== "miembro") throw new PermisoDenegado("clienta.ver");
  const { data, error } = await sb.from("fotos_personas").select("id,tipo,persona_id,ruta,creado,activa").eq("salon_slug", slug).eq("activa", true);
  if (error) {
    if (faltaEsquema(error)) return NO_DISPONIBLE;
    throw new Error(error.message);
  }
  const filas = ((data ?? []) as Fila[]).filter((f) => puedeVerFotos(a, f.tipo));
  const urls = await firmar(sb, filas.map((f) => f.ruta));
  const fotos: Record<string, string> = {};
  for (const f of filas) { const u = urls.get(f.ruta); if (u) fotos[claveFoto(f.tipo, f.persona_id)] = u; }
  return { disponible: true, fotos };
}

/** Historial de una persona, de la más reciente a la más antigua. */
export async function listarFotos(sb: SupabaseFotos, slug: string, a: Acceso, tipo: TipoFoto, personaId: string): Promise<Resultado<{ fotos: FotoPersona[] }>> {
  if (!esTipoFoto(tipo) || !idPersonaValido(personaId)) throw new FotoInvalida("Persona no válida.");
  if (!puedeVerFotos(a, tipo)) throw new PermisoDenegado(tipo === "equipo" ? "equipo.editar" : "clienta.ver");
  const { data, error } = await sb.from("fotos_personas").select("id,tipo,persona_id,ruta,creado,activa")
    .eq("salon_slug", slug).eq("tipo", tipo).eq("persona_id", personaId).order("creado", { ascending: false });
  if (error) {
    if (faltaEsquema(error)) return NO_DISPONIBLE;
    throw new Error(error.message);
  }
  const filas = (data ?? []) as Fila[];
  const urls = await firmar(sb, filas.map((f) => f.ruta));
  return { disponible: true, fotos: filas.filter((f) => urls.has(f.ruta)).map((f) => ({ id: f.id, creado: f.creado, activa: f.activa, url: urls.get(f.ruta)! })) };
}

async function dejarActiva(sb: SupabaseFotos, slug: string, tipo: TipoFoto, personaId: string, id: string | null) {
  const q = await sb.from("fotos_personas").update({ activa: false }).eq("salon_slug", slug).eq("tipo", tipo).eq("persona_id", personaId).eq("activa", true);
  if (q.error) throw new Error(q.error.message);
  if (id) {
    const r = await sb.from("fotos_personas").update({ activa: true }).eq("id", id).eq("salon_slug", slug).eq("tipo", tipo).eq("persona_id", personaId);
    if (r.error) throw new Error(r.error.message);
  }
}

/** Sube una foto ya comprimida (base64), la registra y la deja como activa. */
export async function subirFoto(
  sb: SupabaseFotos, slug: string, a: Acceso, tipo: TipoFoto, personaId: string, datosBase64: string,
  nuevoUuid: () => string = () => crypto.randomUUID(),
): Promise<Resultado<{ foto: FotoPersona }>> {
  const quien = exigirCambiar(a, tipo, personaId);
  let bytes: Uint8Array;
  try { bytes = bytesDeBase64(datosBase64); } catch { throw new FotoInvalida(MENSAJE_VALIDACION.formato); }
  const v = validarBytesFoto(bytes);
  if (!v.ok) throw new FotoInvalida(MENSAJE_VALIDACION[v.motivo]);

  const probe = await sb.from("fotos_personas").select("id").eq("salon_slug", slug).limit(1);
  if (probe.error) {
    if (faltaEsquema(probe.error)) return NO_DISPONIBLE;
    throw new Error(probe.error.message);
  }
  const ruta = rutaFoto(slug, tipo, personaId, nuevoUuid(), v.mime);
  const sube = await sb.storage.from(BUCKET_FOTOS).upload(ruta, v.bytes, { contentType: v.mime, upsert: false });
  if (sube.error) {
    if (faltaEsquema(sube.error)) return NO_DISPONIBLE;
    throw new Error(sube.error.message);
  }
  const id = nuevoUuid();
  const ins = await sb.from("fotos_personas").insert({ id, salon_slug: slug, tipo, persona_id: personaId, ruta, creado_por: quien.userId, activa: false });
  if (ins.error) {
    await sb.storage.from(BUCKET_FOTOS).remove([ruta]);
    throw new Error(ins.error.message);
  }
  await dejarActiva(sb, slug, tipo, personaId, id);
  await podar(sb, slug, tipo, personaId);
  const url = (await firmar(sb, [ruta])).get(ruta) ?? "";
  return { disponible: true, foto: { id, creado: new Date().toISOString(), activa: true, url } };
}

/** Borra las más antiguas que no sean la activa, para no acumular sin fin. */
async function podar(sb: SupabaseFotos, slug: string, tipo: TipoFoto, personaId: string) {
  const { data } = await sb.from("fotos_personas").select("id,ruta,activa,creado")
    .eq("salon_slug", slug).eq("tipo", tipo).eq("persona_id", personaId).order("creado", { ascending: false });
  const filas = (data ?? []) as Array<Pick<Fila, "id" | "ruta" | "activa">>;
  const sobran = filas.slice(MAX_FOTOS_POR_PERSONA).filter((f) => !f.activa);
  if (sobran.length === 0) return;
  await sb.storage.from(BUCKET_FOTOS).remove(sobran.map((f) => f.ruta));
  for (const f of sobran) await sb.from("fotos_personas").delete().eq("id", f.id);
}

/** Vuelve a poner una foto anterior como activa. */
export async function activarFoto(sb: SupabaseFotos, slug: string, a: Acceso, tipo: TipoFoto, personaId: string, fotoId: string): Promise<Resultado<{ foto: FotoPersona }>> {
  exigirCambiar(a, tipo, personaId);
  const { data, error } = await sb.from("fotos_personas").select("id,tipo,persona_id,ruta,creado,activa")
    .eq("id", fotoId).eq("salon_slug", slug).eq("tipo", tipo).eq("persona_id", personaId).maybeSingle();
  if (error) {
    if (faltaEsquema(error)) return NO_DISPONIBLE;
    throw new Error(error.message);
  }
  if (!data) throw new FotoInvalida("Esa foto ya no está.");
  const fila = data as Fila;
  await dejarActiva(sb, slug, tipo, personaId, fila.id);
  const url = (await firmar(sb, [fila.ruta])).get(fila.ruta) ?? "";
  return { disponible: true, foto: { id: fila.id, creado: fila.creado, activa: true, url } };
}

/** «Volver al avatar dibujado»: ninguna foto activa; el historial se conserva. */
export async function quitarFotoActiva(sb: SupabaseFotos, slug: string, a: Acceso, tipo: TipoFoto, personaId: string): Promise<Resultado<object>> {
  exigirCambiar(a, tipo, personaId);
  try { await dejarActiva(sb, slug, tipo, personaId, null); } catch (e) {
    if (faltaEsquema(e as Error)) return NO_DISPONIBLE;
    throw e;
  }
  return { disponible: true };
}

export { carpetaDeTipo };
