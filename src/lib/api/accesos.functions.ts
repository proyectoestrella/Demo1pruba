/**
 * Ajustes › Accesos (lote 8): el cableado real de `accesos.ts`.
 *
 * La service role y el envío del correo viven SOLO aquí, en el servidor. El
 * navegador pide «invita a este correo con este rol» y el servidor decide si
 * quien lo pide puede (`accesos.gestionar`) y si el plan lo permite.
 *
 * Tablas: `salon_members` con las columnas del lote 8 y
 * `salon_invitaciones`. Las dos están en supabase/pendiente.sql, SIN aplicar:
 * hasta entonces estas funciones responden un error claro y el resto del
 * panel sigue igual.
 */
import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { rolVigente } from "../permisos";
import { getSupabaseServerClient } from "../supabase.server";
import {
  aceptarInvitacion,
  cambiarRol,
  darDeBaja,
  invitarMiembro,
  listarAccesos,
  reactivarMiembro,
  reenviarInvitacion,
  revocarInvitacion,
  vincularEmpleada,
  type DepsAccesos,
  type InvitacionFila,
  type MiembroFila,
} from "./accesos";
import { exigirAcceso, usuarioDeLaPeticion } from "./autorizacion.server";
import { conSesion } from "./sesion.middleware";

const slug = z.string().min(1).max(120);

function origen(): string {
  try {
    const o = getRequestHeader("origin") ?? getRequestHeader("referer");
    if (o) return new URL(o).origin;
  } catch {
    /* fuera de una petición */
  }
  return "";
}

/**
 * Los accesos solo existen en un salón de pago. En una demo por enlace no hay
 * cuentas: se responde vacío o con un aviso, sin escribir nada en la base.
 */
async function accesoReal(salonSlug: string) {
  const a = await exigirAcceso(salonSlug);
  if (a.tipo === "demo")
    throw new Error(
      "En una demo no hay accesos que gestionar: se activan al dar de alta el salón.",
    );
  return a;
}

function depsDe(salonSlug: string): DepsAccesos {
  const sb = getSupabaseServerClient();
  if (!sb) throw new Error("El acceso no está configurado en esta instalación.");
  return {
    ahora: () => new Date(),
    nuevoId: () => randomUUID(),
    plan: async () => {
      const { data } = await sb
        .from("salons")
        .select("profile")
        .eq("slug", salonSlug)
        .maybeSingle();
      const p = (data as { profile?: { plan?: string } } | null)?.profile;
      return p?.plan ?? null;
    },
    miembros: async () => {
      const { data, error } = await sb
        .from("salon_members")
        .select("*")
        .eq("salon_slug", salonSlug);
      if (error) throw new Error(`salon_members: ${error.message}`);
      const filas = (data ?? []) as Array<Record<string, string | null>>;
      return filas.map(
        (f): MiembroFila => ({
          userId: f.user_id as string,
          email: f.email ?? null,
          rol: rolVigente(f.rol),
          employeeId: f.employee_id ?? null,
          displayName: f.display_name ?? null,
          estado: f.estado === "baja" ? "baja" : "activa",
        }),
      );
    },
    invitaciones: async () => {
      const { data, error } = await sb
        .from("salon_invitaciones")
        .select("*")
        .eq("salon_slug", salonSlug);
      if (error)
        throw new Error(
          `salon_invitaciones (¿falta aplicar supabase/pendiente.sql?): ${error.message}`,
        );
      return ((data ?? []) as Array<Record<string, unknown>>).map(
        (f): InvitacionFila => ({
          id: f.id as string,
          email: f.email as string,
          rol: rolVigente(f.rol as string),
          employeeId: (f.employee_id as string | null) ?? null,
          displayName: (f.display_name as string | null) ?? null,
          invitedBy: (f.invited_by as string | null) ?? null,
          creada: f.creada as string,
          caduca: f.caduca as string,
          aceptadaEn: (f.aceptada_en as string | null) ?? null,
          revocada: Boolean(f.revocada),
        }),
      );
    },
    guardarInvitacion: async (i) => {
      const { error } = await sb.from("salon_invitaciones").upsert({
        id: i.id,
        salon_slug: salonSlug,
        email: i.email,
        rol: i.rol,
        employee_id: i.employeeId,
        display_name: i.displayName,
        invited_by: i.invitedBy,
        creada: i.creada,
        caduca: i.caduca,
        aceptada_en: i.aceptadaEn,
        revocada: i.revocada,
      });
      if (error) throw new Error(`salon_invitaciones: ${error.message}`);
    },
    enviarInvitacion: async (email, invitacionId) => {
      const volverA = `${origen()}/aceptar?s=${encodeURIComponent(salonSlug)}&inv=${encodeURIComponent(invitacionId)}`;
      const inv = await sb.auth.admin.inviteUserByEmail(email, { redirectTo: volverA });
      if (!inv.error) return;
      // Ya tiene usuario (p. ej. es miembro de otro salón): basta un enlace mágico normal.
      const otp = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: volverA, shouldCreateUser: false },
      });
      if (otp.error) throw new Error(`No se pudo enviar la invitación: ${otp.error.message}`);
    },
    guardarMiembro: async (m) => {
      const { error } = await sb.from("salon_members").upsert(
        {
          user_id: m.userId,
          salon_slug: salonSlug,
          rol: m.rol,
          email: m.email,
          employee_id: m.employeeId,
          display_name: m.displayName,
          estado: m.estado,
          actualizado: new Date().toISOString(),
        },
        { onConflict: "user_id,salon_slug" },
      );
      if (error) throw new Error(`salon_members: ${error.message}`);
    },
    correoDe: async (userId) => {
      const { data } = await sb.auth.admin.getUserById(userId);
      return data.user?.email ?? null;
    },
  };
}

export const listarMiembros = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug }))
  .handler(async ({ data }) => listarAccesos(await accesoReal(data.slug), depsDe(data.slug)));

export const invitarAlSalon = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      email: z.string().min(3).max(200),
      rol: z.string(),
      employeeId: z.string().nullable().optional(),
      displayName: z.string().max(60).nullable().optional(),
    }),
  )
  .handler(async ({ data }) =>
    invitarMiembro(
      await accesoReal(data.slug),
      {
        email: data.email,
        rol: data.rol,
        employeeId: data.employeeId,
        displayName: data.displayName,
      },
      depsDe(data.slug),
    ),
  );

export const aceptarInvitacionAlSalon = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, invitacionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await usuarioDeLaPeticion();
    if (!userId)
      return {
        ok: false as const,
        codigo: "NO_EXISTE" as const,
        motivo: "Entra primero con el enlace del correo.",
      };
    return aceptarInvitacion(userId, data.invitacionId, depsDe(data.slug));
  });

export const cambiarRolMiembro = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      userId: z.string().min(1),
      rol: z.string(),
      employeeId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) =>
    cambiarRol(
      await accesoReal(data.slug),
      data.userId,
      { rol: data.rol, employeeId: data.employeeId },
      depsDe(data.slug),
    ),
  );

export const darDeBajaMiembro = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, userId: z.string().min(1) }))
  .handler(async ({ data }) =>
    darDeBaja(await accesoReal(data.slug), data.userId, depsDe(data.slug)),
  );

export const revocarInvitacionAlSalon = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, invitacionId: z.string().min(1) }))
  .handler(async ({ data }) =>
    revocarInvitacion(await accesoReal(data.slug), data.invitacionId, depsDe(data.slug)),
  );

export const reenviarInvitacionAlSalon = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, invitacionId: z.string().min(1) }))
  .handler(async ({ data }) =>
    reenviarInvitacion(await accesoReal(data.slug), data.invitacionId, depsDe(data.slug)),
  );

export const vincularEmpleadaDelSalon = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, userId: z.string().min(1), employeeId: z.string().nullable() }))
  .handler(async ({ data }) =>
    vincularEmpleada(await accesoReal(data.slug), data.userId, data.employeeId, depsDe(data.slug)),
  );

export const reactivarMiembroDelSalon = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, userId: z.string().min(1) }))
  .handler(async ({ data }) =>
    reactivarMiembro(await accesoReal(data.slug), data.userId, depsDe(data.slug)),
  );
