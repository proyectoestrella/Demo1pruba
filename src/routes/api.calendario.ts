import { soloMetodos } from "@/lib/api/metodos";
import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServerClient } from "@/lib/supabase.server";
import { generarCalendarioIcs, type CitaCalendario } from "@/lib/calendario-ics";
import { firmaCalendarioProfesional } from "@/lib/calendario-firma.server";
import { timingSafeEqual } from "node:crypto";
import { servicesForType } from "@/lib/mock/salon";
import { inferBusinessType } from "@/lib/business-type";
import type { SalonProfile } from "@/lib/mock/types";

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{43}$/;
const EMPLEADO_VALIDO = /^[A-Za-z0-9_-]{1,80}$/;
const VENTANA_FEED_DIAS = 180;

function error(status: number) {
  return new Response("Calendario no disponible", { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/calendario")({
  server: { handlers: soloMetodos({ GET: async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const token = params.get("token") ?? "";
    const profesional = params.get("profesional") ?? undefined;
    const firma = params.get("k") ?? "";
    const slugPersonal = params.get("s") ?? "";
    const personal = !!firma;
    if (personal) {
      if (!TOKEN_VALIDO.test(firma) || !profesional || !EMPLEADO_VALIDO.test(profesional) || !/^[a-z0-9-]{1,120}$/.test(slugPersonal)) return error(404);
    } else if (!TOKEN_VALIDO.test(token) || (profesional && !EMPLEADO_VALIDO.test(profesional))) return error(404);
    const db = getSupabaseServerClient();
    if (!db) return error(503);
    let slug: string;
    if (personal) {
      // Enlace personal: firma del id de la profesional con el token del salón.
      const { data: sus, error: e } = await db.from("calendar_subscriptions").select("token").eq("salon_slug", slugPersonal).maybeSingle();
      if (e) return error(503);
      if (!sus?.token) return error(404);
      const esperada = Buffer.from(await firmaCalendarioProfesional(sus.token as string, slugPersonal, profesional!));
      const recibida = Buffer.from(firma);
      if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return error(404);
      slug = slugPersonal;
    } else {
      const { data: suscripcion, error: tokenError } = await db.from("calendar_subscriptions").select("salon_slug").eq("token", token).maybeSingle();
      if (tokenError) return error(503);
      if (!suscripcion) return error(404);
      slug = suscripcion.salon_slug as string;
    }
    const { data: salon, error: salonError } = await db.from("salons").select("profile").eq("slug", slug).maybeSingle();
    if (salonError || !salon) return error(503);
    const perfil = salon.profile as SalonProfile;
    const nombres = Object.fromEntries(servicesForType(inferBusinessType(perfil.tagline, perfil.name), perfil.menu).map((x) => [x.id, x.name]));
    const servicioDe = (ids: string | null) => {
      const t = (ids ?? "").split(",").filter(Boolean).map((id) => nombres[id]).filter(Boolean).join(" + ");
      return t ? `Cita · ${t}` : "Cita reservada";
    };
    const desde = new Date();
    const hasta = new Date(desde.getTime() + VENTANA_FEED_DIAS * 24 * 60 * 60_000);
    type Fila = { id: string; local_id: string | null; client_name: string | null; service_id: string | null; employee_id: string; start_at: string; duration_min: number; status: string };
    const citas: CitaCalendario[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data: filas, error: citasError } = await db.from("appointments")
        .select("id, local_id, client_name, service_id, employee_id, start_at, duration_min, status")
        .eq("salon_slug", slug).eq("status", "confirmed")
        .gte("start_at", desde.toISOString()).lte("start_at", hasta.toISOString())
        .order("start_at", { ascending: true }).range(offset, offset + 499);
      if (citasError) return error(503);
      const lote = (filas ?? []) as Fila[];
      for (const fila of lote) citas.push({
        // En el enlace personal se ve el servicio (es su trabajo); nunca la clienta.
        id: fila.local_id ?? fila.id, clientName: "", service: personal ? servicioDe(fila.service_id) : "Cita reservada",
        employeeId: fila.employee_id, start: fila.start_at, duration: fila.duration_min, status: fila.status,
      });
      if (lote.length < 500) break;
    }
    return new Response(generarCalendarioIcs(citas, perfil.name || "siShow", profesional), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "inline; filename=\"sishow.ics\"", "Cache-Control": "private, no-store" },
    });
  } }) },
});
