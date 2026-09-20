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
  rowToWaitlist,
  type AppointmentRow,
  type ClientRow,
  type WaitlistRow,
} from "../salon-rows";
import type { Appointment, Client, SalonProfile, WaitlistEntry } from "../mock/types";

/**
 * Columnas de siempre, y columnas que solo existen si se ha aplicado el DDL
 * más reciente de `supabase/schema.sql`.
 *
 * Van separadas porque un `select` con UNA columna inexistente falla entero:
 * la agenda de un salón real no puede dejar de cargar porque todavía no se
 * haya ejecutado una migración. Ver `faltaEsquema` justo debajo.
 */
const APPOINTMENT_COLS_BASE =
  "id, local_id, client_id, client_name, service_id, employee_id, start_at, duration_min, price_eur, status, client_confirmed_at, note";
const APPOINTMENT_COLS_NUEVAS =
  "payment_method, paid_at, deposit_requested_at, deposit_received_at, deposit_eur";
const CLIENT_COLS_BASE = "id, name, phone, email, notes, penalty_eur, penalty_note, created_at";
const CLIENT_COLS_NUEVAS = "penalty_at, penalty_keep, penalty_block";
const WAITLIST_COLS =
  "id, local_id, client_name, phone, service_id, preferred_employee_id, preferred_range, created_at";

/** Campos de una cita o una ficha que solo existen tras el DDL de caja, fianzas y caducidad. */
const CAMPOS_NUEVOS_CITA = [
  "payment_method",
  "paid_at",
  "deposit_requested_at",
  "deposit_received_at",
  "deposit_eur",
];
const CAMPOS_NUEVOS_CLIENTE = ["penalty_at", "penalty_keep", "penalty_block"];

/**
 * ¿Ha fallado esto porque una columna o una tabla todavía no existen?
 *
 * PostgREST responde `PGRST204`/`42703` para una columna desconocida y
 * `PGRST205`/`42P01` para una tabla que no está en el esquema. En los dos
 * casos la respuesta correcta es la misma: seguir sin eso, no tumbar el panel
 * de quien está delante de un cliente.
 */
function faltaEsquema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (["PGRST204", "PGRST205", "42703", "42P01"].includes(error.code ?? "")) return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    msg.includes("schema cache")
  );
}

/** Quita del objeto las claves indicadas — para reintentar sin las columnas que aún no existen. */
function sinCampos<T extends Record<string, unknown>>(fila: T, campos: string[]): T {
  const copia = { ...fila };
  for (const c of campos) delete copia[c];
  return copia;
}

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
  .handler(
    async ({
      data,
    }): Promise<{ appointments: Appointment[]; clients: Client[]; waitlist: WaitlistEntry[] }> => {
      const supabase = getSupabaseServerClient();
      if (!supabase) return { appointments: [], clients: [], waitlist: [] };

      const publica = data.scope === "publica";

      /**
       * Un `select` con las columnas nuevas y, si el esquema todavía no las
       * tiene, el mismo `select` solo con las de siempre. Sin esto, aplicar
       * este código antes que el DDL dejaría la agenda en blanco.
       */
      async function traer<T>(tabla: string, base: string, nuevas: string) {
        const conNuevas = await supabase!
          .from(tabla)
          .select(`${base}, ${nuevas}`)
          .eq("salon_slug", data.slug);
        if (!conNuevas.error) return { data: (conNuevas.data ?? []) as unknown as T[], error: null };
        if (!faltaEsquema(conNuevas.error)) return { data: [] as T[], error: conNuevas.error };
        console.warn(
          `listSalonData: ${tabla} todavía sin las columnas nuevas (${nuevas}); falta aplicar supabase/schema.sql`,
        );
        const soloBase = await supabase!.from(tabla).select(base).eq("salon_slug", data.slug);
        return {
          data: (soloBase.data ?? []) as unknown as T[],
          error: soloBase.error,
        };
      }

      const [citas, fichas, espera] = await Promise.all([
        traer<AppointmentRow>("appointments", APPOINTMENT_COLS_BASE, APPOINTMENT_COLS_NUEVAS),
        publica
          ? Promise.resolve({ data: [] as ClientRow[], error: null })
          : traer<ClientRow>("clients", CLIENT_COLS_BASE, CLIENT_COLS_NUEVAS),
        // La lista de espera es del dueño: la web pública ni la pide. Y si la
        // tabla todavía no existe, se responde vacía — que es justo lo que
        // debe ver un salón real, en vez de las 4 entradas de ejemplo del seed.
        publica
          ? Promise.resolve({ data: [] as WaitlistRow[], error: null })
          : supabase
              .from("waitlist")
              .select(WAITLIST_COLS)
              .eq("salon_slug", data.slug)
              .then((r) => ({
                data: (r.data ?? []) as unknown as WaitlistRow[],
                error: faltaEsquema(r.error) ? null : r.error,
              })),
      ]);

      if (citas.error) throw new Error(`listSalonData (citas): ${citas.error.message}`);
      if (fichas.error) throw new Error(`listSalonData (clientes): ${fichas.error.message}`);
      if (espera.error) throw new Error(`listSalonData (lista de espera): ${espera.error.message}`);

      return {
        appointments: (citas.data ?? []).map((r) => rowToAppointment(r, publica)),
        clients: (fichas.data ?? []).map(rowToClient),
        waitlist: (espera.data ?? []).map(rowToWaitlist),
      };
    },
  );

/* ---------------------------------------------------------------------- */
/* Lista de espera                                                         */
/* ---------------------------------------------------------------------- */

/**
 * Upsert de UNA entrada de la lista de espera, con la misma mecánica que las
 * citas: la clave es `(salon_slug, local_id)` porque la entrada nace en el
 * navegador. Si la tabla todavía no existe, no revienta: se avisa por consola
 * y la lista sigue funcionando en local, como antes de esto.
 */
export const syncWaitlistEntry = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug,
      localId: z.string().min(1),
      clientName: z.string().min(1),
      phone: z.string().default(""),
      serviceId: z.string().default(""),
      preferredEmployeeId: z.string().default("any"),
      preferredRange: z.string().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    const { error } = await supabase.from("waitlist").upsert(
      {
        salon_slug: data.slug,
        local_id: data.localId,
        client_name: data.clientName,
        phone: data.phone,
        service_id: data.serviceId,
        preferred_employee_id: data.preferredEmployeeId,
        preferred_range: data.preferredRange,
      },
      { onConflict: "salon_slug,local_id" },
    );
    if (faltaEsquema(error)) {
      console.warn("syncWaitlistEntry: falta la tabla `waitlist` (aplica supabase/schema.sql)");
      return { synced: false as const };
    }
    if (error) throw new Error(`syncWaitlistEntry: ${error.message}`);
    return { synced: true as const };
  });

/** Quita una entrada de la lista de espera (la quitó el dueño, o se convirtió en cita). */
export const deleteWaitlistEntry = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug, localId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    const { error } = await supabase
      .from("waitlist")
      .delete()
      .eq("salon_slug", data.slug)
      .eq("local_id", data.localId);
    if (faltaEsquema(error)) return { synced: false as const };
    if (error) throw new Error(`deleteWaitlistEntry: ${error.message}`);
    return { synced: true as const };
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
      paymentMethod: z.string().nullable().optional(),
      paidAt: z.string().nullable().optional(),
      depositRequestedAt: z.string().nullable().optional(),
      depositReceivedAt: z.string().nullable().optional(),
      depositEur: z.number().nullable().optional(),
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
      payment_method: data.paymentMethod ?? null,
      paid_at: data.paidAt ?? null,
      deposit_requested_at: data.depositRequestedAt ?? null,
      deposit_received_at: data.depositReceivedAt ?? null,
      deposit_eur: data.depositEur ?? null,
    };
    // Solo se toca `client_id` cuando esta llamada sabe de qué cliente habla.
    // Un "confirmar" desde el panel no lleva teléfono, y machacar la columna
    // con null desengancharía la cita de su ficha.
    if (clientId) fila.client_id = clientId;

    const { error } = await supabase
      .from("appointments")
      .upsert(fila, { onConflict: "salon_slug,local_id" });
    if (faltaEsquema(error)) {
      // El DDL de caja y fianzas todavía no está aplicado: se guarda la cita
      // sin esos campos antes que perder el cambio entero. Confirmar una cita
      // delante de un cliente no puede depender de una migración pendiente.
      console.warn(
        "syncAppointment: faltan las columnas de caja/fianza (aplica supabase/schema.sql); la cita se guarda sin ellas",
      );
      const { error: err2 } = await supabase
        .from("appointments")
        .upsert(sinCampos(fila, CAMPOS_NUEVOS_CITA), { onConflict: "salon_slug,local_id" });
      if (err2) throw new Error(`syncAppointment: ${err2.message}`);
      return { synced: true as const };
    }
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
      /** Cuándo se aplicó: es desde donde cuentan los 30 días de caducidad del bloqueo. */
      penaltyAt: z.string().nullable().optional(),
      /** El dueño mantiene el bloqueo más allá de los 30 días. */
      penaltyKeep: z.boolean().optional(),
      /** ¿La deuda le impide reservar por la web? `false` = solo anotada. */
      penaltyBlock: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };

    const fila: Record<string, unknown> = {
      salon_slug: data.slug,
      name: data.name ?? "Cliente",
      phone: data.phone,
      phone_key: phoneKey(data.phone),
      penalty_eur: data.eur,
      penalty_note: data.note ?? null,
      penalty_at: data.penaltyAt ?? null,
      penalty_keep: data.penaltyKeep ?? false,
      penalty_block: data.penaltyBlock ?? true,
    };

    const { error } = await supabase
      .from("clients")
      .upsert(fila, { onConflict: "salon_slug,phone_key" });
    if (faltaEsquema(error)) {
      console.warn(
        "applyClientPenalty: faltan `penalty_at`/`penalty_keep` (aplica supabase/schema.sql); se guarda sin caducidad",
      );
      const { error: err2 } = await supabase
        .from("clients")
        .upsert(sinCampos(fila, CAMPOS_NUEVOS_CLIENTE), { onConflict: "salon_slug,phone_key" });
      if (err2) throw new Error(`applyClientPenalty: ${err2.message}`);
      return { synced: true as const };
    }
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

    const parche: Record<string, unknown> = {
      penalty_eur: null,
      penalty_note: data.note ?? null,
      penalty_at: null,
      penalty_keep: false,
      penalty_block: true,
    };
    const { error } = await supabase.from("clients").update(parche).eq("id", id);
    if (faltaEsquema(error)) {
      const { error: err2 } = await supabase
        .from("clients")
        .update(sinCampos(parche, CAMPOS_NUEVOS_CLIENTE))
        .eq("id", id);
      if (err2) throw new Error(`clearClientPenalty: ${err2.message}`);
      return { synced: true as const };
    }
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

    // Con las columnas de caducidad si existen; si no, sin ellas (y entonces
    // el bloqueo no caduca, exactamente como se comportaba antes).
    let rows: unknown[] | null = null;
    const conNuevas = await supabase
      .from("clients")
      .select(`${CLIENT_COLS_BASE}, ${CLIENT_COLS_NUEVAS}`)
      .eq("salon_slug", data.slug)
      .not("penalty_eur", "is", null);
    if (conNuevas.error && !faltaEsquema(conNuevas.error)) {
      console.error("checkClientPenalty:", conNuevas.error.message);
      return { client: null };
    }
    if (conNuevas.error) {
      const soloBase = await supabase
        .from("clients")
        .select(CLIENT_COLS_BASE)
        .eq("salon_slug", data.slug)
        .not("penalty_eur", "is", null);
      if (soloBase.error) {
        console.error("checkClientPenalty:", soloBase.error.message);
        return { client: null };
      }
      rows = soloBase.data ?? [];
    } else {
      rows = conNuevas.data ?? [];
    }

    const fila = findPenaltyRow((rows ?? []) as unknown as ClientRow[], data.phone);
    return { client: fila ? rowToClient(fila) : null };
  });
