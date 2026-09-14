import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RUTERO } from "@/lib/rutero";
import { decodeDemoProfile, DEMO_PARAM } from "@/lib/demo-profile";
import heroBarberia from "@/assets/hero-salon.jpg";
import heroSalon from "@/assets/gallery-salon.jpg";

/**
 * Lanzador de las demos del rutero.
 *
 * Es la pantalla con la que arranca Trimly cuando se instala en el iPad desde
 * "Añadir a pantalla de inicio": así la demo se enseña a pantalla completa, sin
 * la barra del navegador ni el dominio de pruebas a la vista. Desde aquí se
 * abre cada local; el botón flotante del raíz devuelve a esta lista.
 */
export const Route = createFileRoute("/rutero")({
  head: () => ({
    meta: [{ title: "Rutero · Trimly" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Rutero,
});

const DIAS: Record<string, string> = { M: "Martes 15", X: "Miércoles 16", J: "Jueves 17" };

function portada(path: string, tipo: string) {
  const query = path.split("?")[1] ?? "";
  const raw = new URLSearchParams(query).get(DEMO_PARAM);
  const hero = decodeDemoProfile(raw)?.heroImage;
  if (hero) return hero;
  return /barber|caballero/i.test(tipo) ? heroBarberia : heroSalon;
}

function Rutero() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const paradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? RUTERO.filter((p) => p.nombre.toLowerCase().includes(t)) : RUTERO;
  }, [q]);

  const porDia = useMemo(() => {
    const grupos = new Map<string, typeof RUTERO>();
    for (const p of paradas) {
      const dia = DIAS[p.bloque[0]] ?? "Otras";
      grupos.set(dia, [...(grupos.get(dia) ?? []), p]);
    }
    return [...grupos.entries()];
  }, [paradas]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">Rutero de ventas</p>
            <h1 className="mt-1 font-display text-3xl md:text-4xl">Demos por parada</h1>
          </div>
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="buscar-parada"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar local…"
              className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-4 text-sm outline-none focus:border-primary"
            />
          </label>
        </header>

        {porDia.map(([dia, lista]) => (
          <section key={dia} className="mt-8">
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">{dia}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((p) => (
                <a
                  key={p.parada}
                  href={p.path}
                  onClick={(e) => {
                    // Navegar sin recargar: una recarga completa saca al iPad de
                    // la pantalla completa.
                    e.preventDefault();
                    void router.navigate({ href: p.path });
                  }}
                  className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-2.5 transition-colors hover:border-primary/50"
                >
                  <img
                    src={portada(p.path, p.tipo)}
                    alt=""
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {p.parada} · {p.bloque} · {p.hora}
                    </p>
                    <p className="truncate font-medium leading-tight">{p.nombre}</p>
                    <p className="text-[11px] uppercase tracking-wider text-primary/80">{p.tipo}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
