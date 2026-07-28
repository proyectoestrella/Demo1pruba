import { defineHandler } from "h3";
import { getSupabaseServerClient } from "../../../../src/lib/supabase.server";
import { serviceMap, employeeMap, salon } from "../../../../src/lib/mock/salon";

// Single-tenant demo: the route can't use a `[salonSlug]` folder because
// Vite/Rollup's chunk-naming step chokes on literal "[" "]" in server route
// paths ("is not a valid placeholder in the output.chunkFileNames pattern").
// Hardcoded to the seeded salon's slug — revisit if/when this becomes truly
// multi-tenant.
const salonSlug = salon.slug;

// Read-only calendar feed: Google Calendar, Apple Calendar and Outlook can
// all "subscribe" to this URL (paste it once, they poll it periodically) —
// no OAuth, no per-app integration, works the same everywhere. Two-way sync
// (blocking availability from the barber's own calendar) is a separate,
// heavier integration — this only covers "see the salon's bookings".
function icsEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function fmtDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export default defineHandler(async () => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trimly//Booking Calendar//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Reservas — ${icsEscape(salonSlug ?? "Trimly")}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  const supabase = getSupabaseServerClient();
  if (supabase && salonSlug) {
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, service_id, employee_id, start_at, duration_min, note, status, clients(name)")
      .eq("salon_slug", salonSlug)
      .neq("status", "cancelled");

    if (!error && appointments) {
      const now = fmtDate(new Date());
      for (const a of appointments) {
        const start = new Date(a.start_at);
        const end = new Date(start.getTime() + a.duration_min * 60_000);
        const service = serviceMap[a.service_id];
        const employee = employeeMap[a.employee_id];
        const clientName = (a.clients as unknown as { name?: string } | null)?.name ?? "Cliente";
        const description = `Con ${employee?.name ?? a.employee_id}.${a.note ? ` ${a.note}` : ""}`;
        lines.push(
          "BEGIN:VEVENT",
          `UID:${a.id}@trimly`,
          `DTSTAMP:${now}`,
          `DTSTART:${fmtDate(start)}`,
          `DTEND:${fmtDate(end)}`,
          `SUMMARY:${icsEscape(`${service?.name ?? a.service_id} — ${clientName}`)}`,
          `DESCRIPTION:${icsEscape(description)}`,
          "END:VEVENT",
        );
      }
    }
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="calendar.ics"',
      "cache-control": "no-store",
    },
  });
});
