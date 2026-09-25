import { createFileRoute } from "@tanstack/react-router";
import { usePanelV2 } from "@/lib/use-panel-v2";
import { HoyV2 } from "@/components/HoyV2";
import { HoyArena } from "@/components/HoyArena";

export const Route = createFileRoute("/app/")({
  component: Home,
});

/**
 * La pantalla de entrada del panel. Por defecto, «Hoy» con la identidad
 * «Arena» (DESIGN.md); con `?v=2` se conserva la versión v2.
 */
function Home() {
  const panelV2 = usePanelV2();
  if (panelV2) return <HoyV2 />;
  return <HoyArena />;
}
