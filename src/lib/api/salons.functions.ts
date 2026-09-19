/**
 * Backend de los salones REALES (los que pagan), frente a las ~54 demos de
 * venta que siguen viviendo enteras dentro del enlace `?d=…`.
 *
 * La frontera es una sola fila: si `salons` tiene una fila con ese slug, el
 * salón es real y su agenda vive en Supabase; si no la tiene, `getSalonProfile`
 * devuelve `null` y la app se comporta EXACTAMENTE como antes, sin volver a
 * llamar aquí para nada. Ver `resolveActiveProfile` en lib/salon-rows.ts.
 *
 * Mismo patrón que clients.functions.ts: `createServerFn`, `zod` para validar
 * la entrada y `getSupabaseServerClient()` (de un `.server.ts`, así la service
 * role key nunca entra en el bundle del navegador).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseServerClient } from "../supabase.server";
import {
  findPenaltyRow,
  phoneKey,
  rowToAppointment,
  rowToClient,
  type AppointmentRow,
  type ClientRow,
} from "../salon-rows";
import type { Appointment, Client, SalonProfile } from "../mock/types";

const APPOINTMENT_COLS =
  "id, local_id, client_id, client_name, service_id, employee_id, start_at, duration_min, price_eur, status, client_confirmed_at, note";
const CLIENT_COLS = "id, name, phone, email, notes, penalty_eur, penalty_note, created_at";

const slug = z.string().min(1).max(120);

/* ---------------------------------------------------------------------- */
/* Perfil                                                                  */
/* ---------------------------------------------------------------------- */

/**
 * ¿Es este slug un salón real? `{ profile: null }` = no, sigue siendo una demo.
 *
 * Es la ÚNICA llamada que hace la app para un slug desconocido, y su respuesta
 * negativa no cambia absolutamente nada de lo que se pinta.
 */
export const getSalonProfile = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug }))
  .handler(async ({ data }): Promise<{ profile: SalonProfile | null }> => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { profile: null };

    const { data: row, error } = await supabase
      .from("salons")
      .select("slug, profile")
      .eq("slug", data.slug)
      .maybeSingle();

    // Un fallo de red o una tabla que aún no existe NO pueden tumbar la web
    // pública de una demo: se responde "no es real" y todo sigue como siempre.
    if (error) {
      console.error("getSalonProfile:", error.message);
      return { profile: null };
    }
    if (!row) return { profile: null };

    const profile = row.profile as SalonProfile;
    return { profile: { ...profile, slug: row.slug } };
  });

/**
 * Guarda el perfil del salón. La llama Ajustes cada vez que el dueño cambia
 * algo, en fire-and-forget: en local ya se aplicó al instante.
 */
export const saveSalonProfile = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug, profile: z.record(z.string(), z.unknown()) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };

    const { error } = await supabase
      .from("salons")
      .upsert(
        { slug: data.slug, profile: data.profile, updated_at: new Date().toISOString() },
        { onConflict: "slug" },
      );
    if (error) throw new Error(`saveSalonProfile: ${error.message}`);
    return { synced: true as const };
  });

/* ---------------------------------------------------------------------- */
/* Agenda                                                                  */
/* ---------------------------------------------------------------------- */

/**
 * Toda la agenda del salón, para hidratar la store al entrar.
 *
 * `scope: "publica"` es lo que se sirve a la web de reservas: las citas solo
 * para saber qué huecos están ocupados, sin nombres ni notas, y cero fichas de
 * cliente. La lista de clientes es del dueño, no de quien abra el enlace.
 */
export const listSalonData = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug, scope: z.enum(["panel", "publica"]).default("panel") }))
  .handler(async ({ data }): Promise<{ appointments: Appointment[]; clients: Client[] }> => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { appointments: [], clients: [] };

    const publica = data.scope === "publica";

    const [citas, fichas] = await Promise.all([
      supabase.from("appointments").select(APPOINTMENT_COLS).eq("salon_slug", data.slug),
      publica
        ? Promise.resolve({ data: [] as ClientRow[], error: null })
        : supabase.from("clients").select(CLIENT_COLS).eq("salon_slug", data.slug),
    ]);

    if (citas.error) throw new Error(`listSalonData (citas): ${citas.error.message}`);
    if (fichas.error) throw new Error(`listSalonData (clientes): ${fichas.error.message}`);

    return {
      appointments: ((citas.data ?? []) as unknown as AppointmentRow[]).map((r) =>
        rowToAppointment(r, publica),
      ),
      clients: ((fichas.data ?? []) as unknown as ClientRow[]).map(rowToClient),
    };
  });

/**
 * Upsert de UNA cita. Es el único camino por el que el panel escribe citas:
 * confirmar, rechazar, cambiar hora o profesional, marcar plantón, cancelar,
 * crear un "Sin cita" o una cita por teléfono. No hay una función por acción
 * porque todas acaban siendo la misma fila con otro contenido.
 *
 * `localId` es el id que conoce el navegador (`a-new-1758…`): la clave de
 * upsert es `(salon_slug, local_id)`, no el uuid, porque la cita nace en local.
 *
 * Si vienen `clientName` + `clientPhone` se crea/actualiza también la ficha del
 * cliente y se enlaza. Si no vienen (un "Sin cita" sin teléfono), la cita se
 * guarda igual con `client_id` a null: la agenda tiene que enseñarla de todas
 * formas.
 */
export const syncAppointment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug,
      localId: z.string().min(1),
      clientName: z.string().optional(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().email().optional(),
      serviceIds: z.array(z.string()).default([]),
      employeeId: z.string().min(1),
      startISO: z.string().min(1),
      durationMin: z.number().nonnegative(),
      priceEur: z.number().nonnegative(),
      status: z.string().min(1),
      clientConfirmedAt: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };

    let clientId: string | null = null;
    const key = phoneKey(data.clientPhone);
    if (data.clientPhone && key.length >= 6 && data.clientName) {
      const { data: cliente, error } = await supabase
        .from("clients")
        .upsert(
          {
            salon_slug: data.slug,
            name: data.clientName,
            phone: data.clientPhone,
            phone_key: key,
            email: data.clientEmail,
          },
          { onConflict: "salon_slug,phone_key" },
        )
        .select("id")
        .single();
      if (error) throw new Error(`syncAppointment (cliente): ${error.message}`);
      clientId = cliente.id as string;
    }

    const fila: Record<string, unknown> = {
      salon_slug: data.slug,
      local_id: data.localId,
      client_name: data.clientName ?? null,
      service_id: data.serviceIds.join(","),
      employee_id: data.employeeId,
      start_at: data.startISO,
      duration_min: data.durationMin,
      price_eur: data.priceEur,
      status: data.status,
      client_confirmed_at: data.clientConfirmedAt ?? null,
      note: data.note ?? null,
    };
    // Solo se toca `client_id` cuando esta llamada sabe de qué cliente habla.
    // Un "confirmar" desde el panel no lleva teléfono, y machacar la columna
    // con null desengancharía la cita de su ficha.
    if (clientId) fila.client_id = clientId;

    const { error } = await supabase
      .from("appointments")
      .upsert(fila, { onConflict: "salon_slug,local_id" });
    if (error) throw new Error(`syncAppointment: ${error.message}`);

    return { synced: true as const };
  });

/** Borra una cita de verdad (el panel tiene "eliminar" además de "cancelar"). */
export const deleteAppointment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug, localId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("salon_slug", data.slug)
      .eq("local_id", data.localId);
    if (error) throw new Error(`deleteAppointment: ${error.message}`);
    return { synced: true as const };
  });

/* ---------------------------------------------------------------------- */
/* Clientes y política de plantón                                          */
/* ---------------------------------------------------------------------- */

/**
 * La ficha se localiza por TELÉFONO normalizado, no por el id local: el id que
 * tiene el panel puede venir del seed de ejemplo, de una ficha creada a mano o
 * del uuid de Supabase, pero el teléfono es el mismo en los tres.
 */
async function localizarCliente(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  salonSlug: string,
  phone: string,
) {
  const key = phoneKey(phone);
  if (key.length < 6) return null;
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("salon_slug", salonSlug)
    .eq("phone_key", key)
    .maybeSingle();
  if (error) throw new Error(`localizarCliente: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

/** Marca al cliente con una penalización pendiente (política de plantón). */
export const applyClientPenalty = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug,
      clientId: z.string().optional(),
      phone: z.string().min(1),
      name: z.string().optional(),
      eur: z.number().nonnegative(),
      note: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };

    const { error } = await supabase.from("clients").upsert(
      {
        salon_slug: data.slug,
        name: data.name ?? "Cliente",
        phone: data.phone,
        phone_key: phoneKey(data.phone),
        penalty_eur: data.eur,
        penalty_note: data.note ?? null,
      },
      { onConflict: "salon_slug,phone_key" },
    );
    if (error) throw new Error(`applyClientPenalty: ${error.message}`);
    return { synced: true as const };
  });

/** Cierra la penalización: cobrada o perdonada. Decide siempre el dueño. */
export const clearClientPenalty = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug,
      clientId: z.string().optional(),
      phone: z.string().min(1),
      note: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };

    const id = await localizarCliente(supabase, data.slug, data.phone);
    if (!id) return { synced: false as const };

    const { error } = await supabase
      .from("clients")
      .update({ penalty_eur: null, penalty_note: data.note ?? null })
      .eq("id", id);
    if (error) throw new Error(`clearClientPenalty: ${error.message}`);
    return { synced: true as const };
  });

/** Guarda las indicaciones del salón sobre un cliente ("usa el número 8"). */
export const saveClientNotes = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug, phone: z.string().min(1), notes: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    const id = await localizarCliente(supabase, data.slug, data.phone);
    if (!id) return { synced: false as const };
    const { error } = await supabase.from("clients").update({ notes: data.notes }).eq("id", id);
    if (error) throw new Error(`saveClientNotes: ${error.message}`);
    return { synced: true as const };
  });

/**
 * ¿Debe este teléfono una penalización? Lo pregunta la RESERVA PÚBLICA.
 *
 * Devuelve solo el importe y el motivo, nunca la lista de clientes: quien abre
 * el enlace público no tiene por qué recibir los teléfonos de los demás.
 */
export const checkClientPenalty = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug, phone: z.string() }))
  .handler(async ({ data }): Promise<{ client: Client | null }> => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { client: null };
    if (phoneKey(data.phone).length < 9) return { client: null };

    const { data: rows, error } = await supabase
      .from("clients")
      .select(CLIENT_COLS)
      .eq("salon_slug", data.slug)
      .not("penalty_eur", "is", null);
    if (error) {
      console.error("checkClientPenalty:", error.message);
      return { client: null };
    }

    const fila = findPenaltyRow((rows ?? []) as unknown as ClientRow[], data.phone);
    return { client: fila ? rowToClient(fila) : null };
  });
