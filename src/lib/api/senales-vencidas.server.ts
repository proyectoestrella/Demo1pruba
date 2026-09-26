/**
 * Liberación automática de señales vencidas, SIN el panel abierto (lote 12).
 *
 * Hasta ahora, `liberarSenalesVencidas` (store.ts) solo corría cuando alguien
 * tenía el panel abierto y se refrescaba: con el panel cerrado, una cita
 * vencida seguía ocupando el hueco. Esto es la misma lógica pura de
 * `senal.ts` (`revisarVencimiento`, `resolverCancelacion`), pero recorriendo
 * TODOS los salones reales de una vez — la llama el cron de Vercel
 * (`/api/senales-vencidas`, ver `vercel.json`), y también sirve para
 * lanzarla a mano.
 *
 * Nada de correo, nada de WhatsApp: solo libera el hueco (cancela la cita) y
 * anula la señal, exactamente lo mismo que hace la dueña a mano al "Liberar".
 * Idempotente: una cita que ya no está `pending`/`confirmed`, o cuya señal ya
 * no está `pedida`, no vuelve a tocarse.
 */
import { reglaSenal, resolverCancelacion, revisarVencimiento, type ReglaSenal } from "../senal";
import type { AppointmentStatus, EstadoSenalGuardado, SalonProfile } from "../mock/types";
import { getSupabaseServerClient } from "../supabase.server";

interface FilaCita {
  id: string;
  salon_slug: string;
  start_at: string;
  status: string;
  deposit_status: string | null;
  deposit_eur: number | string | null;
  deposit_due_at: string | null;
  deposit_requested_at: string | null;
  deposit_period_hours: number | null;
  deposit_received_at: string | null;
}

export interface ResumenLiberacion {
  revisadas: number;
  liberadas: number;
  salones: number;
  motivo?: "sin-backend";
}

/**
 * Sube todas las señales `pedida` con la cita abierta, aplica la misma
 * lógica que el panel (`revisarVencimiento` + `resolverCancelacion`) y
 * persiste solo las que de verdad hay que liberar.
 */
export async function liberarSenalesVencidasDeTodos(ahora: Date = new Date()): Promise<ResumenLiberacion> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { revisadas: 0, liberadas: 0, salones: 0, motivo: "sin-backend" };

  const { data: citas, error } = await supabase
    .from("appointments")
    .select("id, salon_slug, start_at, status, deposit_status, deposit_eur, deposit_due_at, deposit_requested_at, deposit_period_hours, deposit_received_at")
    .eq("deposit_status", "pedida")
    .in("status", ["pending", "confirmed"]);
  if (error) throw new Error(`senales-vencidas (citas): ${error.message}`);
  const filas = (citas ?? []) as FilaCita[];
  if (!filas.length) return { revisadas: 0, liberadas: 0, salones: 0 };

  const slugs = [...new Set(filas.map((f) => f.salon_slug))];
  const { data: salones, error: errorSalones } = await supabase.from("salons").select("slug, profile").in("slug", slugs);
  if (errorSalones) throw new Error(`senales-vencidas (salones): ${errorSalones.message}`);
  const reglas = new Map<string, ReglaSenal>(
    ((salones ?? []) as Array<{ slug: string; profile: SalonProfile }>).map((s) => [s.slug, reglaSenal(s.profile)]),
  );

  let liberadas = 0;
  for (const f of filas) {
    const regla = reglas.get(f.salon_slug);
    if (!regla) continue; // sin fila en `salons`: no debería ocurrir (esto solo lee salones reales), por si acaso
    const c = {
      start: f.start_at,
      status: f.status as AppointmentStatus,
      priceEur: 0,
      depositStatus: (f.deposit_status ?? undefined) as EstadoSenalGuardado | undefined,
      depositEur: f.deposit_eur !== null ? Number(f.deposit_eur) : undefined,
      depositRequestedAt: f.deposit_requested_at ?? undefined,
      depositDueAt: f.deposit_due_at ?? undefined,
      depositPeriodHours: (f.deposit_period_hours ?? undefined) as 1 | 2 | 3 | 4 | 12 | 24 | undefined,
      depositReceivedAt: f.deposit_received_at ?? undefined,
    };
    const { liberar } = revisarVencimiento(c, regla, ahora);
    if (!liberar) continue;
    const r = resolverCancelacion(c, regla, "salon", ahora);
    if (!r.ok) continue;
    const { error: errUpdate } = await supabase
      .from("appointments")
      .update({ status: "cancelled", deposit_status: r.patch.depositStatus ?? "anulada" })
      .eq("id", f.id);
    if (!errUpdate) liberadas++;
  }
  return { revisadas: filas.length, liberadas, salones: slugs.length };
}
