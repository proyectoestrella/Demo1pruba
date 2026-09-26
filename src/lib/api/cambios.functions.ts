/**
 * Historial de cambios en el servidor (lote 9).
 *
 * - `guardarCambio`: sube un cambio registrado en el navegador. Idempotente
 *   por `id`. La autora NO la dice el navegador: sale del token de la sesión.
 *   Exige el permiso de la acción del cambio. Si es un deshacer, marca el
 *   original como deshecho. Limpia lo de más de 90 días al escribir (no hay
 *   cron).
 * - `listarCambios`: el historial para Ajustes › Historial de cambios; exige
 *   `historial.ver`.
 *
 * El dato en sí (la cita, la deuda, la carta) viaja por el parche de siempre,
 * que ya comprueba permisos (lote 8). Si la tabla aún no existe
 * (supabase/pendiente.sql sin aplicar), guardar no falla: se avisa y el
 * cambio sigue en el navegador.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { accionesDeCambio, DIAS_RETENCION, TIPOS_CAMBIO } from "../cambios";
import { getSupabaseServerClient } from "../supabase.server";
import { exigirAcceso } from "./autorizacion.server";
import { exigirAcciones } from "./guardas";
import { conSesion } from "./sesion.middleware";

const slug = z.string().min(1).max(120);

/** Valor JSON: lo único que viaja de vuelta al navegador. */
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const cambioSchema = z.object({
  id: z.string().min(8).max(64),
  tipo: z.enum(TIPOS_CAMBIO),
  entidad: z.enum(["cita", "clienta", "servicio", "perfil", "pago"]),
  idEntidad: z.string().min(1).max(200),
  antes: z.record(z.string(), z.unknown()),
  despues: z.record(z.string(), z.unknown()),
  resumen: z.string().max(300),
  fecha: z.string().min(10),
  deshaceA: z.string().optional(),
  avisoEnviado: z.boolean().default(false),
});

export const guardarCambio = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, cambio: cambioSchema }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    // Una demo no guarda historial en el servidor: vive en su navegador.
    if (quien.tipo !== "miembro") return { guardado: false as const, motivo: "demo" as const };
    exigirAcciones(quien, accionesDeCambio(data.cambio));
    const sb = getSupabaseServerClient();
    if (!sb) return { guardado: false as const, motivo: "sin-backend" as const };
    const c = data.cambio;
    const { error } = await sb.from("cambios").upsert(
      {
        id: c.id, salon_slug: data.slug, tipo: c.tipo, entidad: c.entidad, id_entidad: c.idEntidad,
        antes: c.antes, despues: c.despues, resumen: c.resumen,
        autor: quien.userId, autor_nombre: quien.displayName, fecha: c.fecha,
        deshace_a: c.deshaceA ?? null, aviso_enviado: c.avisoEnviado,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) {
      console.warn(`guardarCambio (¿falta aplicar supabase/pendiente.sql?): ${error.message}`);
      return { guardado: false as const, motivo: "sin-tabla" as const };
    }
    if (c.deshaceA) {
      await sb.from("cambios").update({ deshecho_en: c.fecha, deshecho_por: quien.userId }).eq("id", c.deshaceA).eq("salon_slug", data.slug).is("deshecho_en", null);
    }
    const limite = new Date(Date.now() - DIAS_RETENCION * 86_400_000).toISOString();
    await sb.from("cambios").delete().eq("salon_slug", data.slug).lt("fecha", limite);
    return { guardado: true as const };
  });

export const marcarAvisoEnviadoServidor = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, cambioId: z.string().min(8) }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    if (quien.tipo !== "miembro") return { ok: false as const };
    const sb = getSupabaseServerClient();
    if (!sb) return { ok: false as const };
    const { error } = await sb.from("cambios").update({ aviso_enviado: true }).eq("id", data.cambioId).eq("salon_slug", data.slug);
    return { ok: !error };
  });

export const listarCambios = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      antesDe: z.string().optional(),
      tipo: z.enum(TIPOS_CAMBIO).optional(),
      autor: z.string().optional(),
      idEntidad: z.string().optional(),
      limite: z.number().int().min(1).max(200).default(100),
    }),
  )
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    exigirAcciones(quien, ["historial.ver"]);
    if (quien.tipo !== "miembro") return { cambios: [] };
    const sb = getSupabaseServerClient();
    if (!sb) return { cambios: [] };
    let q = sb.from("cambios").select("*").eq("salon_slug", data.slug).order("fecha", { ascending: false }).limit(data.limite);
    if (data.antesDe) q = q.lt("fecha", data.antesDe);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.autor) q = q.eq("autor", data.autor);
    if (data.idEntidad) q = q.eq("id_entidad", data.idEntidad);
    const { data: filas, error } = await q;
    if (error) return { cambios: [], aviso: "El historial aún no está activado en este salón." };
    return {
      cambios: (filas ?? []).map((f: Record<string, unknown>) => ({
        id: f.id as string, tipo: f.tipo as string, entidad: f.entidad as string, idEntidad: f.id_entidad as string,
        antes: f.antes as Record<string, Json>, despues: f.despues as Record<string, Json>, resumen: f.resumen as string,
        autor: (f.autor as string | null) ?? null, autorNombre: (f.autor_nombre as string | null) ?? null, fecha: f.fecha as string,
        deshechoEn: (f.deshecho_en as string | null) ?? undefined, deshechoPor: (f.deshecho_por as string | null) ?? undefined,
        deshaceA: (f.deshace_a as string | null) ?? undefined, avisoEnviado: Boolean(f.aviso_enviado),
      })),
    };
  });
