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
import process from "node:process";
import { z } from "zod";

import { acceso, exigirAcceso } from "./autorizacion.server";
import { tieneMando, vistaEfectiva } from "./autorizacion";
import { conSesion } from "./sesion.middleware";
import { getSupabaseServerClient } from "../supabase.server";
import { fusionarPerfil } from "../perfil-parche";
import { isManualBlockRecord } from "../no-show";
import { parseDepositNote } from "../deposit-deadline";
import {
  ERROR_BLOQUEO_MANUAL,
  ERROR_FUERA_HORARIO,
  ERROR_HUECO_OCUPADO,
  haySolape,
  profesionalTrabaja,
} from "../reserva-publica";
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
// TODO: aplicar las columnas técnicas de supabase/schema.sql en producción.
const APPOINTMENT_COLS_TECNICAS = "color_formula, technical_notes";
const APPOINTMENT_COLS_RECORDATORIO = "reminder_sent_at";
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
const CAMPOS_TECNICOS_CITA = ["color_formula", "technical_notes"];
const CAMPOS_RECORDATORIO_CITA = ["reminder_sent_at"];
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
    msg.includes("does not exist") || msg.includes("could not find") || msg.includes("schema cache")
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
/* Quién puede tocar qué                                                   */
/* ---------------------------------------------------------------------- */

/**
 * Todas las funciones de este fichero llevan `.middleware([conSesion])`, que
 * les hace llegar la sesión del navegador que llama, y las que manejan datos
 * de personas empiezan por `exigirAcceso(data.slug)` o por `acceso(data.slug)`.
 *
 * Hay exactamente tres niveles, y conviene tenerlos claros:
 *
 *   PÚBLICO      `getSalonProfile`, `esSalonRealPublico`, `checkClientPenalty`.
 *                No comprueban nada porque no hay nada que comprobar: lo que
 *                devuelven ya es público (la ficha del salón, si existe, y si
 *                un teléfono concreto debe dinero). No devuelven listas.
 *
 *   RECORTADO    `listSalonData`. No corta: recorta. Quien no sea miembro
 *                recibe la vista pública —los huecos ocupados, sin nombres y
 *                sin una sola ficha de cliente— aunque pida la del panel. Es
 *                así porque la web de reservas de un salón de pago tiene que
 *                seguir funcionando para cualquiera que entre a pedir hora.
 *
 *   MIXTO        `syncAppointment`. El dueño puede todo; quien no lo sea solo
 *                puede pedir hora: una cita NUEVA, en estado "pendiente", sin
 *                tocar cobros ni fianzas y sin poder pisar una cita que ya
 *                exista. Es lo que hace la web de reservas y nada más.
 *
 *   DEL DUEÑO    el resto: guardar el perfil, la lista de espera, borrar
 *                citas, deudas y notas de clientes. Cortan.
 *
 * Y por encima de todo: si el slug no existe en `salons` es una DEMO de venta
 * y no se pide absolutamente nada, exactamente como antes. Esa decisión la
 * toma el servidor mirando la base de datos, no un parámetro del navegador.
 * Ver lib/api/autorizacion.ts.
 */

/**
 * ¿Este slug es un salón de pago? Solo eso, sí o no.
 *
 * Es información pública —el slug sale en la URL de la web de reservas— y la
 * necesita la pantalla de acceso para saber si puede ofrecer el atajo de las
 * demos o si tiene que pedir el correo. Ojo: es una comodidad de la interfaz,
 * no una barrera. La barrera la vuelve a poner el servidor en cada llamada.
 */
export const esSalonRealPublico = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug }))
  .handler(async ({ data }): Promise<{ real: boolean }> => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { real: false };
    const { data: row, error } = await supabase
      .from("salons")
      .select("slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) return { real: false };
    return { real: Boolean(row) };
  });

/**
 * ¿Puede quien está llamando abrir el panel de este salón?
 *
 * La usa la guarda de la ruta `/app` para decidir entre enseñar el panel o
 * mandar a `/login`. Devuelve dos cosas porque hacen falta las dos:
 *
 *   `real`      — si es false es una demo de venta: se entra sin pedir nada.
 *   `permitido` — si es true, quien llama manda sobre ese salón.
 *
 * No devuelve ni un dato del salón, así que preguntarlo no filtra nada. Y es
 * una comodidad de la interfaz, no la barrera: la barrera está en cada
 * función que entrega datos. Aunque alguien se saltara esta pregunta, el
 * panel se abriría vacío.
 */
export const accesoAlPanel = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug }))
  .handler(async ({ data }): Promise<{ real: boolean; permitido: boolean }> => {
    const quien = await acceso(data.slug);
    return { real: quien.tipo !== "demo", permitido: tieneMando(quien) };
  });

/* ---------------------------------------------------------------------- */
/* Perfil                                                                  */
/* ---------------------------------------------------------------------- */

/**
 * ¿Es este slug un salón real? `{ profile: null }` = no, sigue siendo una demo.
 *
 * Es la ÚNICA llamada que hace la app para un slug desconocido, y su respuesta
 * negativa no cambia absolutamente nada de lo que se pinta.
 *
 * PÚBLICA a propósito, y sin comprobar nada: lo que devuelve es la ficha que
 * ese salón enseña en su propia web —nombre, dirección, horarios, carta—, que
 * es justo lo que quiere que vea todo el mundo. Aquí no viaja ni una cita ni
 * un cliente.
 */
export const getSalonProfile = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug }))
  .handler(async ({ data }): Promise<{ profile: SalonProfile | null }> => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      // En desarrollo sin variables, todo es demo. En producción, que falte
      // Supabase es un despliegue roto: un salón de pago no puede degradar
      // a demo en silencio y confirmar citas que no se guardan en ninguna
      // parte. Se lanza, y la web pública y el panel lo muestran como fallo.
      if (process.env.NODE_ENV === "production") throw new Error("Backend sin configurar");
      return { profile: null };
    }

    const { data: row, error } = await supabase
      .from("salons")
      .select("slug, profile")
      .eq("slug", data.slug)
      .maybeSingle();

    // No confundimos un error de lectura con «este slug es una demo»:
    // una clienta de un salón real no debe recibir confirmación local.
    if (error) {
      throw new Error(`getSalonProfile: ${error.message}`);
    }
    if (!row) return { profile: null };

    const profile = row.profile as SalonProfile;
    return { profile: { ...profile, slug: row.slug } };
  });

/**
 * Guarda el perfil del salón.
 *
 * Tiene dos llamantes con exigencias distintas, y por eso devuelve un motivo
 * en vez de solo un booleano:
 *
 *   - La store (`pushSalonProfile`), en fire-and-forget: el cambio ya está
 *     aplicado en local y un fallo solo se escribe en consola.
 *   - «Mi web» (`/app/web`), que espera la respuesta antes de decirle al dueño
 *     que su web ya está publicada. Ahí hace falta distinguir "no hay backend
 *     configurado" y "el esquema todavía no está aplicado" —dos cosas que no
 *     son culpa suya ni se arreglan reintentando— de un fallo de verdad, que
 *     sí sube como excepción para que la pantalla lo cuente y no pierda nada
 *     de lo escrito.
 */
export type MotivoNoPublicado = "sin-backend" | "falta-esquema";

export const saveSalonProfile = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, profile: z.record(z.string(), z.unknown()) }))
  .handler(
    async ({ data }): Promise<{ synced: true } | { synced: false; motivo: MotivoNoPublicado }> => {
      // Sobrescribir el perfil entero de un salón es cosa de su dueño. Sin
      // esto, cualquiera podía cambiarle el teléfono, la dirección o la carta.
      await exigirAcceso(data.slug);
      const supabase = getSupabaseServerClient();
      if (!supabase) return { synced: false as const, motivo: "sin-backend" as const };

      const { error } = await supabase
        .from("salons")
        .upsert(
          { slug: data.slug, profile: data.profile, updated_at: new Date().toISOString() },
          { onConflict: "slug" },
        );
      if (faltaEsquema(error)) {
        return { synced: false as const, motivo: "falta-esquema" as const };
      }
      if (error) throw new Error(`saveSalonProfile: ${error.message}`);
      return { synced: true as const };
    },
  );

/**
 * Guarda SOLO los campos que han cambiado, fusionándolos con lo que hay en la
 * base en el momento de escribir.
 *
 * Por qué existe, y qué garantía da exactamente.
 *
 * Hasta ahora el panel subía el perfil ENTERO en cada edición
 * (`updateSalonProfile` → `saveSalonProfile`). Con dos dispositivos eso
 * significaba perder trabajo sin enterarse: el dueño cambia el teléfono desde
 * el móvil, y el iPad —que lleva abierto desde ayer y tiene el perfil viejo en
 * `localStorage`— cambia el horario del martes; al subir su copia completa,
 * el teléfono nuevo VUELVE al viejo. Nadie tocó el teléfono y el teléfono
 * cambió.
 *
 * La garantía que se da aquí, dicha sin adornos:
 *
 *   SÍ — un campo que este navegador no ha tocado no se puede sobrescribir
 *   con lo que este navegador creía que valía. Solo viajan las claves del
 *   parche, y el resto del perfil sale de la fila tal y como está en la base
 *   en el instante de la escritura, no de la copia local.
 *
 *   NO — esto no es una transacción ni un bloqueo optimista. Si dos
 *   dispositivos cambian LA MISMA clave casi a la vez, sigue ganando el
 *   último que escriba. Y entre el `select` y el `update` de aquí abajo hay
 *   una ventana pequeña en la que una escritura ajena a otra clave podría
 *   perderse. Cerrar eso del todo pide una columna de versión y un `update
 *   ... where updated_at = ...`, que es otro cambio y otra migración.
 *
 * Si la fila no existe, NO se crea: dar de alta un salón es un acto
 * deliberado (`scripts/seed-salon.ts`), no algo que provoque un teclazo en
 * Ajustes.
 */
export type MotivoNoAplicado = MotivoNoPublicado | "sin-salon";

export const patchSalonProfile = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, patch: z.record(z.string(), z.unknown()) }))
  .handler(
    async ({ data }): Promise<{ synced: true } | { synced: false; motivo: MotivoNoAplicado }> => {
      await exigirAcceso(data.slug);
      const supabase = getSupabaseServerClient();
      if (!supabase) return { synced: false as const, motivo: "sin-backend" as const };

      const { data: fila, error: errorLectura } = await supabase
        .from("salons")
        .select("profile")
        .eq("slug", data.slug)
        .maybeSingle();
      if (faltaEsquema(errorLectura)) {
        return { synced: false as const, motivo: "falta-esquema" as const };
      }
      if (errorLectura) throw new Error(`patchSalonProfile (lectura): ${errorLectura.message}`);
      if (!fila) return { synced: false as const, motivo: "sin-salon" as const };

      const fusionado = fusionarPerfil((fila.profile ?? {}) as Record<string, unknown>, data.patch);

      const { error } = await supabase
        .from("salons")
        .update({ profile: fusionado, updated_at: new Date().toISOString() })
        .eq("slug", data.slug);
      if (faltaEsquema(error)) {
        return { synced: false as const, motivo: "falta-esquema" as const };
      }
      if (error) throw new Error(`patchSalonProfile: ${error.message}`);
      return { synced: true as const };
    },
  );

/* ---------------------------------------------------------------------- */
/* Agenda                                                                  */
/* ---------------------------------------------------------------------- */

/**
 * Toda la agenda del salón, para hidratar la store al entrar.
 *
 * La vista "publica" es lo que se sirve a la web de reservas: las citas solo
 * para saber qué huecos están ocupados, sin nombres ni notas, y cero fichas de
 * cliente. La lista de clientes es del dueño, no de quien abra el enlace.
 *
 * Eso ANTES era una intención escrita en este comentario y nada más, porque
 * `scope` lo elegía quien llamaba: bastaba pedir "panel" para recibir la lista
 * completa de clientes con sus teléfonos. Ahora `vista` es como mucho una
 * preferencia, y el servidor la recorta a lo que esa persona tiene derecho a
 * ver (`vistaEfectiva`). Pedir "panel" sin ser miembro del salón devuelve
 * exactamente lo mismo que pedir "publica".
 *
 * No corta con un error a propósito: la web de reservas de un salón de pago
 * la abre gente que no tiene ni va a tener sesión, y tiene que seguir viendo
 * qué huecos quedan libres.
 */
export const listSalonData = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, vista: z.enum(["panel", "publica"]).default("publica") }))
  .handler(
    async ({
      data,
    }): Promise<{ appointments: Appointment[]; clients: Client[]; waitlist: WaitlistEntry[] }> => {
      const supabase = getSupabaseServerClient();
      if (!supabase) return { appointments: [], clients: [], waitlist: [] };

      const publica = vistaEfectiva(data.vista, await acceso(data.slug)) === "publica";

      /**
       * Un `select` con las columnas nuevas y, si el esquema todavía no las
       * tiene, el mismo `select` solo con las de siempre. Sin esto, aplicar
       * este código antes que el DDL dejaría la agenda en blanco.
       */
      async function traer<T>(tabla: string, base: string, nuevas: string) {
        if (tabla === "appointments") {
          const conRecordatorio = await supabase!
            .from(tabla)
            .select(`${base}, ${nuevas}, ${APPOINTMENT_COLS_TECNICAS}, ${APPOINTMENT_COLS_RECORDATORIO}`)
            .eq("salon_slug", data.slug);
          if (!conRecordatorio.error) return { data: (conRecordatorio.data ?? []) as unknown as T[], error: null };
          if (!faltaEsquema(conRecordatorio.error)) return { data: [] as T[], error: conRecordatorio.error };
          const tecnicas = await supabase!
            .from(tabla)
            .select(`${base}, ${nuevas}, ${APPOINTMENT_COLS_TECNICAS}`)
            .eq("salon_slug", data.slug);
          if (!tecnicas.error) return { data: (tecnicas.data ?? []) as unknown as T[], error: null };
          if (!faltaEsquema(tecnicas.error)) return { data: [] as T[], error: tecnicas.error };
        }
        const conNuevas = await supabase!
          .from(tabla)
          .select(`${base}, ${nuevas}`)
          .eq("salon_slug", data.slug);
        if (!conNuevas.error)
          return { data: (conNuevas.data ?? []) as unknown as T[], error: null };
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
  .middleware([conSesion])
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
    // La lista de espera la lleva el dueño desde el panel; la web de reservas
    // no escribe aquí. Nadie de fuera tiene por qué meter gente en ella.
    await exigirAcceso(data.slug);
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
  .middleware([conSesion])
  .inputValidator(z.object({ slug, localId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await exigirAcceso(data.slug);
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
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      localId: z.string().min(1),
      clientName: z.string().optional(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().email().optional(),
      importedFromTpv: z.boolean().optional(),
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
      colorFormula: z.string().nullable().optional(),
      technicalNotes: z.string().nullable().optional(),
      reminderSentAt: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    /**
     * Esta es la única función de escritura que tiene que seguir abierta a
     * gente sin sesión, porque es por donde entra una reserva de la web
     * pública: el cliente del salón pide hora y no tiene ni va a tener cuenta.
     *
     * Así que en vez de cortar, se recorta a lo que una reserva puede hacer:
     *
     *   - No puede pisar una cita que ya exista. Sin esto, cualquiera podría
     *     cambiarle la hora, el precio o el estado a una cita ajena sabiendo
     *     su `local_id`.
     *   - Nace siempre "pendiente" de que el dueño la confirme, diga lo que
     *     diga quien llama. Nadie se autoconfirma la cita, ni se marca a sí
     *     mismo como "ya vino" o "cancelada".
     *   - No toca cobros ni fianzas. Quién ha pagado, cuánto y cómo lo decide
     *     el salón desde su panel, nunca una llamada de fuera.
     *
     * El dueño (miembro, o una demo de venta) no tiene ninguno de estos
     * límites: su panel hace exactamente lo que hacía antes.
     */
    const quien = await acceso(data.slug);
    const manda = tieneMando(quien);

    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };

    if (!manda) {
      const { data: yaExiste, error: errorExiste } = await supabase
        .from("appointments")
        .select("id")
        .eq("salon_slug", data.slug)
        .eq("local_id", data.localId)
        .maybeSingle();
      if (errorExiste) throw new Error(`syncAppointment: ${errorExiste.message}`);
      if (yaExiste) {
        // Una respuesta perdida después de insertar debe poder reintentarse
        // con el MISMO id, incluso si el salón ya ha movido la cita. Nunca
        // se hace upsert sobre una cita pública previa.
        return { synced: true as const };
      }
    }

    let clientId: string | null = null;
    const key = phoneKey(data.clientPhone);
    if (!manda && key.length >= 9) {
      const { data: blocked, error: blockError } = await supabase
        .from("clients")
        .select("penalty_eur, penalty_note")
        .eq("salon_slug", data.slug)
        .eq("phone_key", key)
        .maybeSingle();
      if (blockError) throw new Error(`syncAppointment (bloqueo): ${blockError.message}`);
      if (blocked && isManualBlockRecord(blocked)) {
        return { synced: false as const, reason: ERROR_BLOQUEO_MANUAL };
      }
    }
    if (!manda) {
      // Horario por profesional (`teamHours`) y del local, leídos del perfil
      // guardado: la web pública ya no ofrece esas horas, pero el servidor no
      // se fía de lo que pinte un navegador.
      const { data: salonRow, error: errorSalon } = await supabase
        .from("salons")
        .select("profile")
        .eq("slug", data.slug)
        .maybeSingle();
      if (errorSalon) throw new Error(`syncAppointment (horario): ${errorSalon.message}`);
      const perfil = salonRow?.profile as SalonProfile | undefined;
      if (perfil && !profesionalTrabaja(perfil, data.employeeId, data.startISO, data.durationMin)) {
        return { synced: false as const, reason: ERROR_FUERA_HORARIO };
      }

      const fin = new Date(Date.parse(data.startISO) + data.durationMin * 60_000).toISOString();
      // Acota la lectura a citas recientes. La protección definitiva contra
      // dos inserciones simultáneas debe ser una restricción en PostgreSQL.
      const desde = new Date(Date.parse(data.startISO) - 7 * 24 * 60 * 60_000).toISOString();
      const { data: cercanas, error: errorCercanas } = await supabase
        .from("appointments")
        .select("start_at, duration_min, status")
        .eq("salon_slug", data.slug)
        .eq("employee_id", data.employeeId)
        .gte("start_at", desde)
        .lt("start_at", fin);
      if (errorCercanas) throw new Error(`syncAppointment (hueco): ${errorCercanas.message}`);
      if (haySolape(data.startISO, data.durationMin, cercanas ?? [])) {
        return { synced: false as const, reason: ERROR_HUECO_OCUPADO };
      }
    }
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
    if (manda && data.importedFromTpv && !key && data.clientName) {
      const { data: previa, error: buscarError } = await supabase.from("clients").select("id")
        .eq("salon_slug", data.slug).is("phone", null).eq("name", data.clientName).maybeSingle();
      if (buscarError) throw new Error(`syncAppointment (cliente): ${buscarError.message}`);
      if (previa) clientId = previa.id as string;
      else {
        const { data: creada, error: crearError } = await supabase.from("clients").insert({
          salon_slug: data.slug, name: data.clientName, phone: null,
        }).select("id").single();
        if (crearError) throw new Error(`syncAppointment (cliente): ${crearError.message}`);
        clientId = creada.id as string;
      }
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
      // Una reserva de fuera nace pendiente; el estado lo decide el salón.
      status: manda ? data.status : "pending",
      client_confirmed_at: manda ? (data.clientConfirmedAt ?? null) : null,
      // Una reserva pública puede escribir una nota libre, pero nunca debe
      // poder simular con ella que la señal ya se ha pedido o recibido.
      note: manda ? (data.note ?? null) : (parseDepositNote(data.note).note ?? null),
      // Cobros y fianzas: solo desde el panel.
      payment_method: manda ? (data.paymentMethod ?? null) : null,
      paid_at: manda ? (data.paidAt ?? null) : null,
      deposit_requested_at: manda ? (data.depositRequestedAt ?? null) : null,
      deposit_received_at: manda ? (data.depositReceivedAt ?? null) : null,
      deposit_eur: manda ? (data.depositEur ?? null) : null,
      color_formula: manda ? (data.colorFormula ?? null) : null,
      technical_notes: manda ? (data.technicalNotes ?? null) : null,
      reminder_sent_at: manda ? (data.reminderSentAt ?? null) : null,
    };
    // Solo se toca `client_id` cuando esta llamada sabe de qué cliente habla.
    // Un "confirmar" desde el panel no lleva teléfono, y machacar la columna
    // con null desengancharía la cita de su ficha.
    if (clientId) fila.client_id = clientId;

    const { error } = await supabase
      .from("appointments")
      .upsert(fila, { onConflict: "salon_slug,local_id" });
    if (faltaEsquema(error)) {
      const sinRecordatorio = sinCampos(fila, CAMPOS_RECORDATORIO_CITA);
      const { error: errorTecnicas } = await supabase
        .from("appointments")
        .upsert(sinRecordatorio, { onConflict: "salon_slug,local_id" });
      if (!errorTecnicas) return { synced: true as const };
      if (!faltaEsquema(errorTecnicas)) throw new Error(`syncAppointment: ${errorTecnicas.message}`);
      const sinTecnicas = sinCampos(sinRecordatorio, CAMPOS_TECNICOS_CITA);
      const { error: errorAnterior } = await supabase
        .from("appointments")
        .upsert(sinTecnicas, { onConflict: "salon_slug,local_id" });
      if (!errorAnterior) return { synced: true as const };
      if (!faltaEsquema(errorAnterior)) throw new Error(`syncAppointment: ${errorAnterior.message}`);
      // El DDL de caja y fianzas todavía no está aplicado: se guarda la cita
      // sin esos campos antes que perder el cambio entero. Confirmar una cita
      // delante de un cliente no puede depender de una migración pendiente.
      console.warn(
        "syncAppointment: faltan las columnas de caja/fianza (aplica supabase/schema.sql); la cita se guarda sin ellas",
      );
      const { error: err2 } = await supabase
        .from("appointments")
        .upsert(sinCampos(sinTecnicas, CAMPOS_NUEVOS_CITA), { onConflict: "salon_slug,local_id" });
      if (err2) throw new Error(`syncAppointment: ${err2.message}`);
      return { synced: true as const };
    }
    if (error) throw new Error(`syncAppointment: ${error.message}`);

    return { synced: true as const };
  });

/** Borra una cita de verdad (el panel tiene "eliminar" además de "cancelar"). */
export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, localId: z.string().min(1) }))
  .handler(async ({ data }) => {
    // Borrar la agenda de otro era, literalmente, una llamada con su slug.
    await exigirAcceso(data.slug);
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

/** Alta directa de una ficha, también cuando aún no tiene ninguna cita. */
export const saveClient = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, name: z.string().min(1), phone: z.string(), email: z.string().email().optional(), notes: z.string().optional(), createdAt: z.string().datetime().optional() }))
  .handler(async ({ data }) => {
    await exigirAcceso(data.slug);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    const key = phoneKey(data.phone);
    if (!key) {
      const { data: previa, error: buscarError } = await supabase.from("clients").select("id")
        .eq("salon_slug", data.slug).is("phone", null).eq("name", data.name).maybeSingle();
      if (buscarError) throw new Error(`saveClient: ${buscarError.message}`);
      if (previa) return { synced: true as const };
    }
    const fila = { salon_slug: data.slug, name: data.name, phone: data.phone || null,
      phone_key: key || null, email: data.email ?? null, notes: data.notes ?? null,
      ...(data.createdAt ? { created_at: data.createdAt } : {}) };
    const result = key
      ? await supabase.from("clients").upsert(fila, { onConflict: "salon_slug,phone_key" })
      : await supabase.from("clients").insert(fila);
    if (result.error) throw new Error(`saveClient: ${result.error.message}`);
    return { synced: true as const };
  });

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
  .middleware([conSesion])
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
    // Marcar a una persona como morosa y bloquearle la reserva es una decisión
    // del dueño y de nadie más.
    await exigirAcceso(data.slug);
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
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      clientId: z.string().optional(),
      phone: z.string().min(1),
      note: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await exigirAcceso(data.slug);
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
  .middleware([conSesion])
  .inputValidator(z.object({ slug, phone: z.string().min(1), notes: z.string() }))
  .handler(async ({ data }) => {
    // Las notas son texto libre del salón sobre una persona con nombre y
    // teléfono. Escribirlas —y leerlas— es del dueño.
    await exigirAcceso(data.slug);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    const id = await localizarCliente(supabase, data.slug, data.phone);
    if (!id) return { synced: false as const };
    const { error } = await supabase.from("clients").update({ notes: data.notes }).eq("id", id);
    if (error) throw new Error(`saveClientNotes: ${error.message}`);
    return { synced: true as const };
  });

/**
 * ¿Tiene este teléfono un bloqueo manual o una penalización activa?
 * Lo pregunta la RESERVA PÚBLICA.
 *
 * Devuelve solo la ficha coincidente, nunca la lista de clientes: quien abre
 * el enlace público no tiene por qué recibir los teléfonos de los demás.
 */
export const checkClientPenalty = createServerFn({ method: "GET" })
  .middleware([conSesion])
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
