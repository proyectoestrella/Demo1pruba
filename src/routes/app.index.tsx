import { createFileRoute } from "@tanstack/react-router";
import { HoyArena } from "@/components/HoyArena";

export const Route = createFileRoute("/app/")({
  component: Home,
});

/** La pantalla de entrada del panel: «Hoy» con la identidad «Arena» (DESIGN.md). */
function Home() {
  return <HoyArena />;
}
