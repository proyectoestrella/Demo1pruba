import { createFileRoute } from "@tanstack/react-router";
import { usePanelV2 } from "@/lib/use-panel-v2";
import { AgendaColumns } from "@/components/AgendaColumns";
import { CalendarioArena } from "@/components/CalendarioArena";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarRoute,
});

/**
 * Calendario del panel. Por defecto, el calendario «Arena» (DESIGN.md) con
 * sus cuatro vistas; con `?v=2` se conserva la agenda por columnas del v2.
 */
function CalendarRoute() {
  const panelV2 = usePanelV2();
  if (panelV2) return <AgendaColumns />;
  return <CalendarioArena />;
}
