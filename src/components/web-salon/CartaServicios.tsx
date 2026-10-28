import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Clock } from "lucide-react";
import type { Service } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { precioDeCarta } from "@/lib/web-publica";
import {
  agruparCartaDosNiveles,
  enlaceConsulta,
  esSoloConsulta,
  tituloDeBloque,
  type BloqueCarta,
} from "@/lib/carta-publica";

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
  contacto,
}: {
  salonSlug: string;
  servicios: ServicioCarta[];
  categorias: string[];
  descripciones?: Record<string, string>;
  conSenal: (s: Service) => boolean;
  /** Datos del salón para «Consultar» en los servicios solo consulta. */
  contacto: Parameters<typeof enlaceConsulta>[0];
}) {
  // Dos niveles: grupo → subcategoría → servicios. Sin grupo, un bloque por
  // categoría, exactamente como antes. `categorias` fija el orden de los
  // bloques sin grupo; los servicios ya vienen en el orden de la carta.
  void categorias;
  const grupos = agruparCartaDosNiveles(servicios).map((b: BloqueCarta) => ({
    cat: tituloDeBloque(b),
    bloque: b,
    items: b.subcategorias.flatMap((x) => x.servicios) as ServicioCarta[],
  }));
  const [activa, setActiva] = useState(0);
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  if (!grupos.length) return null;

  const lista = (items: ServicioCarta[]) => (
    <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((s) => {
        const descripcion = descripciones?.[s.id]?.trim() || s.description?.trim();
        if (esSoloConsulta(s)) {
          const href = enlaceConsulta(contacto, s);
          return (
            <li key={s.id}>
              <div
                data-testid="carta-solo-consulta"
                className="tarjeta-secundaria flex h-full min-h-[76px] flex-col border border-dashed border-lino-fuerte bg-card px-4 py-3.5 sm:px-5"
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="min-w-0 font-semibold leading-snug text-foreground">{s.name}</span>
                  <span className="max-w-[48%] shrink-0 text-right font-extrabold leading-snug tabular-nums text-foreground">
                    {precioDeCarta(s)}
                  </span>
                </span>
                {descripcion ? (
                  <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {descripcion}
                  </span>
                ) : null}
                <span className="mt-auto flex items-center justify-between gap-3 pt-2.5 text-[13px]">
                  <span className="text-cafe-suave">Solo con consulta previa</span>
                  {href ? (
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1 rounded-full border border-primary px-3 font-semibold text-primary hover:bg-primary/5"
                    >
                      Consultar
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="font-semibold text-cafe-suave">Consultar</span>
                  )}
                </span>
              </div>
            </li>
          );
        }
        return (
          <li key={s.id}>
            <Link
              to="/s/$salonSlug/book"
              params={{ salonSlug }}
              search={(prev) => ({ ...prev, service: s.id })}
              className="elevar tarjeta-secundaria group flex h-full min-h-[76px] flex-col border border-lino bg-card px-4 py-3.5 hover:border-lino-fuerte sm:px-5"
            >
              <span className="flex items-start justify-between gap-4">
                <span className="min-w-0 font-semibold leading-snug text-foreground">{s.name}</span>
                <span className="max-w-[48%] shrink-0 text-right font-extrabold leading-snug tabular-nums text-foreground">
                  {precioDeCarta(s)}
                </span>
              </span>
              {descripcion ? (
                <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {descripcion}
                </span>
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

  // Un bloque con grupo muestra sus subcategorías con título; sin grupo, la lista a secas.
  const contenido = (g: (typeof grupos)[number]) =>
    g.bloque.grupo ? (
      <div className="space-y-6">
        {g.bloque.subcategorias.map((sub) => (
          <div key={sub.categoria}>
            <h3 className="mb-2.5 text-sm font-bold uppercase tracking-[0.06em] text-cafe-suave">
              {sub.categoria}
            </h3>
            {lista(sub.servicios as ServicioCarta[])}
          </div>
        ))}
      </div>
    ) : (
      lista(g.items)
    );

  if (grupos.length === 1) return contenido(grupos[0]);

  // Pestañas propias (patrón WAI-ARIA, flechas, Inicio y Fin) con UN panel
  // que siempre existe: las de Radix desmontan los paneles ocultos y su
  // `aria-controls` apuntaba a elementos que no estaban (Lighthouse,
  // aria-valid-attr-value).
  const actual = Math.min(activa, grupos.length - 1);
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = grupos.length;
    const destino =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (destino === null) return;
    e.preventDefault();
    setActiva(destino);
    pestanas.current[destino]?.focus();
  };

  return (
    <div>
      {/* Móvil y tablet (22-oct): un único selector a todo el ancho con la
          categoría actual y su número de servicios. La fila de pestañas se
          cortaba («Tratami…») y, apilada, era un tocho de botones. */}
      <div className="lg:hidden">
        <label id={`${id}-etiqueta`} htmlFor={`${id}-selector`} className="ws-etiqueta mb-2 block text-center">
          Categoría
        </label>
        <div className="relative mx-auto max-w-xl">
          <select
            id={`${id}-selector`}
            aria-labelledby={`${id}-etiqueta`}
            value={actual}
            onChange={(e) => setActiva(Number(e.target.value))}
            aria-controls={`${id}-panel`}
            className="h-12 w-full cursor-pointer appearance-none truncate rounded-full border border-lino-fuerte bg-card pl-5 pr-12 text-[15px] font-bold text-foreground shadow-[var(--sombra-tarjeta-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {grupos.map((g, i) => (
              <option key={g.cat} value={i}>
                {g.cat} ({g.items.length})
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground"
            aria-hidden="true"
          />
        </div>
      </div>
      {/* Ordenador: pestañas que bajan de línea, centradas. */}
      <div
        role="tablist"
        aria-label="Categorías de la carta"
        className="hidden flex-wrap justify-center gap-2 lg:flex"
      >
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
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  sel ? "bg-white/20" : "bg-black/5",
                )}
              >
                {g.items.length}
              </span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-pestana-${actual}`}
        tabIndex={0}
        className="mt-5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {contenido(grupos[actual])}
      </div>
    </div>
  );
}
