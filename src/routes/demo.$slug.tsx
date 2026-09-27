import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, TriangleAlert } from "lucide-react";

import { demoPorSlug } from "@/lib/demos";
import { cargarDemoRegistrada } from "@/lib/demos/aplicar";

/**
 * `/demo/<slug>`: el enlace corto de una presentación (lote P).
 *
 * Carga la demo registrada con ese slug (lib/demos) DESDE CERO —perfil, carta,
 * equipo, citas, clientas, cobros, lista de espera; lo de cualquier demo
 * anterior de este navegador se sustituye— y entra al panel como la gerente.
 * Es lo mismo que abrir el `?d=` de la web y pulsar «Acceso», en un solo paso
 * y con la carta completa: `/demo/peluchic`.
 */
export const Route = createFileRoute("/demo/$slug")({
  head: ({ params }) => {
    const nombre = demoPorSlug(params.slug)?.name;
    return {
      meta: [
        { title: nombre ? `${nombre} · Panel de demostración` : "Demo no encontrada" },
        // Un enlace de trabajo: que no lo indexe nadie.
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: EntrarEnDemo,
});

function EntrarEnDemo() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const perfil = demoPorSlug(slug);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    try {
      cargarDemoRegistrada(slug, { panel: true });
      void navigate({ to: "/app", replace: true });
    } catch (err) {
      console.error("No se pudo preparar la demo:", err);
      setError(true);
    }
  }, [slug, perfil, navigate]);

  if (!perfil || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <TriangleAlert className="size-10 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">
          {error ? "No hemos podido preparar la demo" : "Esta demo no existe"}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error
            ? "Recarga la página para intentarlo otra vez."
            : "Revisa el enlace: puede que el nombre del salón esté mal escrito."}
        </p>
        <Link to="/" className="text-sm font-bold text-cafe-medio underline-offset-2 hover:underline">
          Ir a siShow
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground"
      aria-busy="true"
    >
      <Loader2 className="size-6 animate-spin text-cafe-medio" strokeWidth={1.6} aria-hidden="true" />
      <p className="text-[15px] font-bold">Preparando el panel de {perfil.name}…</p>
    </div>
  );
}
