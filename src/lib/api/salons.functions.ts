import { leerTodasLasFilas } from "./paginar";
import { randomUUID } from "node:crypto";
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
import { validarTelefono, normalizarTelefonoSiValido } from "../telefono";
import process from "node:process";
import { z } from "zod";

import { acceso, exigirAcceso } from "./autorizacion.server";
import {
  accionesDeParcheCita,
  accionesDeParchePerfil,
  exigirAcciones,
  soloCamposWeb,
} from "./guardas";
import { funcionesPlanPanel, recortarDatosPanel, recortarDatosPanelPorPlan, type FuncionesPlanPanel } from "./recorte";
import { PAGINAS, vePagina, alcance, permisosDe, type MiembroActual } from "../permisos";
import { DIAS_RETENCION } from "../cambios";
import { diferenciaDePerfil, resumenRestauracion, versionRestaurable, VERSIONES_WEB_SIEMPRE } from "../resumen-perfil";
import { CAMPOS_PERFIL_SIN_REGISTRO } from "../registro-cambios";
import { PermisoDenegado, tienePermiso } from "./autorizacion";
import { tieneMando, vistaEfectiva } from "./autorizacion";
import { conSesion } from "./sesion.middleware";
import { getSupabaseServerClient } from "../supabase.server";
import { admiteReservaPublicaPorIp } from "./limite-reserva.server";
import { fusionarPerfil } from "../perfil-parche";
import { perfilPublico } from "../perfil-publico";
import { isManualBlockRecord } from "../no-show";
import { parseDepositNote } from "../deposit-deadline";
import { columnasDeParche, filaSinLote3 } from "../cita-parche";
import { ERROR_SOLAPE_PANEL } from "../solape";
import { duracionCartaParaSenal, reglaSenal, senalDeReservaNueva } from "../senal";
import { inferBusinessType } from "../business-type";
import { employeesForType, servicesForType, textosDeCarta } from "../mock/salon";
import { buildCampanas } from "../campanas";
import {
  limpiarRespuestas,
  obligatoriasSinResponder,
  preguntasAplicables,
  preguntasDelSalon,
} from "../preguntas-reserva";
import { profesionalHaceServicios } from "../servicios-profesional";
import { hayBloqueoEnHueco } from "../bloqueos-agenda";
import { zonaDelSalon } from "../zona-horaria";
import { refSenalAplicada, type MetodoPago } from "../pagos";
import {
  ERROR_BLOQUEO_MANUAL,
  ERROR_FUERA_HORARIO,
  ERROR_HUECO_OCUPADO,
  ERROR_PRIVACIDAD_NO_CONFIRMADA,
  ERROR_RESPUESTAS_RESERVA,
  ERROR_SERVICIO_PROFESIONAL,
  ERROR_BLOQUEO_AGENDA,
  ERROR_DATOS_RESERVA,
  ERROR_RESERVA_PASADA,
  ERROR_TELEFONO_INVALIDO,
  ERROR_NOMBRE_INVALIDO,
  ERROR_RESERVA_LEJANA,
  ERROR_DEMASIADAS_RESERVAS,
  HORIZONTE_RESERVA_DIAS,
  MAX_RESERVAS_POR_TELEFONO_Y_DIA,
  MAX_RESERVAS_PUBLICAS_POR_SALON_Y_HORA,
  datosReservaPublicaDesdeCarta,
  faltaColumnaAcusePrivacidad,
  haLeidoAvisoPrivacidad,
  haySolape,
  inicioReservaPublicaEsFuturo,
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
import { equipoCabeEnPlan, planDe } from "../plan";
import { exigirFuncionPlanEn } from "./plan-guardas.server";
import {
  hayOcupadoExternoEnHueco,
  procesarCitaParaConexiones,
} from "../calendario-externo/calendario-externo.server";
import {
  accionCalendarioDe,
  citaParaCalendarioDeFila,
  parcheAfectaCalendario,
} from "./cita-calendario";
import type { CitaParaCalendario } from "../calendario-externo/tipos";

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
const APPOINTMENT_COLS_TECNICAS = "color_formula, technical_notes";
const APPOINTMENT_COLS_RECORDATORIO = "reminder_sent_at";
/** Lote 3 (26/09/2026): lo que iba codificado en `note`, con columna propia. */
const APPOINTMENT_COLS_LOTE3 =
  "booking_answers, deposit_due_at, deposit_period_hours, origen, updated_at";
const CLIENT_COLS_BASE = "id, name, phone, email, notes, penalty_eur, penalty_note, created_at";
const CLIENT_COLS_NUEVAS = "penalty_at, penalty_keep, penalty_block";
const CLIENT_COLS_LOTE3 = "manual_block, tpv_code, birthday, updated_at";
const WAITLIST_COLS =
  "id, local_id, client_name, phone, service_id, preferred_employee_id, preferred_range, created_at";

/**
 * Niveles de esquema, del más reciente al básico. Cada `select` y cada
 * `upsert` se intenta con el nivel completo y, si el esquema de producción
 * todavía no tiene esas columnas (`faltaEsquema`), con el anterior. Así un
 * despliegue nunca depende de que el DDL se haya aplicado antes.
 */
/** Ciclo de vida de la señal (25/09/2026). Es el nivel más reciente. */
const NIVEL_SENAL = [
  "deposit_status",
  "deposit_method",
  "deposit_received_eur",
  "deposit_applied_at",
  "deposit_applied_eur",
  "deposit_refunded_at",
  "deposit_refunded_eur",
  "deposit_retained_at",
  "deposit_note",
];
/** Lote 3: lo que iba codificado en `note`. Al quitarlo, la nota vuelve a llevar los marcadores. */
const NIVEL_LOTE3 = [
  "booking_answers",
  "deposit_due_at",
  "deposit_period_hours",
  "origen",
  "updated_at",
];
/** Marca técnica para la exclusión SQL: distinta del origen TPV de la cita. */
const NIVEL_ORIGEN_RESERVA = ["origen_reserva"];
const NIVELES_CITA: string[][] = [
  NIVEL_ORIGEN_RESERVA,
  ["privacy_notice_acknowledged_at"],
  NIVEL_SENAL,
  NIVEL_LOTE3,
  ["reminder_sent_at"],
  ["color_formula", "technical_notes"],
  ["payment_method", "paid_at", "deposit_requested_at", "deposit_received_at", "deposit_eur"],
];
const NIVELES_CLIENTE: string[][] = [
  ["address", "tax_id", "tpv_alta", "tpv_last_visit"],
  ["manual_block", "tpv_code", "birthday", "updated_at"],
  ["penalty_at", "penalty_keep", "penalty_block"],
];
/** Las listas de columnas que corresponden a cada nivel, de la más completa a la básica. */
function selectsPorNivel(base: string, niveles: string[][]): string[] {
  const out: string[] = [];
  for (let i = 0; i <= niveles.length; i++) {
    const extra = niveles.slice(i).map((n) => n.join(", "));
    out.push([base, ...extra].join(", "));
  }
  return out;
}

/** Campos de una cita o una ficha que solo existen tras el DDL de caja, fianzas y caducidad. */
const CAMPOS_NUEVOS_CITA = NIVELES_CITA[4];
const CAMPOS_TECNICOS_CITA = NIVELES_CITA[3];
const CAMPOS_RECORDATORIO_CITA = NIVELES_CITA[2];
const CAMPOS_LOTE3_CITA = NIVEL_LOTE3;
const CAMPOS_NUEVOS_CLIENTE = NIVELES_CLIENTE[2];
const CAMPOS_LOTE3_CLIENTE = NIVELES_CLIENTE[1];

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

/**
 * Lote 11: la señal APLICADA al cobrar crea su pago (concepto "senal"), sin
 * duplicar si se aplica/desaplica/reaplica — `ref_externa` es siempre
 * `senal:<localId>`, así que un upsert por esa clave es idempotente.
 * Desaplicar (la señal vuelve a "recibida") borra ese pago: ya no es dinero
 * cobrado. Es un best-effort: si `payments` aún no existe (sección 14 de
 * supabase/pendiente.sql sin aplicar) o algo falla, solo se avisa por
 * consola — la cita ya se guardó, y esto no debe tumbarla.
 */
async function sincronizarPagoDeSenal(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  slug: string,
  localId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!("depositStatus" in patch) && !("depositAppliedEur" in patch)) return;
  const refExterna = refSenalAplicada(localId);
  try {
    if (
      patch.depositStatus === "aplicada" &&
      typeof patch.depositAppliedEur === "number" &&
      patch.depositAppliedEur > 0
    ) {
      const { data: fila } = await supabase
        .from("appointments")
        .select("client_id, client_name, deposit_method")
        .eq("salon_slug", slug)
        .eq("local_id", localId)
        .maybeSingle();
      const metodoGuardado =
        (patch.depositMethod as string | undefined) ?? (fila?.deposit_method as string | undefined);
      const metodo: MetodoPago =
        metodoGuardado === "efectivo" || metodoGuardado === "tarjeta" ? metodoGuardado : "bizum";
      const { error } = await supabase.from("payments").upsert(
        {
          salon_slug: slug,
          appointment_id: localId,
          client_id: (fila?.client_id as string | null) ?? null,
          client_name: (fila?.client_name as string | null) ?? null,
          importe_eur: patch.depositAppliedEur,
          metodo,
          concepto: "senal",
          origen: "sishow",
          ref_externa: refExterna,
          fecha: new Date().toISOString(),
        },
        { onConflict: "salon_slug,origen,ref_externa" },
      );
      if (error && !faltaEsquema(error)) console.warn(`sincronizarPagoDeSenal: ${error.message}`);
    } else if (typeof patch.depositStatus === "string" && patch.depositStatus !== "aplicada") {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("salon_slug", slug)
        .eq("origen", "sishow")
        .eq("ref_externa", refExterna);
      if (error && !faltaEsquema(error))
        console.warn(`sincronizarPagoDeSenal (borrado): ${error.message}`);
    }
  } catch (err) {
    console.warn(
      `sincronizarPagoDeSenal (¿falta aplicar supabase/pendiente.sql sección 14?): ${err}`,
    );
  }
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
 *                sin una sola ficha de cliente— aunque pida la del panel. En
 *                el panel aplica además el plan guardado: Básico no recibe
 *                histórico avanzado y solo sale la campaña de reseña. Es así
 *                porque la web de reservas de un salón de pago tiene que
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
/**
 * La profesional que tiene AHORA una cita en la base de datos. Hace falta
 * para el alcance «propio» (lote 8): una estilista solo toca citas suyas, y
 * lo que diga el navegador sobre de quién es la cita no cuenta.
 */
async function profesionalActual(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  slug: string,
  localId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("appointments")
    .select("employee_id")
    .eq("salon_slug", slug)
    .eq("local_id", localId)
    .maybeSingle();
  return (data as { employee_id?: string } | null)?.employee_id ?? null;
}

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
  .inputValidator(z.object({ slug, pagina: z.enum(PAGINAS).optional() }))
  .handler(
    async ({
      data,
    }): Promise<{ real: boolean; permitido: boolean; miembro: MiembroActual | null }> => {
      const quien = await acceso(data.slug);
      // El miembro que entra (lote 8): rol, profesional vinculada y nombre para
      // el saludo. null en una demo o para quien no pertenece al salón.
      const miembro =
        quien.tipo === "miembro"
          ? {
              userId: quien.userId,
              rol: quien.rol,
              employeeId: quien.employeeId,
              displayName: quien.displayName,
              permisosExtra: quien.permisosExtra,
            }
          : null;
      return { real: quien.tipo !== "demo", permitido: tieneMando(quien) && (!data.pagina || !miembro || vePagina(permisosDe(miembro.rol, miembro.permisosExtra), data.pagina)), miembro };
    },
  );

export type { MiembroActual } from "../permisos";

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
      // Solo en el despliegue de PRODUCCIÓN de Vercel que falte Supabase es
      // un despliegue roto: un salón de pago no puede degradar a demo en
      // silencio y confirmar citas que no se guardan en ninguna parte. Se
      // lanza, y la web pública y el panel lo muestran como fallo.
      //
      // No vale mirar NODE_ENV: los previews de Vercel también corren con
      // NODE_ENV=production y NO tienen las variables de Supabase (están solo
      // en Production), así que todas las demos de un preview quedaban en
      // «fallo» (25/09/2026). En previews y en local sin variables, todo es
      // demo, como siempre.
      if (process.env.VERCEL_ENV === "production") throw new Error("Backend sin configurar");
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
    return { profile: perfilPublico({ ...profile, slug: row.slug }) };
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
export type MotivoNoPublicado = "sin-backend" | "falta-esquema" | "limite-profesionales";

function perfilDentroDelTopeDeProfesionales(profile: Record<string, unknown>, slugSalon?: string): boolean {
  return equipoCabeEnPlan(
    planDe({ plan: typeof profile.plan === "string" ? profile.plan : null }, false),
    profile.team,
    slugSalon,
  );
}

export const saveSalonProfile = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, profile: z.record(z.string(), z.unknown()) }))
  .handler(
    async ({ data }): Promise<{ synced: true } | { synced: false; motivo: MotivoNoPublicado }> => {
      // Sobrescribir el perfil entero de un salón es cosa de su dueño. Sin
      // esto, cualquiera podía cambiarle el teléfono, la dirección o la carta.
      const quien = await exigirAcceso(data.slug);
      // Este endpoint sobreescribe el PERFIL ENTERO. La edición de Mi página
      // usa `patchSalonProfile`, que comprueba solo sus campos de web; aquí
      // hace falta además el permiso de plan: es la única forma de garantizar
      // que ni una estilista autorizada para la web ni una subencargada puedan
      // mandar por API un plan, una fianza o cualquier ajuste ajeno.
      exigirAcciones(quien, ["web.publicar", "salon.editar", "plan.gestionar"]);
      if (!perfilDentroDelTopeDeProfesionales(data.profile, data.slug)) {
        return { synced: false as const, motivo: "limite-profesionales" as const };
      }
      const supabase = getSupabaseServerClient();
      if (!supabase) return { synced: false as const, motivo: "sin-backend" as const };

      const { data: filaActual } = await supabase
        .from("salons")
        .select("profile")
        .eq("slug", data.slug)
        .maybeSingle();
      const perfilAGuardar = conClavesDelServidor(
        data.profile,
        (filaActual as { profile?: Record<string, unknown> } | null)?.profile,
      );
      const { error } = await supabase
        .from("salons")
        .upsert(
          { slug: data.slug, profile: perfilAGuardar, updated_at: new Date().toISOString() },
          { onConflict: "slug" },
        );
      if (faltaEsquema(error)) {
        return { synced: false as const, motivo: "falta-esquema" as const };
      }
      if (error) throw new Error(`saveSalonProfile: ${error.message}`);
      // Versión de lo publicado (lote 9): «Restaurar esta versión». Si la tabla
      // aún no existe, publicar sigue funcionando igual.
      await guardarVersion(
        supabase,
        data.slug,
        perfilAGuardar,
        quien.tipo === "miembro" ? quien : null,
        null,
      );
      return { synced: true as const };
    },
  );

/* ---------------------------------------------------------------------- */
/* Versiones del perfil (lote 9)                                           */
/* ---------------------------------------------------------------------- */

const VERSIONES_MINIMAS = 30;

async function guardarVersion(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  salonSlug: string,
  profile: Record<string, unknown>,
  autor: { userId: string; displayName: string | null } | null,
  nota: string | null,
): Promise<string | null> {
  const id = randomUUID();
  const { error } = await supabase.from("perfil_versiones").insert({
    id,
    salon_slug: salonSlug,
    perfil: profile,
    publicado_por: autor?.userId ?? null,
    autor_nombre: autor?.displayName ?? null,
    nota,
  });
  if (error) {
    console.warn(`perfil_versiones (¿falta aplicar supabase/pendiente.sql?): ${error.message}`);
    return null;
  }
  // Se quedan las 30 últimas o las de los últimos 90 días, lo que dé más.
  const { data: viejas } = await supabase
    .from("perfil_versiones")
    .select("id, fecha")
    .eq("salon_slug", salonSlug)
    .order("fecha", { ascending: false })
    .range(VERSIONES_MINIMAS, 1000);
  const limite = Date.now() - DIAS_RETENCION * 86_400_000;
  const borrar = (viejas ?? [])
    .filter((v: { fecha: string }) => Date.parse(v.fecha) < limite)
    .map((v: { id: string }) => v.id);
  if (borrar.length) await supabase.from("perfil_versiones").delete().in("id", borrar);
  return id;
}

export const listarVersiones = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, completo: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    exigirAcciones(quien, ["web.restaurar-version"]);
    if (data.completo) await exigirFuncionPlanEn(data.slug, "historial-completo", quien);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { versiones: [] };
    // 22-oct: las últimas VERSIONES_WEB_SIEMPRE se ven y se recuperan con
    // CUALQUIER plan (antes, sin historial completo, solo salía la actual y
    // no se podía volver a ninguna). El plan amplía a 60.
    const { data: filas, error } = await supabase
      .from("perfil_versiones")
      .select("id, fecha, autor_nombre, nota")
      .eq("salon_slug", data.slug)
      .order("fecha", { ascending: false })
      .limit(data.completo ? 60 : VERSIONES_WEB_SIEMPRE);
    if (error) return { versiones: [] };
    return {
      versiones: (filas ?? []).map(
        (f: { id: string; fecha: string; autor_nombre: string | null; nota: string | null }) => ({
          id: f.id,
          fecha: f.fecha,
          autorNombre: f.autor_nombre,
          nota: f.nota,
        }),
      ),
    };
  });

/**
 * Claves del perfil que decide el servidor (el operador de siShow), no el
 * navegador (M3, auditoría 18-oct-2026): el plan que se paga y el flag de
 * calendarios externos. Antes cualquier gerente podía darse `todo-incluido`
 * con un `patchSalonProfile({ plan })`.
 */
const CLAVES_SOLO_SERVIDOR = ["plan", "calendariosExternosActivo"] as const;

/** `nuevo` con las claves reservadas tomadas de `actual` (no de lo que mande el navegador). */
function conClavesDelServidor(
  nuevo: Record<string, unknown>,
  actual: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const salida = { ...nuevo };
  for (const k of CLAVES_SOLO_SERVIDOR) {
    if (actual && k in actual) salida[k] = actual[k];
    else delete salida[k];
  }
  return salida;
}

/** Puesto de una versión entre las del salón (0 = la más reciente). */
async function posicionDeVersion(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  salonSlug: string,
  fecha: string,
): Promise<number> {
  const { count } = await supabase
    .from("perfil_versiones")
    .select("id", { count: "exact", head: true })
    .eq("salon_slug", salonSlug)
    .gt("fecha", fecha);
  return count ?? 0;
}

async function tieneHistorialCompleto(slugSalon: string, quien: Parameters<typeof exigirFuncionPlanEn>[2]): Promise<boolean> {
  try {
    await exigirFuncionPlanEn(slugSalon, "historial-completo", quien);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lo que tenía Mi página en una versión (solo los campos de la web), para
 * enseñar ANTES de restaurar qué cambiaría y cómo se veía (22-oct). Antes el
 * salón real tenía que restaurar a ciegas.
 */
export const verVersion = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, versionId: z.string().min(8) }))
  .handler(async ({ data }): Promise<{ ok: true; web: Record<string, JsonPerfil>; restaurable: boolean } | { ok: false; motivo: string }> => {
    const quien = await exigirAcceso(data.slug);
    exigirAcciones(quien, ["web.restaurar-version"]);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { ok: false, motivo: "sin-backend" };
    const { data: v } = await supabase
      .from("perfil_versiones")
      .select("perfil, fecha")
      .eq("id", data.versionId)
      .eq("salon_slug", data.slug)
      .maybeSingle();
    if (!v) return { ok: false, motivo: "Esa versión ya no existe." };
    const restaurable = versionRestaurable(await posicionDeVersion(supabase, data.slug, String(v.fecha)), await tieneHistorialCompleto(data.slug, quien));
    return { ok: true, web: soloCamposWeb((v.perfil ?? {}) as Record<string, unknown>) as Record<string, JsonPerfil>, restaurable };
  });

/** Publica de nuevo una versión anterior (como versión nueva) y lo deja en el historial. */
export const restaurarVersion = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, versionId: z.string().min(8) }))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; profile: Record<string, JsonPerfil> } | { ok: false; motivo: string }
    > => {
      const quien = await exigirAcceso(data.slug);
      exigirAcciones(quien, ["web.restaurar-version"]);
      const supabase = getSupabaseServerClient();
      if (!supabase) return { ok: false, motivo: "sin-backend" };
      const { data: v } = await supabase
        .from("perfil_versiones")
        .select("perfil, fecha")
        .eq("id", data.versionId)
        .eq("salon_slug", data.slug)
        .maybeSingle();
      if (!v) return { ok: false, motivo: "Esa versión ya no existe." };
      // Las últimas VERSIONES_WEB_SIEMPRE se recuperan con cualquier plan;
      // más atrás hace falta el historial completo (y se dice, no se calla).
      if (!versionRestaurable(await posicionDeVersion(supabase, data.slug, String(v.fecha)), await tieneHistorialCompleto(data.slug, quien)))
        return { ok: false, motivo: `Con tu plan puedes volver a las ${VERSIONES_WEB_SIEMPRE} últimas versiones de tu página. Esta es más antigua: para recuperarla hace falta el historial completo.` };
      const { data: actual } = await supabase
        .from("salons")
        .select("profile")
        .eq("slug", data.slug)
        .maybeSingle();
      const perfilAnterior = ((actual as { profile?: unknown } | null)?.profile ?? {}) as Record<
        string,
        unknown
      >;
      // Las versiones históricas guardan el perfil entero. Una persona a quien
      // solo se le dio Mi página puede restaurar su web, pero no recuperar por
      // esa puerta un plan, un ajuste de caja o cualquier otro mando del salón.
      const restauraPerfilEntero =
        tienePermiso(quien, "salon.editar") && tienePermiso(quien, "plan.gestionar");
      const perfilRestaurado = restauraPerfilEntero
        ? conClavesDelServidor(v.perfil as Record<string, unknown>, perfilAnterior)
        : { ...perfilAnterior, ...soloCamposWeb(v.perfil as Record<string, unknown>) };
      const { error } = await supabase
        .from("salons")
        .update({ profile: perfilRestaurado, updated_at: new Date().toISOString() })
        .eq("slug", data.slug);
      if (error)
        return { ok: false, motivo: "No se ha podido restaurar. Tu web sigue como estaba." };
      const autor = quien.tipo === "miembro" ? quien : null;
      await guardarVersion(
        supabase,
        data.slug,
        perfilRestaurado,
        autor,
        `Restaurada la versión del ${String(v.fecha).slice(0, 10)}`,
      );
      // Campo a campo y solo lo que cambia (22-oct): así «Deshacer» en el
      // Historial aplica justo esos campos de vuelta. Antes se guardaba
      // `{ perfil: {...} }` entero, que el deshacer no sabía aplicar.
      const dif = diferenciaDePerfil(
        perfilAnterior,
        perfilRestaurado,
        [...new Set([...Object.keys(perfilAnterior), ...Object.keys(perfilRestaurado)])].filter(
          (k) => !CAMPOS_PERFIL_SIN_REGISTRO.has(k) && !(CLAVES_SOLO_SERVIDOR as readonly string[]).includes(k),
        ),
      );
      await supabase.from("cambios").insert({
        id: randomUUID(),
        salon_slug: data.slug,
        tipo: "perfil.restaurar",
        entidad: "perfil",
        id_entidad: "perfil",
        antes: dif.antes,
        despues: dif.despues,
        resumen: resumenRestauracion(String(v.fecha), Object.keys(dif.despues)),
        autor: autor?.userId ?? null,
        autor_nombre: autor?.displayName ?? null,
        fecha: new Date().toISOString(),
        aviso_enviado: false,
      });
      // Devolver solo el parche a quien no tiene mando evita que su store
      // vuelva a enviar un perfil entero al hidratar la versión restaurada.
      const perfilParaPanel = restauraPerfilEntero
        ? perfilRestaurado
        : soloCamposWeb(v.perfil as Record<string, unknown>);
      return { ok: true, profile: perfilParaPanel as Record<string, JsonPerfil> };
    },
  );

type JsonPerfil = string | number | boolean | null | JsonPerfil[] | { [k: string]: JsonPerfil };

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
  .inputValidator(
    z.object({
      slug,
      patch: z.record(z.string(), z.unknown()),
      /** «Publicar cambios» de Mi página: deja además la versión publicada en Versiones. */
      publicar: z.boolean().optional(),
    }),
  )
  .handler(
    async ({ data }): Promise<{ synced: true } | { synced: false; motivo: MotivoNoAplicado }> => {
      const quien = await exigirAcceso(data.slug);
      exigirAcciones(quien, accionesDeParchePerfil(Object.keys(data.patch)));
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

      const actualPerfil = (fila.profile ?? {}) as Record<string, unknown>;
      for (const k of CLAVES_SOLO_SERVIDOR) {
        if (k in data.patch && JSON.stringify(data.patch[k] ?? null) !== JSON.stringify(actualPerfil[k] ?? null))
          throw new PermisoDenegado("plan.gestionar");
      }
      const fusionado = fusionarPerfil(actualPerfil, data.patch);
      if ("team" in data.patch && !perfilDentroDelTopeDeProfesionales(fusionado, data.slug)) {
        return { synced: false as const, motivo: "limite-profesionales" as const };
      }

      const { error } = await supabase
        .from("salons")
        .update({ profile: fusionado, updated_at: new Date().toISOString() })
        .eq("slug", data.slug);
      if (faltaEsquema(error)) {
        return { synced: false as const, motivo: "falta-esquema" as const };
      }
      if (error) throw new Error(`patchSalonProfile: ${error.message}`);
      // Versión ligera agrupada (lote 9b): al empezar una tanda de ajustes
      // (la última versión tiene más de 30 min) se guarda el perfil ANTERIOR,
      // como punto al que volver. Una tanda = una versión, no una por
      // interruptor; el deshacer fino lo da cada cambio por campo.
      const { data: ultima } = await supabase
        .from("perfil_versiones")
        .select("fecha")
        .eq("salon_slug", data.slug)
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (tocaVersionLigera((ultima as { fecha?: string } | null)?.fecha ?? null, new Date())) {
        await guardarVersion(
          supabase,
          data.slug,
          (fila.profile ?? {}) as Record<string, unknown>,
          quien.tipo === "miembro" ? quien : null,
          data.publicar ? "Antes de publicar" : "Antes de cambiar ajustes",
        );
      }
      // 22-oct: cada publicación de Mi página es una versión con su contenido
      // (antes solo quedaba el punto de ANTES de la tanda, y lo publicado no
      // aparecía en Versiones hasta la tanda siguiente).
      if (data.publicar) {
        await guardarVersion(
          supabase,
          data.slug,
          fusionado,
          quien.tipo === "miembro" ? quien : null,
          "Publicada desde Mi página",
        );
      }
      return { synced: true as const };
    },
  );

/** Minutos que agrupa una tanda de ajustes en una sola versión ligera. */
export const MINUTOS_TANDA_AJUSTES = 30;

/** ¿Empieza una tanda nueva de ajustes (y toca guardar el punto de vuelta)? */
export function tocaVersionLigera(ultimaISO: string | null, ahora: Date): boolean {
  if (!ultimaISO) return true;
  return ahora.getTime() - Date.parse(ultimaISO) > MINUTOS_TANDA_AJUSTES * 60_000;
}

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
    }): Promise<{
      appointments: Appointment[];
      clients: Client[];
      waitlist: WaitlistEntry[];
      campanas?: ReturnType<typeof buildCampanas>;
      funcionesPlan?: FuncionesPlanPanel;
    }> => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        // Sin Supabase solo existen demos locales: no hay datos de servidor
        // que hidratar, pero ambas funciones conservan el muestrario local.
        return { appointments: [], clients: [], waitlist: [], funcionesPlan: funcionesPlanPanel({ tipo: "demo" }, {}) };
      }

      const quien = await acceso(data.slug);
      // Las demos viven en el navegador y nunca tienen fila en `salons`.
      // Conservan la misma respuesta vacía de servidor de antes.
      if (quien.tipo === "demo") {
        return { appointments: [], clients: [], waitlist: [], funcionesPlan: funcionesPlanPanel(quien, {}) };
      }
      const publica = vistaEfectiva(data.vista, quien) === "publica";

      // El plan se lee de la fila del salón, nunca de un dato que mande el navegador.
      let perfil: SalonProfile | null = null;
      if (!publica) {
        const { data: salon, error } = await supabase
          .from("salons")
          .select("profile")
          .eq("slug", data.slug)
          .maybeSingle();
        if (error || !salon) throw new Error("No se ha podido comprobar el plan de este salón.");
        perfil = { ...((salon.profile ?? {}) as SalonProfile), slug: data.slug };
      }

      /**
       * Un `select` con las columnas nuevas y, si el esquema todavía no las
       * tiene, el mismo `select` solo con las de siempre. Sin esto, aplicar
       * este código antes que el DDL dejaría la agenda en blanco.
       */
      async function traer<T>(tabla: string, selects: string[]) {
        let ultimo: { data: T[]; error: { message: string } | null } = { data: [], error: null };
        for (const columnas of selects) {
          // Por páginas: PostgREST corta en 1000 filas sin avisar (ver api/paginar.ts).
          const r = await leerTodasLasFilas<T, { message: string }>(
            (desde, hasta) => {
              const consulta = supabase!
                .from(tabla)
                .select(columnas)
                .eq("salon_slug", data.slug);
              // La web solo calcula huecos. Basta el pasado inmediato para no
              // ofrecer un tramo que empezó hace minutos y aún sigue ocupado;
              // no se entrega el historial entero ni estados ya resueltos.
              const acotada = tabla === "appointments" && publica
                ? consulta.gte("start_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString()).in("status", ["pending", "confirmed", "in-progress", "blocked"])
                : consulta;
              return acotada
                .order("id")
                .range(desde, hasta) as unknown as PromiseLike<{
                data: T[] | null;
                error: { message: string } | null;
              }>;
            },
          );
          if (!r.error) return { data: (r.data ?? []) as unknown as T[], error: null };
          if (!faltaEsquema(r.error)) return { data: [] as T[], error: r.error };
          console.warn(
            `listSalonData: ${tabla} sin alguna columna de «${columnas}»; falta aplicar supabase/pendiente.sql`,
          );
          ultimo = { data: [] as T[], error: r.error };
        }
        return ultimo;
      }

      const [citas, fichas, espera] = await Promise.all([
        traer<AppointmentRow>("appointments", selectsPorNivel(APPOINTMENT_COLS_BASE, NIVELES_CITA)),
        publica
          ? Promise.resolve({ data: [] as ClientRow[], error: null })
          : traer<ClientRow>("clients", selectsPorNivel(CLIENT_COLS_BASE, NIVELES_CLIENTE)),
        // La lista de espera es del dueño: la web pública ni la pide. Y si la
        // tabla todavía no existe, se responde vacía — que es justo lo que
        // debe ver un salón real, en vez de las 4 entradas de ejemplo del seed.
        publica
          ? Promise.resolve({ data: [] as WaitlistRow[], error: null })
          : leerTodasLasFilas<WaitlistRow, { message: string }>(
              (desde, hasta) =>
                supabase
                  .from("waitlist")
                  .select(WAITLIST_COLS)
                  .eq("salon_slug", data.slug)
                  .order("id")
                  .range(desde, hasta) as unknown as PromiseLike<{
                  data: WaitlistRow[] | null;
                  error: { message: string } | null;
                }>,
            ).then((r) => ({
              data: (r.data ?? []) as unknown as WaitlistRow[],
              error: faltaEsquema(r.error) ? null : r.error,
            })),
      ]);

      if (citas.error) throw new Error(`listSalonData (citas): ${citas.error.message}`);
      if (fichas.error) throw new Error(`listSalonData (clientes): ${fichas.error.message}`);
      if (espera.error) throw new Error(`listSalonData (lista de espera): ${espera.error.message}`);

      const todo = {
        appointments: (citas.data ?? []).map((r) => rowToAppointment(r, publica)),
        clients: (fichas.data ?? []).map(rowToClient),
        waitlist: (espera.data ?? []).map(rowToWaitlist),
      };
      // Vista de panel: cada rol recibe solo lo suyo (lote 8). Las campañas
      // se calculan en servidor y se recortan por plan antes de la respuesta.
      if (publica) return todo;
      const porRol = recortarDatosPanel(quien, todo);
      const perfilSeguro = perfil!;
      const tipo = inferBusinessType(perfilSeguro.tagline, perfilSeguro.name);
      const campanas = buildCampanas({
        appointments: porRol.appointments,
        clients: porRol.clients,
        services: servicesForType(tipo, perfilSeguro.menu, textosDeCarta(perfilSeguro)),
        employees: employeesForType(
          tipo,
          perfilSeguro.team,
          perfilSeguro.teamHours,
          perfilSeguro.openingHours,
          perfilSeguro.teamIds,
          perfilSeguro.demoAbreHoy,
          perfilSeguro.serviciosPorProfesional,
        ),
        salonName: perfilSeguro.name,
        salonAddress: perfilSeguro.address,
        timeZone: zonaDelSalon(perfilSeguro),
        canales: { enlaces: perfilSeguro.enlaces, boletin: perfilSeguro.boletin },
      });
      return recortarDatosPanelPorPlan(quien, perfilSeguro, todo, campanas);
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
      localId: z.string().min(1).max(100),
      clientName: z.string().min(1).max(100),
      phone: z.string().max(30).default(""),
      serviceId: z.string().max(100).default(""),
      preferredEmployeeId: z.string().max(100).default("any"),
      preferredRange: z.string().max(100).default(""),
    }),
  )
  .handler(async ({ data }) => {
    // La lista de espera la lleva el dueño desde el panel; la web de reservas
    // no escribe aquí. Nadie de fuera tiene por qué meter gente en ella.
    exigirAcciones(await exigirAcceso(data.slug), ["lista-espera.gestionar"]);
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
    exigirAcciones(await exigirAcceso(data.slug), ["lista-espera.gestionar"]);
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
      localId: z.string().min(1).max(100),
      clientName: z.string().max(100).optional(),
      clientPhone: z.string().max(30).optional(),
      // Correo opcional en la web pública: vacío = sin correo (antes daba 400).
      clientEmail: z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.string().trim().email().max(200).optional(),
      ),
      importedFromTpv: z.boolean().optional(),
      serviceIds: z.array(z.string().max(100)).max(20).default([]),
      employeeId: z.string().min(1).max(100),
      startISO: z.string().datetime(),
      durationMin: z.number().nonnegative().max(24 * 60),
      priceEur: z.number().nonnegative().max(100_000),
      status: z.string().min(1).max(40),
      clientConfirmedAt: z.string().datetime().nullable().optional(),
      note: z.string().max(1000).nullable().optional(),
      paymentMethod: z.string().max(40).nullable().optional(),
      paidAt: z.string().datetime().nullable().optional(),
      depositRequestedAt: z.string().datetime().nullable().optional(),
      depositReceivedAt: z.string().datetime().nullable().optional(),
      depositEur: z.number().nullable().optional(),
      depositStatus: z
        .enum(["por_pedir", "pedida", "recibida", "aplicada", "devuelta", "retenida", "anulada"])
        .nullable()
        .optional(),
      depositMethod: z
        .enum(["bizum", "efectivo", "tarjeta", "transferencia"])
        .nullable()
        .optional(),
      depositReceivedEur: z.number().nonnegative().nullable().optional(),
      depositAppliedAt: z.string().datetime().nullable().optional(),
      depositAppliedEur: z.number().nonnegative().nullable().optional(),
      depositRefundedAt: z.string().datetime().nullable().optional(),
      depositRefundedEur: z.number().nonnegative().nullable().optional(),
      depositRetainedAt: z.string().datetime().nullable().optional(),
      depositNote: z.string().max(500).nullable().optional(),
      colorFormula: z.string().max(2000).nullable().optional(),
      technicalNotes: z.string().max(5000).nullable().optional(),
      reminderSentAt: z.string().datetime().nullable().optional(),
      privacyNoticeAccepted: z.boolean().optional(),
      // Lote 3: lo que antes iba codificado dentro de `note`.
      // Respuestas del formulario de reserva `{ idDePregunta: valor }`. Llegan de
      // la web pública: claves cortas, valores acotados y como mucho 40.
      bookingAnswers: z
        .record(z.string().regex(/^[A-Za-z0-9_-]{1,60}$/), z.string().max(300))
        .refine((r) => Object.keys(r).length <= 40)
        .nullable()
        .optional(),
      depositDueAt: z.string().datetime().nullable().optional(),
      depositPeriodHours: z.number().nonnegative().max(24 * 365).nullable().optional(),
      origen: z.enum(["sishow", "tpv123"]).optional(),
      /** Solo el panel, y solo tras confirmar el aviso de solape (ver lib/solape.ts). */
      permitirSolape: z.boolean().optional(),
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
    // Un slug que no existe en salons no es un salón al que reservar: no se
    // guarda nada (A1). Las demos viven en el navegador.
    if (quien.tipo === "demo") return { synced: false as const };
    const manda = tieneMando(quien);

    // Una reserva pública solo se guarda después de confirmar el aviso. La
    // marca de tiempo se genera aquí; el navegador no puede inventarla.
    if (!manda && !haLeidoAvisoPrivacidad(data.privacyNoticeAccepted)) {
      return { synced: false as const, reason: ERROR_PRIVACIDAD_NO_CONFIRMADA };
    }
    // Teléfono (feedback PeluChic 21-oct): la reserva pública solo entra con
    // un número válido y se guarda en E.164. El panel no se rechaza (fichas e
    // importaciones antiguas), pero si el número es válido también se normaliza.
    // phone_key (últimos 9 dígitos) sale igual, así que el casado no cambia.
    if (data.clientPhone) {
      if (!manda) {
        const tel = validarTelefono(data.clientPhone);
        if (!tel.ok) return { synced: false as const, reason: ERROR_TELEFONO_INVALIDO };
        data.clientPhone = tel.e164;
      } else {
        data.clientPhone = normalizarTelefonoSiValido(data.clientPhone);
      }
    }
    if (!manda) {
      const nombre = (data.clientName ?? "").trim();
      if (nombre.length < 2) return { synced: false as const, reason: ERROR_NOMBRE_INVALIDO };
      data.clientName = nombre;
    }
    if (!manda && !inicioReservaPublicaEsFuturo(data.startISO)) {
      return { synced: false as const, reason: ERROR_RESERVA_PASADA };
    }
    if (!manda && Date.parse(data.startISO) > Date.now() + HORIZONTE_RESERVA_DIAS * 86_400_000) {
      return { synced: false as const, reason: ERROR_RESERVA_LEJANA };
    }
    if (!manda && !admiteReservaPublicaPorIp(data.slug)) {
      return { synced: false as const, reason: ERROR_DEMASIADAS_RESERVAS };
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };

    // Permisos por rol (lote 8): crear sobre la profesional elegida; editar una
    // cita que ya existe, sobre la que la tiene ahora y sobre la nueva.
    if (quien.tipo === "miembro") {
      const antes = await profesionalActual(supabase, data.slug, data.localId);
      if (antes === null) exigirAcciones(quien, ["cita.crear"], [data.employeeId]);
      else
        exigirAcciones(
          quien,
          antes === data.employeeId ? ["cita.editar"] : ["cita.editar", "cita.mover"],
          [antes, data.employeeId],
        );
    }

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

    // Ritmo (M4): tope de reservas públicas nuevas por salón y hora. Sin
    // infraestructura nueva: se cuenta en la propia tabla.
    if (!manda) {
      const { data: recientes, error: errorRitmo } = await supabase
        .from("appointments")
        .select("id")
        .eq("salon_slug", data.slug)
        .eq("status", "pending")
        .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
      if (errorRitmo) throw new Error(`syncAppointment (ritmo): ${errorRitmo.message}`);
      if ((recientes ?? []).length >= MAX_RESERVAS_PUBLICAS_POR_SALON_Y_HORA) {
        return { synced: false as const, reason: ERROR_DEMASIADAS_RESERVAS };
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
    /** Perfil del salón, leído solo para las reservas de fuera (horario y señal). */
    let perfilPublico: SalonProfile | undefined;
    let respuestasReserva: Record<string, string | undefined> | undefined;
    let datosRecalculados: { durationMin: number; priceEur: number } | undefined;
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
      perfilPublico = perfil;
      datosRecalculados = perfil
        ? (datosReservaPublicaDesdeCarta(perfil, data.serviceIds) ?? undefined)
        : undefined;
      if (
        !datosRecalculados ||
        data.durationMin !== datosRecalculados.durationMin ||
        Math.round(data.priceEur * 100) !== Math.round(datosRecalculados.priceEur * 100)
      ) {
        return { synced: false as const, reason: ERROR_DATOS_RESERVA };
      }
      if (
        perfil &&
        !profesionalHaceServicios(data.employeeId, data.serviceIds, perfil.serviciosPorProfesional)
      ) {
        return { synced: false as const, reason: ERROR_SERVICIO_PROFESIONAL };
      }
      if (
        perfil &&
        hayBloqueoEnHueco(
          perfil.bloqueosAgenda,
          data.employeeId,
          data.startISO,
          datosRecalculados.durationMin,
          zonaDelSalon(perfil),
        )
      ) {
        return { synced: false as const, reason: ERROR_BLOQUEO_AGENDA };
      }
      if (
        perfil &&
        !profesionalTrabaja(perfil, data.employeeId, data.startISO, datosRecalculados.durationMin)
      ) {
        return { synced: false as const, reason: ERROR_FUERA_HORARIO };
      }
      if (perfil) {
        const preguntas = preguntasAplicables(
          preguntasDelSalon(perfil, inferBusinessType(perfil.tagline, perfil.name)),
          data.serviceIds,
        );
        respuestasReserva = limpiarRespuestas(preguntas, data.bookingAnswers ?? undefined);
        if (obligatoriasSinResponder(preguntas, respuestasReserva).length > 0) {
          return { synced: false as const, reason: ERROR_RESPUESTAS_RESERVA };
        }
      }

      if (
        await solapaEnServidor(
          supabase,
          data.slug,
          data.localId,
          data.employeeId,
          data.startISO,
          datosRecalculados.durationMin,
        )
      ) {
        return { synced: false as const, reason: ERROR_HUECO_OCUPADO };
      }

      // Lote 13: un hueco ocupado por un calendario externo conectado (con
      // `bloquearHuecos` activo) se trata igual que uno ocupado por otra
      // cita de siShow — mismo motivo de siempre, no hay uno nuevo. Ver
      // docs/contrato-calendarios.md §5. Si la tabla aún no existe (SQL sin
      // aplicar) o falla, se abre paso: es exactamente el comportamiento de
      // antes de este lote.
      const finExterno = new Date(
        Date.parse(data.startISO) + datosRecalculados.durationMin * 60_000,
      ).toISOString();
      const ocupadoExterno = await hayOcupadoExternoEnHueco(
        data.slug,
        data.employeeId,
        data.startISO,
        finExterno,
      ).catch(() => false);
      if (ocupadoExterno) {
        return { synced: false as const, reason: ERROR_HUECO_OCUPADO };
      }
    }
    // El panel puede solapar a propósito, pero solo diciéndolo: sin
    // `permitirSolape` se rechaza con su propio código y la pantalla enseña
    // el aviso. Ver el contrato en lib/solape.ts.
    if (manda && !data.permitirSolape) {
      if (
        await solapaEnServidor(
          supabase,
          data.slug,
          data.localId,
          data.employeeId,
          data.startISO,
          data.durationMin,
        )
      ) {
        return { synced: false as const, reason: ERROR_SOLAPE_PANEL };
      }
    }
    if (!manda && data.clientPhone && key.length >= 6 && data.clientName) {
      // Reserva pública (A4): quien reserva NO es dueño de la ficha. Si la
      // clienta ya existe se reutiliza tal cual (solo se rellenan campos que
      // estén vacíos); nunca se pisa su nombre ni su correo, que son a donde
      // llegan después los recordatorios.
      const { data: existente, error: errorBuscar } = await supabase
        .from("clients")
        .select("id, name, email")
        .eq("salon_slug", data.slug)
        .eq("phone_key", key)
        .maybeSingle();
      if (errorBuscar) throw new Error(`syncAppointment (cliente): ${errorBuscar.message}`);
      if (existente) {
        clientId = existente.id as string;
        const relleno: Record<string, string> = {};
        if (!existente.name) relleno.name = data.clientName;
        if (!existente.email && data.clientEmail) relleno.email = data.clientEmail;
        if (Object.keys(relleno).length) {
          await supabase.from("clients").update(relleno).eq("id", clientId).eq("salon_slug", data.slug);
        }
      } else {
        const { data: nueva, error: errorNueva } = await supabase
          .from("clients")
          .insert({ salon_slug: data.slug, name: data.clientName, phone: data.clientPhone, phone_key: key, email: data.clientEmail })
          .select("id")
          .single();
        if (errorNueva) throw new Error(`syncAppointment (cliente): ${errorNueva.message}`);
        clientId = nueva.id as string;
      }
    } else if (data.clientPhone && key.length >= 6 && data.clientName) {
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
    if (!manda && clientId) {
      const { data: delDia, error: errorDia } = await supabase
        .from("appointments")
        .select("id")
        .eq("salon_slug", data.slug)
        .eq("client_id", clientId)
        .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
      if (errorDia) throw new Error(`syncAppointment (ritmo): ${errorDia.message}`);
      if ((delDia ?? []).length >= MAX_RESERVAS_POR_TELEFONO_Y_DIA) {
        return { synced: false as const, reason: ERROR_DEMASIADAS_RESERVAS };
      }
    }
    if (manda && data.importedFromTpv && !key && data.clientName) {
      const { data: previa, error: buscarError } = await supabase
        .from("clients")
        .select("id")
        .eq("salon_slug", data.slug)
        .is("phone", null)
        .eq("name", data.clientName)
        .maybeSingle();
      if (buscarError) throw new Error(`syncAppointment (cliente): ${buscarError.message}`);
      if (previa) clientId = previa.id as string;
      else {
        const { data: creada, error: crearError } = await supabase
          .from("clients")
          .insert({
            salon_slug: data.slug,
            name: data.clientName,
            phone: null,
          })
          .select("id")
          .single();
        if (crearError) throw new Error(`syncAppointment (cliente): ${crearError.message}`);
        clientId = creada.id as string;
      }
    }

    const durationMinGuardada = datosRecalculados?.durationMin ?? data.durationMin;
    const priceEurGuardado = datosRecalculados?.priceEur ?? data.priceEur;
    const fila: Record<string, unknown> = {
      salon_slug: data.slug,
      local_id: data.localId,
      client_name: data.clientName ?? null,
      service_id: data.serviceIds.join(","),
      employee_id: data.employeeId,
      start_at: data.startISO,
      duration_min: durationMinGuardada,
      price_eur: priceEurGuardado,
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
      ...(!manda ? { privacy_notice_acknowledged_at: new Date().toISOString() } : {}),
      // Lote 3: columnas propias. Las respuestas al reservar las escribe la
      // clienta; el plazo de la señal y el origen, solo el panel.
      booking_answers: manda ? (data.bookingAnswers ?? null) : (respuestasReserva ?? null),
      deposit_due_at: manda ? (data.depositDueAt ?? null) : null,
      deposit_period_hours: manda ? (data.depositPeriodHours ?? null) : null,
      origen: manda ? (data.origen ?? "sishow") : "sishow",
      // `origen` ya significa si llegó del TPV; esta marca solo decide la
      // exclusión SQL de reservas web y cae limpiamente si falta la columna.
      origen_reserva: manda ? "panel" : "web",
      // Señal: solo el panel escribe su estado. La reserva pública nunca
      // puede decir que ya la pagó (la señal automática la pone el servidor, abajo).
      deposit_status: manda ? (data.depositStatus ?? null) : null,
      deposit_method: manda ? (data.depositMethod ?? null) : null,
      deposit_received_eur: manda ? (data.depositReceivedEur ?? null) : null,
      deposit_applied_at: manda ? (data.depositAppliedAt ?? null) : null,
      deposit_applied_eur: manda ? (data.depositAppliedEur ?? null) : null,
      deposit_refunded_at: manda ? (data.depositRefundedAt ?? null) : null,
      deposit_refunded_eur: manda ? (data.depositRefundedEur ?? null) : null,
      deposit_retained_at: manda ? (data.depositRetainedAt ?? null) : null,
      deposit_note: manda ? (data.depositNote ?? null) : null,
    };
    // Reserva de fuera: la señal la calcula el servidor con la regla del
    // salón (importe, y si es automática, pedida con su plazo). Lo que mande
    // el navegador sobre la señal se ignora siempre.
    if (!manda && perfilPublico) {
      const carta = servicesForType(
        inferBusinessType(perfilPublico.tagline, perfilPublico.name),
        perfilPublico.menu,
      );
      const senal = senalDeReservaNueva(
        reglaSenal(perfilPublico),
        {
          serviceIds: data.serviceIds,
          durationMin: duracionCartaParaSenal(
            data.serviceIds,
            Object.fromEntries(carta.map((servicio) => [servicio.id, servicio])),
            durationMinGuardada,
          ),
          priceEur: priceEurGuardado,
        },
        data.startISO,
      );
      if (senal.depositStatus) fila.deposit_status = senal.depositStatus;
      if (senal.depositEur != null) fila.deposit_eur = senal.depositEur;
      if (senal.depositRequestedAt) fila.deposit_requested_at = senal.depositRequestedAt;
      if (senal.depositDueAt) fila.deposit_due_at = senal.depositDueAt;
      if (senal.depositPeriodHours) fila.deposit_period_hours = senal.depositPeriodHours;
    }
    // Solo se toca `client_id` cuando esta llamada sabe de qué cliente habla.
    // Un "confirmar" desde el panel no lleva teléfono, y machacar la columna
    // con null desengancharía la cita de su ficha.
    if (clientId) fila.client_id = clientId;

    await escribirCita(supabase, fila);

    // M5: la comprobación de hueco de arriba y esta escritura no son atómicas.
    // Hasta que exista la restricción de exclusión (supabase/pendiente.sql,
    // sección «no solapar citas»), se vuelve a mirar DESPUÉS de escribir: si
    // otra reserva simultánea se llevó el hueco antes que esta, esta se deshace.
    if (
      !manda &&
      (await perdioLaCarrera(supabase, data.slug, data.localId, data.employeeId, data.startISO, durationMinGuardada))
    ) {
      await supabase.from("appointments").delete().eq("salon_slug", data.slug).eq("local_id", data.localId);
      return { synced: false as const, reason: ERROR_HUECO_OCUPADO };
    }

    // Lote 13: llevar la cita a los calendarios externos conectados de esta
    // profesional (y al del salón entero, si lo hay). Nunca lanza (lo
    // garantiza `procesarCitaParaConexiones`); un fallo del calendario
    // externo no puede tirar la reserva. El estado final (confirmada/
    // cancelada) es el que decide crear/actualizar vs. borrar en el externo.
    const citaParaCalendario: CitaParaCalendario = {
      id: data.localId,
      clientName: (fila.client_name as string | null) ?? "Cliente",
      // Simplificación de v1: los ids de servicio, no su nombre visible (eso
      // exigiría cargar el perfil y el catálogo también en el panel; el feed
      // ICS público sí lo resuelve — ver calendario-ics.ts). Es solo lo que
      // ve la profesional en SU calendario externo.
      service: data.serviceIds.join(" + ") || "Cita",
      employeeId: data.employeeId,
      start: data.startISO,
      duration: durationMinGuardada,
      status: fila.status as string,
      note: (fila.note as string | null) ?? null,
    };
    // Se espera (no "fire and forget"): en un entorno serverless una
    // promesa sin esperar puede no llegar a terminar una vez la respuesta ya
    // ha salido. El coste es la latencia de esta llamada — la función
    // interna nunca lanza, así que el `try/catch` es solo por si acaso.
    try {
      await procesarCitaParaConexiones(
        data.slug,
        citaParaCalendario,
        fila.status === "cancelled" ? "borrar" : "upsert",
      );
    } catch (err) {
      console.error("calendario-externo (tras guardar cita):", err);
    }

    return { synced: true as const };
  });

/**
 * Escribe una ficha bajando de nivel de esquema si hace falta (ver
 * NIVELES_CLIENTE): sin la columna nueva se guarda sin ese dato antes que
 * perder el cambio entero.
 */
async function escribirFicha(
  _supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  quien: string,
  escribir: (
    fila: Record<string, unknown>,
  ) => PromiseLike<{ error: { code?: string; message: string } | null }>,
  fila: Record<string, unknown>,
): Promise<void> {
  let actual = fila;
  for (let nivel = 0; nivel <= NIVELES_CLIENTE.length; nivel++) {
    const { error } = await escribir(actual);
    if (!error) return;
    if (!faltaEsquema(error) || nivel === NIVELES_CLIENTE.length)
      throw new Error(`${quien}: ${error.message}`);
    console.warn(
      `${quien}: faltan columnas (${NIVELES_CLIENTE[nivel].join(", ")}); aplica supabase/pendiente.sql`,
    );
    actual = sinCampos(actual, NIVELES_CLIENTE[nivel]);
  }
}

/**
 * ¿Choca este hueco con otra cita de la misma profesional ya guardada? Se
 * excluye la propia cita (`localId`) para poder moverla. Lectura acotada a
 * una ventana de siete días; la protección definitiva contra dos
 * inserciones simultáneas sería una restricción en PostgreSQL.
 */
/**
 * ¿Hay otra cita que solape con esta y que se creó ANTES (o a la vez y con
 * un id menor)? Entonces esta es la que pierde la carrera.
 */
export async function perdioLaCarrera(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  salonSlug: string,
  localId: string,
  employeeId: string,
  startISO: string,
  durationMin: number,
): Promise<boolean> {
  const fin = new Date(Date.parse(startISO) + durationMin * 60_000).toISOString();
  const desde = new Date(Date.parse(startISO) - 7 * 24 * 60 * 60_000).toISOString();
  const { data: cercanas, error } = await supabase
    .from("appointments")
    .select("local_id, start_at, duration_min, status, created_at")
    .eq("salon_slug", salonSlug)
    .eq("employee_id", employeeId)
    .gte("start_at", desde)
    .lt("start_at", fin);
  if (error) throw new Error(`syncAppointment (hueco): ${error.message}`);
  const filas = (cercanas ?? []) as Array<{ local_id: string; start_at: string; duration_min: number; status: string; created_at?: string }>;
  const propia = filas.find((c) => c.local_id === localId);
  const propiaCreada = propia?.created_at ?? "";
  const anteriores = filas.filter(
    (c) => c.local_id !== localId && ((c.created_at ?? "") < propiaCreada || ((c.created_at ?? "") === propiaCreada && c.local_id < localId)),
  );
  return haySolape(startISO, durationMin, anteriores);
}

async function solapaEnServidor(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  salonSlug: string,
  localId: string,
  employeeId: string,
  startISO: string,
  durationMin: number,
): Promise<boolean> {
  const fin = new Date(Date.parse(startISO) + durationMin * 60_000).toISOString();
  const desde = new Date(Date.parse(startISO) - 7 * 24 * 60 * 60_000).toISOString();
  const { data: cercanas, error } = await supabase
    .from("appointments")
    .select("local_id, start_at, duration_min, status")
    .eq("salon_slug", salonSlug)
    .eq("employee_id", employeeId)
    .gte("start_at", desde)
    .lt("start_at", fin);
  if (error) throw new Error(`syncAppointment (hueco): ${error.message}`);
  const otras = (cercanas ?? []).filter((c) => c.local_id !== localId);
  return haySolape(startISO, durationMin, otras);
}

/**
 * Upsert de una cita bajando de nivel de esquema si hace falta (ver
 * NIVELES_CITA). Al quitar el nivel del lote 3 la nota vuelve a llevar los
 * marcadores de antes, para no perder respuestas, origen ni plazo de la
 * señal mientras el DDL no esté aplicado. Confirmar una cita delante de una
 * clienta no puede depender de una migración pendiente.
 */
async function escribirCita(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  fila: Record<string, unknown>,
): Promise<void> {
  let actual = fila;
  const exigirAcusePrivacidad = "privacy_notice_acknowledged_at" in fila;
  for (let nivel = 0; nivel <= NIVELES_CITA.length; nivel++) {
    const { error } = await supabase
      .from("appointments")
      .upsert(actual, { onConflict: "salon_slug,local_id" });
    if (!error) return;
    if (exigirAcusePrivacidad && faltaColumnaAcusePrivacidad(error)) {
      throw new Error(
        "syncAppointment: aplica supabase/pendiente.sql antes de abrir las reservas públicas.",
      );
    }
    if (!faltaEsquema(error) || nivel === NIVELES_CITA.length)
      throw new Error(`syncAppointment: ${error.message}`);
    console.warn(
      `syncAppointment: faltan columnas (${NIVELES_CITA[nivel].join(", ")}); aplica supabase/pendiente.sql`,
    );
    actual =
      NIVELES_CITA[nivel] === NIVEL_LOTE3
        ? filaSinLote3(actual)
        : sinCampos(actual, NIVELES_CITA[nivel]);
  }
}

/**
 * Parche por campos de UNA cita, desde el panel. Escribe SOLO las columnas
 * que trae `patch`: así el iPad que marca «cobrada» y el móvil que cambia
 * la hora no se pisan. Si la fila todavía no existe (la cita nació en local
 * y su alta no ha llegado), responde `sin-fila` y el navegador manda la
 * cita entera por syncAppointment.
 */
export const syncAppointmentPatch = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      localId: z.string().min(1),
      patch: z.record(z.string(), z.unknown()),
      permitirSolape: z.boolean().optional(),
      /** «deshacer»: este parche deshace un cambio (auditoría, lote 9b). */
      origen: z.enum(["deshacer"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const, reason: "sin-backend" as const };
    // Permisos por rol: las acciones que implica el parche, sobre la profesional
    // actual de la cita y, si la mueve, también sobre la nueva.
    if (quien.tipo === "miembro") {
      const antes = await profesionalActual(supabase, data.slug, data.localId);
      const nueva = typeof data.patch.employeeId === "string" ? data.patch.employeeId : null;
      exigirAcciones(quien, accionesDeParcheCita(data.patch), [antes, nueva]);
    }
    let columnas = columnasDeParche(data.patch as Partial<Appointment>);
    if (!Object.keys(columnas).length) return { synced: true as const };
    // Mover de hora, cambiar la duración o la profesional puede crear un
    // solape: se comprueba con la fila actual completada por el parche.
    if (
      !data.permitirSolape &&
      ("start_at" in columnas || "duration_min" in columnas || "employee_id" in columnas)
    ) {
      const { data: actual, error: errorActual } = await supabase
        .from("appointments")
        .select("employee_id, start_at, duration_min")
        .eq("salon_slug", data.slug)
        .eq("local_id", data.localId)
        .maybeSingle();
      if (errorActual) throw new Error(`syncAppointmentPatch: ${errorActual.message}`);
      if (!actual) return { synced: false as const, reason: "sin-fila" as const };
      const fusion = { ...actual, ...columnas } as {
        employee_id: string;
        start_at: string;
        duration_min: number;
      };
      if (
        await solapaEnServidor(
          supabase,
          data.slug,
          data.localId,
          fusion.employee_id,
          fusion.start_at,
          fusion.duration_min,
        )
      ) {
        return { synced: false as const, reason: ERROR_SOLAPE_PANEL };
      }
    }
    for (let nivel = 0; nivel <= NIVELES_CITA.length; nivel++) {
      const { data: filas, error } = await supabase
        .from("appointments")
        .update(columnas)
        .eq("salon_slug", data.slug)
        .eq("local_id", data.localId)
        .select("*");
      if (!error) {
        if (!filas?.length) return { synced: false as const, reason: "sin-fila" as const };
        // Lote 17: confirmar, mover, cambiar de profesional o cancelar desde
        // el panel también llega a los calendarios externos conectados (antes
        // solo la cita nueva, por `syncAppointment`). Nunca lanza: un fallo
        // del calendario externo no deshace el cambio ya guardado.
        if (parcheAfectaCalendario(columnas)) {
          const cita = citaParaCalendarioDeFila(filas[0] as Record<string, unknown>);
          if (cita) {
            try {
              await procesarCitaParaConexiones(data.slug, cita, accionCalendarioDe(cita));
            } catch (err) {
              console.error("calendario-externo (tras parchear cita):", err);
            }
          }
        }
        // Auditoría: cuándo se deshizo algo en esta cita. Aparte y sin romper
        // si la columna aún no existe (supabase/pendiente.sql, sección 13).
        if (data.origen === "deshacer") {
          const { error: e2 } = await supabase
            .from("appointments")
            .update({ ultimo_deshacer_en: new Date().toISOString() })
            .eq("salon_slug", data.slug)
            .eq("local_id", data.localId);
          if (e2 && !faltaEsquema(e2))
            console.warn(`syncAppointmentPatch (origen deshacer): ${e2.message}`);
        }
        // Lote 11: la señal aplicada al cobrar crea (o borra) su pago. No
        // bloquea la respuesta: la cita ya está guardada pase lo que pase aquí.
        await sincronizarPagoDeSenal(supabase, data.slug, data.localId, data.patch);
        return { synced: true as const };
      }
      if (!faltaEsquema(error) || nivel === NIVELES_CITA.length)
        throw new Error(`syncAppointmentPatch: ${error.message}`);
      // Sin esa columna en producción, el campo no se puede parchear suelto:
      // se manda la cita entera, que sí sabe volcarlo a la nota legado.
      const perdidas = NIVELES_CITA[nivel].filter((c) => c in columnas);
      if (perdidas.length) return { synced: false as const, reason: "sin-fila" as const };
      columnas = sinCampos(columnas, NIVELES_CITA[nivel]);
    }
    return { synced: false as const, reason: "sin-fila" as const };
  });

/** Borra una cita de verdad (el panel tiene "eliminar" además de "cancelar"). */
export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, localId: z.string().min(1) }))
  .handler(async ({ data }) => {
    // Borrar la agenda de otro era, literalmente, una llamada con su slug.
    const quien = await exigirAcceso(data.slug);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    if (quien.tipo === "miembro")
      exigirAcciones(
        quien,
        ["cita.cancelar"],
        [await profesionalActual(supabase, data.slug, data.localId)],
      );
    const { data: borradas, error } = await supabase
      .from("appointments")
      .delete()
      .eq("salon_slug", data.slug)
      .eq("local_id", data.localId)
      .select("*");
    if (error) throw new Error(`deleteAppointment: ${error.message}`);
    // Lote 17: la cita borrada desaparece también de los calendarios
    // externos conectados. Nunca lanza.
    for (const fila of borradas ?? []) {
      const cita = citaParaCalendarioDeFila(fila as Record<string, unknown>);
      if (!cita) continue;
      try {
        await procesarCitaParaConexiones(data.slug, cita, "borrar");
      } catch (err) {
        console.error("calendario-externo (tras borrar cita):", err);
      }
    }
    return { synced: true as const };
  });

/* ---------------------------------------------------------------------- */
/* Clientes y política de plantón                                          */
/* ---------------------------------------------------------------------- */

type FilaFichaExistente = Record<string, unknown>;

/** Lee una ficha con degradado de columnas, igual que la carga inicial. */
async function buscarFichaParaGuardar(
  consulta: (
    columnas: string,
  ) => PromiseLike<{
    data: FilaFichaExistente | null;
    error: { code?: string; message: string } | null;
  }>,
): Promise<FilaFichaExistente | null> {
  for (const columnas of selectsPorNivel(CLIENT_COLS_BASE, NIVELES_CLIENTE)) {
    const { data, error } = await consulta(columnas);
    if (!error) return data;
    if (!faltaEsquema(error)) throw new Error(`saveClient: ${error.message}`);
  }
  // Una instalación que aún no tiene tpv_code no puede localizar por código,
  // pero aún puede hacerlo por teléfono y guardar el resto de la ficha.
  return null;
}

function faltaValor(valor: unknown): boolean {
  return valor === null || valor === undefined || (typeof valor === "string" && !valor.trim());
}

/**
 * Completa una ficha existente sin sustituir ningún dato previo. Este paso en
 * servidor es importante además de la precaución de la interfaz: dos equipos
 * pueden reimportar el mismo Excel o tener una ficha antigua en caché.
 */
function completarFilaExistente(
  previa: FilaFichaExistente,
  data: {
    email?: string;
    notes?: string;
    tpvCode?: string;
    birthday?: string;
    address?: string;
    taxId?: string;
    tpvAltaDate?: string;
    tpvLastVisit?: string;
  },
): Record<string, unknown> {
  const completar = (columna: string, valor: string | undefined) =>
    valor && faltaValor(previa[columna]) ? { [columna]: valor } : {};
  return {
    ...completar("email", data.email),
    ...completar("notes", data.notes),
    ...completar("tpv_code", data.tpvCode),
    ...completar("birthday", data.birthday),
    ...completar("address", data.address),
    ...completar("tax_id", data.taxId),
    ...completar("tpv_alta", data.tpvAltaDate),
    ...completar("tpv_last_visit", data.tpvLastVisit),
  };
}

/** Alta directa de una ficha, también cuando aún no tiene ninguna cita. */
export const saveClient = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      name: z.string().min(1).max(100),
      phone: z.string().max(30),
      email: z.string().email().optional(),
      notes: z.string().max(5000).optional(),
      createdAt: z.string().datetime().optional(),
      tpvCode: z.string().max(40).optional(),
      birthday: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      address: z.string().max(300).optional(),
      taxId: z.string().max(32).optional(),
      tpvAltaDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      tpvLastVisit: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    exigirAcciones(await exigirAcceso(data.slug), ["clienta.crear"]);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    data.phone = normalizarTelefonoSiValido(data.phone);
    const key = phoneKey(data.phone);
    let previa: FilaFichaExistente | null = null;
    if (data.tpvCode) {
      previa = await buscarFichaParaGuardar((columnas) =>
        supabase
          .from("clients")
          .select(columnas)
          .eq("salon_slug", data.slug)
          .eq("tpv_code", data.tpvCode)
          .maybeSingle(),
      );
    }
    if (!previa && key) {
      previa = await buscarFichaParaGuardar((columnas) =>
        supabase
          .from("clients")
          .select(columnas)
          .eq("salon_slug", data.slug)
          .eq("phone_key", key)
          .maybeSingle(),
      );
    }
    if (!previa && !key) {
      previa = await buscarFichaParaGuardar((columnas) =>
        supabase
          .from("clients")
          .select(columnas)
          .eq("salon_slug", data.slug)
          .is("phone", null)
          .eq("name", data.name)
          .maybeSingle(),
      );
    }
    if (previa) {
      const parche = completarFilaExistente(previa, data);
      if (Object.keys(parche).length) {
        await escribirFicha(
          supabase,
          "saveClient",
          (fila) =>
            supabase
              .from("clients")
              .update(fila)
              .eq("id", previa!.id as string),
          parche,
        );
      }
      return { synced: true as const };
    }
    // Los campos opcionales solo viajan cuando existen: un alta a mano no
    // puede borrar lo que trajera TPV 123 en una ficha ya guardada.
    let fila: Record<string, unknown> = {
      salon_slug: data.slug,
      name: data.name,
      phone: data.phone || null,
      phone_key: key || null,
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.createdAt ? { created_at: data.createdAt } : {}),
      ...(data.tpvCode ? { tpv_code: data.tpvCode } : {}),
      ...(data.birthday ? { birthday: data.birthday } : {}),
      ...(data.address ? { address: data.address } : {}),
      ...(data.taxId ? { tax_id: data.taxId } : {}),
      ...(data.tpvAltaDate ? { tpv_alta: data.tpvAltaDate } : {}),
      ...(data.tpvLastVisit ? { tpv_last_visit: data.tpvLastVisit } : {}),
    };
    // Baja de nivel de esquema si producción aún no tiene alguna columna
    // (ver NIVELES_CLIENTE): la ficha se guarda sin ese dato antes que no
    // guardarse.
    for (let nivel = 0; nivel <= NIVELES_CLIENTE.length; nivel++) {
      const result = key
        ? await supabase.from("clients").upsert(fila, { onConflict: "salon_slug,phone_key" })
        : await supabase.from("clients").insert(fila);
      if (!result.error) return { synced: true as const };
      if (!faltaEsquema(result.error) || nivel === NIVELES_CLIENTE.length)
        throw new Error(`saveClient: ${result.error.message}`);
      console.warn(
        `saveClient: faltan columnas (${NIVELES_CLIENTE[nivel].join(", ")}); aplica supabase/pendiente.sql`,
      );
      fila = sinCampos(fila, NIVELES_CLIENTE[nivel]);
    }
    return { synced: true as const };
  });

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de la fila de `clients` por uuid (si el panel lo conoce) o, si no, por teléfono. */
async function filaDeFicha(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  salonSlug: string,
  clientId: string,
  phone: string,
): Promise<string | null> {
  if (ID_UUID.test(clientId)) {
    const { data, error } = await supabase.from("clients").select("id").eq("salon_slug", salonSlug).eq("id", clientId).maybeSingle();
    if (error) throw new Error(`filaDeFicha: ${error.message}`);
    if (data?.id) return data.id as string;
  }
  const key = phoneKey(phone);
  if (key.length < 6) return null;
  const { data, error } = await supabase.from("clients").select("id").eq("salon_slug", salonSlug).eq("phone_key", key).maybeSingle();
  if (error) throw new Error(`filaDeFicha: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

const textoOpcional = (max: number) => z.string().max(max).nullable().optional();

/**
 * Edita a mano nombre, teléfono, correo, cumpleaños, dirección o DNI de una
 * ficha. A diferencia de `saveClient` (que solo COMPLETA lo que falta, para que
 * una reimportación no pise nada), esto SOBRESCRIBE: `null` o vacío borra el dato.
 */
export const editarFichaClienta = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      clientId: z.string().min(1).max(200),
      /** Teléfono ANTES del cambio: con él se localiza la ficha si el id no es de servidor. */
      phone: z.string().max(30),
      campos: z.object({
        name: z.string().min(1).max(100).optional(),
        phone: z.string().max(30).optional(),
        email: textoOpcional(200),
        notes: textoOpcional(5000),
        birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        address: textoOpcional(300),
        taxId: textoOpcional(32),
      }),
    }),
  )
  .handler(async ({ data }) => {
    exigirAcciones(await exigirAcceso(data.slug), ["clienta.editar"]);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    const id = await filaDeFicha(supabase, data.slug, data.clientId, data.phone);
    if (!id) return { synced: false as const, reason: "sin-ficha" as const };
    const c = data.campos;
    const vacioANull = (v: string | null | undefined) => (v === undefined ? undefined : v && v.trim() ? v : null);
    const fila: Record<string, unknown> = {};
    if (c.name !== undefined) fila.name = c.name;
    if (c.phone !== undefined) {
      const tel = normalizarTelefonoSiValido(c.phone);
      fila.phone = tel || null;
      fila.phone_key = phoneKey(tel) || null;
    }
    for (const [campo, columna] of [["email", "email"], ["notes", "notes"], ["birthday", "birthday"], ["address", "address"], ["taxId", "tax_id"]] as const) {
      const v = vacioANull(c[campo]);
      if (v !== undefined) fila[columna] = v;
    }
    if (!Object.keys(fila).length) return { synced: true as const };
    await escribirFicha(supabase, "editarFichaClienta", (f) => supabase.from("clients").update(f).eq("id", id), fila);
    return { synced: true as const };
  });

/**
 * Borra una ficha. Pide `clienta.borrar` (gerente), salvo para deshacer un alta
 * propia: con `cambioId` de una `clienta.crear` hecha por esta misma persona
 * basta `clienta.crear`, que es lo que ya podía hacer.
 */
export const borrarFichaClienta = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, clientId: z.string().min(1).max(200), phone: z.string().max(30), cambioId: z.string().min(8).max(64).optional() }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    if (quien.tipo === "miembro") {
      let permitido = tienePermiso(quien, "clienta.borrar");
      if (!permitido && data.cambioId && tienePermiso(quien, "clienta.crear")) {
        const { data: alta } = await supabase
          .from("cambios")
          .select("tipo, id_entidad, autor")
          .eq("id", data.cambioId)
          .eq("salon_slug", data.slug)
          .maybeSingle();
        permitido = !!alta && alta.tipo === "clienta.crear" && alta.id_entidad === data.clientId && alta.autor === quien.userId;
      }
      if (!permitido) throw new PermisoDenegado("clienta.borrar");
    }
    const id = await filaDeFicha(supabase, data.slug, data.clientId, data.phone);
    if (!id) return { synced: true as const, existia: false as const };
    const { error } = await supabase.from("clients").delete().eq("id", id).eq("salon_slug", data.slug);
    if (error) throw new Error(`borrarFichaClienta: ${error.message}`);
    return { synced: true as const, existia: true as const };
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
      phone: z.string().min(1).max(30),
      name: z.string().max(100).optional(),
      eur: z.number().nonnegative().max(100_000),
      note: z.string().max(1000).optional(),
      /** Cuándo se aplicó: es desde donde cuentan los 30 días de caducidad del bloqueo. */
      penaltyAt: z.string().nullable().optional(),
      /** El dueño mantiene el bloqueo más allá de los 30 días. */
      penaltyKeep: z.boolean().optional(),
      /** ¿La deuda le impide reservar por la web? `false` = solo anotada. */
      penaltyBlock: z.boolean().optional(),
      /** Lote 3: bloqueo manual con columna propia. Si no viene, no se toca. */
      manualBlock: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Marcar a una persona como morosa y bloquearle la reserva es una decisión
    // del dueño y de nadie más.
    exigirAcciones(await exigirAcceso(data.slug), ["recargo.gestionar"]);
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
      ...(data.manualBlock !== undefined ? { manual_block: data.manualBlock } : {}),
    };

    await escribirFicha(
      supabase,
      "applyClientPenalty",
      (f) => supabase.from("clients").upsert(f, { onConflict: "salon_slug,phone_key" }),
      fila,
    );
    return { synced: true as const };
  });

/** Cierra la penalización: cobrada o perdonada. Decide siempre el dueño. */
export const clearClientPenalty = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      manualBlock: z.boolean().optional(),
      slug,
      clientId: z.string().optional(),
      phone: z.string().min(1).max(30),
      note: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    exigirAcciones(await exigirAcceso(data.slug), ["recargo.gestionar"]);
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
      ...(data.manualBlock !== undefined ? { manual_block: data.manualBlock } : {}),
    };
    await escribirFicha(
      supabase,
      "clearClientPenalty",
      (f) => supabase.from("clients").update(f).eq("id", id),
      parche,
    );
    return { synced: true as const };
  });

/** Guarda las indicaciones del salón sobre un cliente ("usa el número 8"). */
export const saveClientNotes = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, phone: z.string().min(1).max(30), notes: z.string().max(5000) }))
  .handler(async ({ data }) => {
    // Las notas son texto libre del salón sobre una persona con nombre y
    // teléfono. Escribirlas —y leerlas— es del dueño.
    const quien = await exigirAcceso(data.slug);
    exigirAcciones(quien, ["clienta.editar"]);
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const };
    const id = await localizarCliente(supabase, data.slug, data.phone);
    if (!id) return { synced: false as const };
    // Alcance «propio» (estilista): solo clientas que tienen cita con ella.
    if (quien.tipo === "miembro" && alcance(permisosDe(quien.rol), "clienta.editar") === "propio") {
      const { data: suya } = await supabase
        .from("appointments")
        .select("id")
        .eq("salon_slug", data.slug)
        .eq("client_id", id)
        .eq("employee_id", quien.employeeId ?? "")
        .limit(1);
      if (!quien.employeeId || !suya?.length) throw new PermisoDenegado("clienta.editar");
    }
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
  .inputValidator(z.object({ slug, phone: z.string().max(30) }))
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
    return { client: fila ? fichaMinimaDeBloqueo(rowToClient(fila), data.phone) : null };
  });

/**
 * Lo único que la web pública de reservas necesita para decidir si bloquea:
 * el importe y las marcas de bloqueo. Sin nombre, correo, notas, id ni el
 * texto del motivo (A3, auditoría 18-oct-2026): esta función no pide sesión.
 */
function fichaMinimaDeBloqueo(c: Client, telefonoPedido: string): Client {
  return {
    id: "",
    name: "",
    phone: telefonoPedido,
    createdAt: c.createdAt,
    manualBlock: c.manualBlock,
    penaltyEur: c.penaltyEur,
    penaltyAt: c.penaltyAt,
    penaltyKeep: c.penaltyKeep,
    penaltyBlock: c.penaltyBlock,
  };
}
