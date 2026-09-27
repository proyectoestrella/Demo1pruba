import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Service } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { precioDeCarta } from "@/lib/web-publica";

type ServicioCarta = Service & { priceText?: string };

/**
 * Carta de servicios de la web del salón (lote 18.5): una pestaña por
 * categoría, precio literal del salón («desde…») y su descripción corta si la
 * hay. Cada servicio abre la reserva con él ya elegido. Con una sola
 * categoría no hay pestañas.
 */
export function CartaServicios({
  salonSlug,
  servicios,
  categorias,
  descripciones,
  conSenal,
}: {
  salonSlug: string;
  servicios: ServicioCarta[];
  categorias: string[];
  descripciones?: Record<string, string>;
  conSenal: (s: Service) => boolean;
}) {
  const grupos = categorias
    .map((cat) => ({ cat, items: servicios.filter((s) => (s.category ?? "Otros") === cat) }))
    .filter((g) => g.items.length > 0);
  const [activa, setActiva] = useState(grupos[0]?.cat ?? "");
  if (!grupos.length) return null;

  const lista = (items: ServicioCarta[]) => (
    <ul className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
      {items.map((s, i) => {
        const descripcion = descripciones?.[s.id]?.trim() || s.description?.trim();
        return (
          <li key={s.id} className="entrada-lista" style={{ animationDelay: `${Math.min(i, 9) * 30}ms` }}>
            <Link
              to="/s/$salonSlug/book"
              params={{ salonSlug }}
              search={(prev) => ({ ...prev, service: s.id })}
              className="elevar group flex h-full min-h-[76px] flex-col rounded-2xl border border-lino bg-card px-4 py-3.5 hover:border-lino-fuerte sm:px-5"
            >
              <span className="flex items-start justify-between gap-4">
                <span className="min-w-0 font-semibold leading-snug text-foreground">{s.name}</span>
                <span className="max-w-[48%] shrink-0 text-right font-extrabold leading-snug tabular-nums text-foreground">
                  {precioDeCarta(s)}
                </span>
              </span>
              {descripcion ? (
                <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{descripcion}</span>
              ) : null}
              <span className="mt-auto flex items-center justify-between gap-3 pt-2.5 text-[13px]">
                <span className="inline-flex items-center gap-1.5 text-cafe-suave tabular-nums">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {s.durationMin} min
                  {conSenal(s) ? " · con señal" : ""}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                  Reservar
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (grupos.length === 1) return lista(grupos[0].items);

  return (
    <Tabs value={activa} onValueChange={setActiva}>
      {/* Móvil: una fila que se desliza. Desde 768 px las pestañas bajan de
          línea: con siete categorías, la última quedaba oculta sin pista. */}
      <TabsList
        aria-label="Categorías de la carta"
        className="flex w-full gap-2 rounded-none border-0 bg-transparent p-0 md:flex-wrap md:overflow-visible"
      >
        {grupos.map((g) => (
          <TabsTrigger
            key={g.cat}
            value={g.cat}
            className={cn(
              "group h-11 gap-2 border border-lino bg-card px-4 text-sm text-cafe-medio hover:border-lino-fuerte hover:text-foreground",
              "data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
            )}
          >
            {g.cat}
            <span className="rounded-full bg-black/5 px-1.5 text-[11px] tabular-nums group-data-[state=active]:bg-white/20">
              {g.items.length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {grupos.map((g) => (
        <TabsContent key={g.cat} value={g.cat} className="mt-5 focus-visible:ring-offset-0">
          {lista(g.items)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
