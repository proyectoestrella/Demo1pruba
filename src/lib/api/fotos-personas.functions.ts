/**
 * Fotos reales de clientas y equipo (servidor). Toda la lógica y los permisos
 * están en `fotos-personas.core.ts`; aquí solo se enchufan sesión y Supabase.
 * Una demo no llama a estas funciones: sus fotos viven en el navegador.
 * Sin `supabase/fotos-personas.sql` aplicado responden `{ disponible: false }`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseServerClient } from "../supabase.server";
import { exigirAcceso } from "./autorizacion.server";
import * as core from "./fotos-personas.core";
import { conSesion } from "./sesion.middleware";

const slug = z.string().min(1).max(120);
const tipo = z.enum(["equipo", "clienta"]);
const personaId = z.string().min(1).max(120);

async function contexto(s: string) {
  const a = await exigirAcceso(s);
  return { a, sb: getSupabaseServerClient() };
}

export const fotosActivasDelSalon = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug }))
  .handler(async ({ data }) => {
    const { a, sb } = await contexto(data.slug);
    if (!sb) return { disponible: false as const };
    return core.fotosActivas(sb, data.slug, a);
  });

export const listarFotosDePersona = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, tipo, personaId }))
  .handler(async ({ data }) => {
    const { a, sb } = await contexto(data.slug);
    if (!sb) return { disponible: false as const };
    return core.listarFotos(sb, data.slug, a, data.tipo, data.personaId);
  });

export const subirFotoDePersona = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, tipo, personaId, datos: z.string().min(1).max(300_000) }))
  .handler(async ({ data }) => {
    const { a, sb } = await contexto(data.slug);
    if (!sb) return { disponible: false as const };
    return core.subirFoto(sb, data.slug, a, data.tipo, data.personaId, data.datos);
  });

export const activarFotoDePersona = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, tipo, personaId, fotoId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { a, sb } = await contexto(data.slug);
    if (!sb) return { disponible: false as const };
    return core.activarFoto(sb, data.slug, a, data.tipo, data.personaId, data.fotoId);
  });

export const quitarFotoDePersona = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, tipo, personaId }))
  .handler(async ({ data }) => {
    const { a, sb } = await contexto(data.slug);
    if (!sb) return { disponible: false as const };
    return core.quitarFotoActiva(sb, data.slug, a, data.tipo, data.personaId);
  });
