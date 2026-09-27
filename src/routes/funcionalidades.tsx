import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retirada de la vista pública el 27-09-2026 (redirección temporal, 307):
 * Tomás no quiere de momento una web de proyecto que enseñe todas las
 * funcionalidades de la app. El código original sigue en
 * `src/web-archivada/` (ver su README para reactivarlo).
 */
export const Route = createFileRoute("/funcionalidades")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
