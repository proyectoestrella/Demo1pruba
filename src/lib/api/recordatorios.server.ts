/**
 * Recordatorio automático por email el día anterior (plan Reservas, octubre).
 *
 * Lo llama la ruta `/api/recordatorios` desde el cron de Vercel una vez al
 * día por la tarde. Recorre TODOS los salones reales: las citas confirmadas
 * de mañana cuya clienta dejó correo y que aún no tienen `reminder_sent_at`.
 * Al enviar, marca `reminder_sent_at`, que es la misma marca que pone el
 * salón cuando manda el recordatorio por WhatsApp a mano: ni se duplica el
 * aviso ni la hoja del día lo sigue contando como pendiente.
 *
 * Qué NO hace: recordar solicitudes pendientes (no confirmadas) ni enviar
 * nada cuando falta el proveedor de correo; en ese caso devuelve el motivo.
 */
import { inferBusinessType } from "../business-type";
import { parseDepositNote } from "../deposit-deadline";
import { proveedorDeCorreo, type ProveedorCorreo } from "../email.server";
import { servicesForType } from "../mock/salon";
import type { SalonProfile } from "../mock/types";
import { citasParaRecordarManana, emailRecordatorio } from "../recordatorio-email";
import { getSupabaseServerClient } from "../supabase.server";

interface FilaCita {
  id: string;
  salon_slug: string;
  client_name: string | null;
  service_id: string;
  start_at: string;
  status: string;
  note: string | null;
  reminder_sent_at: string | null;
  deposit_requested_at: string | null;
  deposit_received_at: string | null;
  deposit_eur: number | string | null;
  clients: { name: string | null; email: string | null } | null;
}

export interface ResumenRecordatorios {
  proveedor: string | null;
  candidatas: number;
  enviados: number;
  fallidos: Array<{ id: string; error: string }>;
  motivo?: "sin-backend" | "sin-proveedor";
}

export async function enviarRecordatoriosDeManana(
  ahora = new Date(),
  proveedor: ProveedorCorreo | null = proveedorDeCorreo(),
): Promise<ResumenRecordatorios> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { proveedor: null, candidatas: 0, enviados: 0, fallidos: [], motivo: "sin-backend" };

  // Ventana holgada en UTC; el filtro fino («mañana» en la hora del salón)
  // lo hace `citasParaRecordarManana`.
  const desde = new Date(ahora.getTime()).toISOString();
  const hasta = new Date(ahora.getTime() + 48 * 60 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, salon_slug, client_name, service_id, start_at, status, note, reminder_sent_at, deposit_requested_at, deposit_received_at, deposit_eur, clients(name, email)",
    )
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("start_at", desde)
    .lt("start_at", hasta);
  if (error) throw new Error(`recordatorios: ${error.message}`);

  const filas = ((data ?? []) as unknown as FilaCita[]).map((f) => ({ ...f, email: f.clients?.email ?? null }));
  const candidatas = citasParaRecordarManana(filas, ahora);
  if (!proveedor) {
    return { proveedor: null, candidatas: candidatas.length, enviados: 0, fallidos: [], motivo: "sin-proveedor" };
  }
  if (!candidatas.length) return { proveedor: proveedor.nombre, candidatas: 0, enviados: 0, fallidos: [] };

  const slugs = [...new Set(candidatas.map((c) => c.salon_slug))];
  const { data: salones, error: errorSalones } = await supabase
    .from("salons")
    .select("slug, profile")
    .in("slug", slugs);
  if (errorSalones) throw new Error(`recordatorios (salones): ${errorSalones.message}`);
  const perfiles = new Map<string, SalonProfile>(
    ((salones ?? []) as Array<{ slug: string; profile: SalonProfile }>).map((s) => [s.slug, s.profile]),
  );

  const resumen: ResumenRecordatorios = { proveedor: proveedor.nombre, candidatas: candidatas.length, enviados: 0, fallidos: [] };
  for (const cita of candidatas) {
    const perfil = perfiles.get(cita.salon_slug);
    // Sin fila en `salons` no es un salón real: las demos no mandan correos.
    if (!perfil) continue;
    const servicios = Object.fromEntries(
      servicesForType(inferBusinessType(perfil.tagline, perfil.name), perfil.menu).map((s) => [s.id, s.name]),
    );
    const senalPendiente =
      cita.deposit_requested_at && !cita.deposit_received_at && perfil.depositBizumPhone
        ? {
            importeEur: Number(cita.deposit_eur ?? perfil.depositAmountEur ?? 10),
            bizumPhone: perfil.depositBizumPhone,
            deadlineISO: parseDepositNote(cita.note).dueAt,
          }
        : undefined;
    const correo = emailRecordatorio({
      clientName: cita.clients?.name ?? cita.client_name ?? "",
      salonName: perfil.name,
      startISO: cita.start_at,
      servicio: cita.service_id.split(",").map((id) => servicios[id] ?? "tu servicio").join(" + "),
      direccion: perfil.address,
      senalPendiente,
    });
    try {
      await proveedor.enviar({ para: cita.email!, ...correo });
    } catch (err) {
      resumen.fallidos.push({ id: cita.id, error: err instanceof Error ? err.message : String(err) });
      continue;
    }
    const { error: errorMarca } = await supabase
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", cita.id);
    if (errorMarca) {
      // El correo ya salió: se deja constancia para no perderlo de vista,
      // pero no se reintenta el envío.
      resumen.fallidos.push({ id: cita.id, error: `enviado, sin marcar: ${errorMarca.message}` });
      continue;
    }
    resumen.enviados += 1;
  }
  return resumen;
}
