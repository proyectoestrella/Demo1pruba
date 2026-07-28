import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseServerClient } from "../supabase.server";

// Called from the public booking flow when a (potential) new customer
// confirms a reservation. Upserts by phone so repeat customers don't
// create duplicate rows, then logs the appointment against that client.
export const registerBookingClient = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      salonSlug: z.string().min(1),
      name: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      serviceId: z.string().min(1),
      employeeId: z.string().min(1),
      startISO: z.string().min(1),
      durationMin: z.number().positive(),
      priceEur: z.number().nonnegative(),
      note: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      // Supabase not configured yet — swallow so the demo keeps working
      // off the local mock store until real env vars are set.
      return { synced: false as const };
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .upsert(
        { salon_slug: data.salonSlug, name: data.name, phone: data.phone, email: data.email },
        { onConflict: "salon_slug,phone" },
      )
      .select("id")
      .single();

    if (clientError) throw new Error(`Supabase client upsert failed: ${clientError.message}`);

    const { error: appointmentError } = await supabase.from("appointments").insert({
      salon_slug: data.salonSlug,
      client_id: client.id,
      service_id: data.serviceId,
      employee_id: data.employeeId,
      start_at: data.startISO,
      duration_min: data.durationMin,
      price_eur: data.priceEur,
      status: "confirmed",
      note: data.note,
    });

    if (appointmentError) throw new Error(`Supabase appointment insert failed: ${appointmentError.message}`);

    return { synced: true as const, clientId: client.id as string };
  });
