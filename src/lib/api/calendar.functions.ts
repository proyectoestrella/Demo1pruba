import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirAcceso } from "./autorizacion.server";
import { exigirAcciones } from "./guardas";
import { conSesion } from "./sesion.middleware";
import { getSupabaseServerClient } from "../supabase.server";

const input = z.object({ slug: z.string().min(1).max(120) });

/** El token solo se entrega a miembros del salón, nunca en el perfil público. */
export const getCalendarSubscription = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(input)
  .handler(async ({ data }) => {
    exigirAcciones(await exigirAcceso(data.slug), ["salon.editar"]);
    const db = getSupabaseServerClient();
    if (!db) throw new Error("Calendario no disponible");
    const { data: fila, error } = await db.from("calendar_subscriptions").select("token").eq("salon_slug", data.slug).maybeSingle();
    if (error) throw new Error(`Calendario: ${error.message}`);
    return { token: (fila?.token as string | undefined) ?? null };
  });

export const regenerateCalendarSubscription = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(input)
  .handler(async ({ data }) => {
    exigirAcciones(await exigirAcceso(data.slug), ["salon.editar"]);
    const db = getSupabaseServerClient();
    if (!db) throw new Error("Calendario no disponible");
    const token = randomBytes(32).toString("base64url");
    const { error } = await db.from("calendar_subscriptions").upsert({ salon_slug: data.slug, token, updated_at: new Date().toISOString() }, { onConflict: "salon_slug" });
    if (error) throw new Error(`Calendario: ${error.message}`);
    return { token };
  });
