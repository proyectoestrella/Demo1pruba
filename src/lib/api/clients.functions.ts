import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { acceso } from "./autorizacion.server";
import { conSesion } from "./sesion.middleware";
import { getSupabaseServerClient } from "../supabase.server";

/**
 * Lead de una DEMO de venta: alguien reservó en la web de una de las ~54
 * demos del rutero. Hasta el 25/09/2026 esto escribía en `clients` y
 * `appointments` como cita confirmada y sin ninguna guarda: cualquiera
 * podía crear una cita confirmada en un salón REAL saltándose el estado
 * pendiente, el bloqueo, el solape y el horario de `syncAppointment`, y los
 * leads de demo se mezclaban con los datos de verdad.
 *
 * Ahora:
 *   - Si el slug es un salón de pago, aquí no se escribe nada: la reserva
 *     real entra SOLO por `syncAppointment`, con todas sus comprobaciones.
 *   - Si es una demo, el lead va a su propia tabla `leads_demo`, que ninguna
 *     pantalla del panel ni el cron de recordatorios leen.
 *   - Si la tabla todavía no existe, no revienta la demo: se avisa por consola
 *     y la reserva sigue confirmándose en local, como siempre.
 */
export const registerBookingClient = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      salonSlug: z.string().min(1).max(120),
      name: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      serviceIds: z.array(z.string().min(1)).min(1),
      employeeId: z.string().min(1),
      startISO: z.string().min(1),
      durationMin: z.number().positive(),
      priceEur: z.number().nonnegative(),
      note: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { synced: false as const, reason: "sin-backend" as const };

    const quien = await acceso(data.salonSlug);
    if (quien.tipo !== "demo") {
      // Un salón real no registra leads: su reserva pública es syncAppointment.
      return { synced: false as const, reason: "salon-real" as const };
    }

    const { error } = await supabase.from("leads_demo").insert({
      salon_slug: data.salonSlug,
      name: data.name,
      phone: data.phone,
      email: data.email ?? null,
      service_id: data.serviceIds.join(","),
      employee_id: data.employeeId,
      start_at: data.startISO,
      duration_min: data.durationMin,
      price_eur: data.priceEur,
      note: data.note ?? null,
    });
    if (error) {
      console.warn(`registerBookingClient: no se pudo guardar el lead de demo (${error.message}); aplica supabase/pendiente.sql`);
      return { synced: false as const, reason: "falta-esquema" as const };
    }
    return { synced: true as const };
  });
