import { createFileRoute } from "@tanstack/react-router";
import { usePanelV2 } from "@/lib/use-panel-v2";
import { AgendaColumns } from "@/components/AgendaColumns";
import { CalendarioArena } from "@/components/CalendarioArena";

export const Route = createFileRoute("/app/calendar")({
  // Desde el asistente: ?dia=AAAA-MM-DD, ?cita=<id> o ?nueva=1.
  validateSearch: (s: Record<string, unknown>): { dia?: string; cita?: string; nueva?: boolean } => ({
    dia: typeof s.dia === "string" ? s.dia : undefined,
    cita: typeof s.cita === "string" ? s.cita : undefined,
    nueva: s.nueva === 1 || s.nueva === "1" || s.nueva === true ? true : undefined,
  }),
  component: CalendarRoute,
});

/**
 * Calendario del panel. Por defecto, el calendario «Arena» (DESIGN.md) con
 * sus cuatro vistas; con `?v=2` se conserva la agenda por columnas del v2.
 */
function CalendarRoute() {
  const panelV2 = usePanelV2();
  const inicio = Route.useSearch();
  if (panelV2) return <AgendaColumns />;
  // La clave remonta el calendario si el asistente pide otro día u otra cita estando ya aquí.
  return <CalendarioArena key={`${inicio.dia ?? ""}|${inicio.cita ?? ""}|${inicio.nueva ?? ""}`} inicio={inicio} />;
}
