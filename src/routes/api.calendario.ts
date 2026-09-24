import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServerClient } from "@/lib/supabase.server";
import { generarCalendarioIcs, type CitaCalendario } from "@/lib/calendario-ics";
import { servicesForType } from "@/lib/mock/salon";
import { inferBusinessType } from "@/lib/business-type";
import type { SalonProfile } from "@/lib/mock/types";

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{43}$/;
const EMPLEADO_VALIDO = /^[A-Za-z0-9_-]{1,80}$/;

function error(status: number) {
  return new Response("Calendario no disponible", { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/calendario")({
  server: { handlers: { GET: async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const token = params.get("token") ?? "";
    const profesional = params.get("profesional") ?? undefined;
    if (!TOKEN_VALIDO.test(token) || (profesional && !EMPLEADO_VALIDO.test(profesional))) return error(404);
    const db = getSupabaseServerClient();
    if (!db) return error(503);
    const { data: suscripcion, error: tokenError } = await db.from("calendar_subscriptions").select("salon_slug").eq("token", token).maybeSingle();
    if (tokenError) return error(503);
    if (!suscripcion) return error(404);
    const slug = suscripcion.salon_slug as string;
    const { data: salon, error: salonError } = await db.from("salons").select("profile").eq("slug", slug).maybeSingle();
    if (salonError || !salon) return error(503);
    const perfil = salon.profile as SalonProfile;
    const servicios = Object.fromEntries(servicesForType(inferBusinessType(perfil.tagline, perfil.name), perfil.menu).map((s) => [s.id, s.name]));
    type Fila = { id: string; local_id: string | null; client_name: string | null; service_id: string; employee_id: string; start_at: string; duration_min: number; status: string };
    const citas: CitaCalendario[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data: filas, error: citasError } = await db.from("appointments")
        .select("id, local_id, client_name, service_id, employee_id, start_at, duration_min, status")
        .eq("salon_slug", slug).eq("status", "confirmed")
        .order("start_at", { ascending: true }).range(offset, offset + 499);
      if (citasError) return error(503);
      const lote = (filas ?? []) as Fila[];
      for (const fila of lote) citas.push({
        id: fila.local_id ?? fila.id, clientName: fila.client_name ?? "Cliente",
        service: fila.service_id.split(",").map((id) => servicios[id] ?? "Servicio").join(" + "),
        employeeId: fila.employee_id, start: fila.start_at, duration: fila.duration_min, status: fila.status,
      });
      if (lote.length < 500) break;
    }
    return new Response(generarCalendarioIcs(citas, perfil.name || "siShow", profesional), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "inline; filename=\"sishow.ics\"", "Cache-Control": "private, no-store" },
    });
  } } },
});
