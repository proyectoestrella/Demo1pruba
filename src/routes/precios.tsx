import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retirada de la vista pública el 27-09-2026 (redirección temporal, 307):
 * de momento no se publican precios en una web de proyecto. El código
 * original sigue en `src/web-archivada/` (ver su README para reactivarlo).
 */
export const Route = createFileRoute("/precios")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
