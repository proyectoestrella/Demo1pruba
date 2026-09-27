import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import type { Service } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { precioDeCarta } from "@/lib/web-publica";

type ServicioCarta = Service & { priceText?: string };

/**
 * Carta de servicios de la web del salón (lote 18.5): una pestaña por
 * categoría, precio literal del salón («desde…») y su descripción corta si la
 * hay. Cada servicio abre la reserva con él ya elegido. Con una sola
 * categoría no hay pestanas.
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
  const [activa, setActiva] = useState(0);
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
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

  // Pestañas propias (patrón WAI-ARIA, flechas, Inicio y Fin) con UN panel
  // que siempre existe: las de Radix desmontan los paneles ocultos y su
  // `aria-controls` apuntaba a elementos que no estaban (Lighthouse,
  // aria-valid-attr-value).
  const actual = Math.min(activa, grupos.length - 1);
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = grupos.length;
    const destino =
      e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (destino === null) return;
    e.preventDefault();
    setActiva(destino);
    pestanas.current[destino]?.focus();
  };

  return (
    <div>
      {/* Móvil: una fila que se desliza. Desde 768 px las pestanas bajan de
          línea: con siete categorías, la última quedaba oculta sin pista. */}
      <div role="tablist" aria-label="Categorías de la carta" className="sin-scrollbar flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
        {grupos.map((g, i) => {
          const sel = i === actual;
          return (
            <button
              key={g.cat}
              ref={(el) => {
                pestanas.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-pestana-${i}`}
              aria-selected={sel}
              aria-controls={`${id}-panel`}
              tabIndex={sel ? 0 : -1}
              onClick={() => setActiva(i)}
              onKeyDown={(e) => alTeclear(e, i)}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                sel
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-lino bg-card text-cafe-medio hover:border-lino-fuerte hover:text-foreground",
              )}
            >
              {g.cat}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", sel ? "bg-white/20" : "bg-black/5")}>
                {g.items.length}
              </span>
            </button>
          );
        })}
      </div>
      <div
        key={actual}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-pestana-${actual}`}
        tabIndex={0}
        className="mt-5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {lista(grupos[actual].items)}
      </div>
    </div>
  );
}
