import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retirada de la vista pública el 27-09-2026 (redirección temporal, 307):
 * usaba la demo de PeluChic para enseñarse, y PeluChic todavía no es
 * cliente ni ha dado permiso para eso. El código original sigue en
 * `src/web-archivada/` (ver su README para reactivarlo). El correo de
 * contacto ahora está en la portada (`/`).
 */
export const Route = createFileRoute("/contacto")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
