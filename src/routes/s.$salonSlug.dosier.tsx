import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dosier } from "@/components/dosier/Dosier";
import { buildDosierTexts } from "@/lib/dosier-content";
import { DEMO_PARAM, blankDemoProfile, decodeDemoProfile } from "@/lib/demo-profile";
import { inferBusinessType } from "@/lib/business-type";
import { getDosierQr } from "@/lib/api/dosier-qr.functions";

/**
 * Dosier comercial A4 de 4 páginas, listo para imprimir desde el móvil o el
 * iPad («Compartir → Imprimir» o «Guardar como PDF»).
 *
 * Ruta hermana de `book`/`confirmation`, no hija visual de la web pública:
 * `s.$salonSlug.tsx` (el layout) detecta este path y no pinta su cabecera ni
 * su pie — ver el comentario junto a `onDosier` en ese archivo. Aquí solo
 * vive la barra de pantalla (oculta al imprimir) y las 4 páginas del dosier.
 *
 * El QR se genera en el servidor (ver `lib/api/dosier-qr.functions.ts`) para
 * que salga ya en el HTML servido, sin depender de que el navegador ejecute
 * JS antes de imprimir.
 */

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const Route = createFileRoute("/s/$salonSlug/dosier")({
  validateSearch: (search: Record<string, unknown>): { d?: string } => ({
    d: typeof search[DEMO_PARAM] === "string" ? (search[DEMO_PARAM] as string) : undefined,
  }),
  loaderDeps: ({ search }) => ({ d: search.d }),
  loader: async ({ params, deps }) => {
    const path = deps.d ? `/s/${params.salonSlug}?${DEMO_PARAM}=${deps.d}` : `/s/${params.salonSlug}`;
    const qr = await getDosierQr({ data: { path } });
    return { qr };
  },
  head: ({ match }) => {
    const raw = (match.search as Record<string, unknown> | undefined)?.[DEMO_PARAM];
    const fromUrl = decodeDemoProfile(typeof raw === "string" ? raw : undefined);
    const name = fromUrl?.name?.trim() || titleFromSlug(String(match.params.salonSlug ?? ""));
    return {
      meta: [{ title: `${name} — Dosier siShow` }],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Karla:wght@400;700&family=DM+Mono:wght@400&display=swap",
        },
      ],
    };
  },
  component: DosierPage,
});

function DosierPage() {
  const { salonSlug } = Route.useParams();
  const search = Route.useSearch();
  const { qr } = Route.useLoaderData();

  // El perfil sale SOLO del enlace (`?d=`), igual que el generador Python de
  // referencia: el dosier nunca hereda el salón guardado en este navegador,
  // que en SSR ni siquiera existe.
  const fromUrl = decodeDemoProfile(search.d);
  const profile = { ...blankDemoProfile(), ...(fromUrl ?? {}) };
  const nombre = profile.name.trim() || titleFromSlug(salonSlug);
  const tipo = inferBusinessType(profile.tagline, profile.name);
  const texts = useMemo(() => buildDosierTexts(nombre, tipo), [nombre, tipo]);

  return (
    <div>
      <div className="dosier-toolbar sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-5 py-3 backdrop-blur">
        <p className="min-w-0 truncate font-display text-base">{nombre} — Dosier</p>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/s/$salonSlug" params={{ salonSlug }} search={search.d ? { d: search.d } : {}}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la demo
            </Link>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Guardar PDF
          </Button>
        </div>
      </div>
      <Dosier texts={texts} qrDataUri={qr.dataUri} />
    </div>
  );
}
