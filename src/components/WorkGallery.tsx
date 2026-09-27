import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Expand, Pause, Play, X } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";
import { CONTENEDOR_SALON } from "@/lib/web-publica";
import galleryRecorte from "@/assets/gallery-recorte.jpg";
import galleryDegradado from "@/assets/gallery-degradado.jpg";
import gallerySalon from "@/assets/gallery-salon.jpg";
import { inferBusinessType } from "@/lib/business-type";
import { useImagenesRotas } from "@/lib/imagen-rota";
import { copiasDelCarrusel, envolver, fotoConAnchos, type FotoGaleria } from "@/lib/galeria-salon";
import { useFocoDeVuelta } from "@/lib/foco-de-vuelta";

/**
 * Fotos de relleno, para cuando el local no tiene suficientes suyas.
 *
 * gallery-salon.jpg es "Hair salon - Arlington, MA" de Wikimedia Commons, CC0:
 * dominio público, sin atribución obligatoria. Sustituye a la anterior, que
 * llevaba la marca de agua de Unsplash+ repetida por toda la imagen y llegó a
 * verse en producción.
 */
const RELLENO_SALON = fotoConAnchos(gallerySalon, "Interior de un salón de peluquería");
const RELLENO_BARBERIA = [
  fotoConAnchos(galleryRecorte, "Repasado de barba con tijera"),
  fotoConAnchos(galleryDegradado, "Degradado con máquina y peine"),
];

/** El relleno arranca por lo que se parece más a este negocio. */
function relleno(tipo: string | undefined) {
  const esBarberia = inferBusinessType(tipo) === "barberia";
  return esBarberia ? [...RELLENO_BARBERIA, RELLENO_SALON] : [RELLENO_SALON, ...RELLENO_BARBERIA];
}

/** Con menos de esto la galería se ve a medio hacer: se completa con relleno. */
const MINIMO = 3;

/** Velocidad del desplazamiento automático: calma, una foto cada ~10 s. */
const PX_POR_SEGUNDO = 32;
/** Tras tocar, arrastrar o usar las flechas, el carrusel espera esto antes de seguir. */
const ESPERA_TRAS_TOCAR_MS = 3000;

/** «Menos movimiento» del sistema, vivo: si cambia con la página abierta, se respeta al momento. */
function useMenosMovimiento() {
  const [menos, setMenos] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const leer = () => setMenos(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);
  return menos;
}

type Pausas = {
  usuario: boolean;
  raton: boolean;
  foco: boolean;
  /** Hasta cuándo (performance.now) espera tras un toque, arrastre o flecha. */
  hasta: number;
  ampliada: boolean;
  fuera: boolean;
};

const BOTON_CONTROL =
  "grid size-11 place-items-center rounded-full border border-lino-fuerte bg-card text-foreground transition-colors hover:bg-ws-arena";

/**
 * Galería de trabajos (lote 18.3): carrusel con desplazamiento horizontal
 * automático e infinito, a sangre.
 *
 * - Se para al pasar el ratón, al tocar, con el foco dentro, con una foto
 *   ampliada, fuera de pantalla y con el botón de pausa (WCAG 2.2.2).
 * - Se arrastra con el ratón y se desliza con el dedo; flechas de una foto.
 * - Pulsar una foto la amplía, con anterior/siguiente, teclado y deslizamiento.
 * - Con «menos movimiento», una rejilla estática.
 *
 * El bucle infinito repite la serie (`copiasDelCarrusel`) y mantiene la vista
 * en la segunda copia; solo esa es accesible, las demás van `aria-hidden` y
 * fuera del orden de tabulación. Las fotos se piden al acercarse la sección (600 px antes): así no
 * le quitan ancho de banda a la portada (LCP, lote 17).
 */
export function WorkGallery({ fotos = [], tipo }: { fotos?: FotoGaleria[]; tipo?: string }) {
  const { rotas, marcar, vigilar } = useImagenesRotas();
  const propias = fotos.filter((f) => !rotas.has(f.src));
  const faltan = Math.max(0, MINIMO - propias.length);
  const images = [...propias, ...relleno(tipo).slice(0, faltan)];
  const menosMovimiento = useMenosMovimiento();

  const [abierta, setAbierta] = useState<number | null>(null);
  const foco = useFocoDeVuelta(abierta !== null);

  const seccion = useRef<HTMLElement | null>(null);
  const [cerca, setCerca] = useState(false);
  useEffect(() => {
    const nodo = seccion.current;
    if (!nodo || typeof IntersectionObserver === "undefined") {
      setCerca(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setCerca(true);
          obs.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(nodo);
    return () => obs.disconnect();
  }, []);

  const pausas = useRef<Pausas>({ usuario: false, raton: false, foco: false, hasta: 0, ampliada: false, fuera: true });
  const [pausadoUsuario, setPausadoUsuario] = useState(false);
  pausas.current.usuario = pausadoUsuario;
  pausas.current.ampliada = abierta !== null;
  const mover = useRef<(dir: 1 | -1) => void>(() => {});

  const n = images.length;
  const irA = (i: number) => setAbierta(((i % n) + n) % n);
  const actual = abierta !== null ? images[abierta] : null;

  return (
    <section id="galeria" ref={seccion} aria-labelledby="galeria-titulo" className="bg-ws-salvia-clara">
      <div className={cn(CONTENEDOR_SALON, "pt-14 md:pt-20")}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
          <Reveal>
            <p className="ws-etiqueta">Nuestro trabajo</p>
            <h2 id="galeria-titulo" className="mt-2 ws-titulo text-[28px] md:text-[38px]">
              Galería
            </h2>
            <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">Pulsa una foto para verla en grande.</p>
          </Reveal>
          {!menosMovimiento && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPausadoUsuario((p) => !p)}
                aria-pressed={pausadoUsuario}
                aria-label={pausadoUsuario ? "Reanudar el carrusel" : "Pausar el carrusel"}
                className={BOTON_CONTROL}
              >
                {pausadoUsuario ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </button>
              <button type="button" onClick={() => mover.current(-1)} aria-label="Foto anterior" className={BOTON_CONTROL}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => mover.current(1)}
                aria-label="Foto siguiente"
                className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-ws-chocolate"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {menosMovimiento ? (
        <div className={cn(CONTENEDOR_SALON, "pb-14 md:pb-20")}>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
            {images.map((img, i) => (
              <li key={img.src}>
                <Miniatura
                  foto={img}
                  cargar={cerca}
                  onAbrir={() => setAbierta(i)}
                  onError={() => marcar(img.src)}
                  vigilar={vigilar(img.src)}
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                  className="aspect-[4/5] w-full"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Carrusel
          fotos={images}
          cargar={cerca}
          pausas={pausas}
          mover={mover}
          onAbrir={setAbierta}
          marcar={marcar}
          vigilar={vigilar}
        />
      )}

      <DialogPrimitive.Root open={abierta !== null} onOpenChange={(open) => !open && setAbierta(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ws-tinta/90 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onCloseAutoFocus={foco.onCloseAutoFocus}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") irA((abierta ?? 0) + 1);
              if (e.key === "ArrowLeft") irA((abierta ?? 0) - 1);
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setAbierta(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-16 outline-none sm:px-20"
          >
            {actual && (
              <>
                <DialogPrimitive.Title className="sr-only">{actual.alt}</DialogPrimitive.Title>
                <FotoAmpliada
                  key={actual.src}
                  foto={actual}
                  posicion={`${(abierta ?? 0) + 1} de ${n}`}
                  onDeslizar={(dir) => irA((abierta ?? 0) + dir)}
                />
                {n > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => irA((abierta ?? 0) - 1)}
                      aria-label="Foto anterior"
                      className="absolute left-2 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-ws-crema/90 text-ws-tinta shadow-sm transition-colors hover:bg-white sm:left-5"
                    >
                      <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => irA((abierta ?? 0) + 1)}
                      aria-label="Foto siguiente"
                      className="absolute right-2 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-ws-crema/90 text-ws-tinta shadow-sm transition-colors hover:bg-white sm:right-5"
                    >
                      <ChevronRight className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </>
                )}
                <DialogPrimitive.Close
                  aria-label="Cerrar"
                  className="absolute right-3 top-3 grid size-12 place-items-center rounded-full bg-ws-crema/90 text-ws-tinta shadow-sm transition-colors hover:bg-white sm:right-5 sm:top-5"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </DialogPrimitive.Close>
              </>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  );
}

/** La foto ampliada, con su texto y posición; se desliza con el dedo. */
function FotoAmpliada({
  foto,
  posicion,
  onDeslizar,
}: {
  foto: FotoGaleria;
  posicion: string;
  onDeslizar: (dir: 1 | -1) => void;
}) {
  const inicio = useRef<number | null>(null);
  return (
    <figure
      className="flex max-h-full w-full max-w-5xl flex-col items-center"
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") inicio.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (inicio.current === null) return;
        const dx = e.clientX - inicio.current;
        inicio.current = null;
        if (Math.abs(dx) > 50) onDeslizar(dx < 0 ? 1 : -1);
      }}
    >
      <img
        src={foto.grande}
        srcSet={foto.srcSet}
        sizes="(min-width: 1024px) 1024px, 100vw"
        alt={foto.alt}
        className="max-h-[calc(100dvh-10rem)] w-auto max-w-full rounded-[16px] object-contain"
        draggable={false}
      />
      <figcaption className="mt-3 flex max-w-full items-baseline gap-3 text-center text-sm text-ws-crema">
        <span className="min-w-0">{foto.alt}</span>
        <span className="shrink-0 tabular-nums text-[#D9C6B3]">{posicion}</span>
      </figcaption>
    </figure>
  );
}

/** Una foto del carrusel o de la rejilla: botón que la amplía. */
function Miniatura({
  foto,
  cargar,
  onAbrir,
  onError,
  vigilar,
  sizes,
  className,
  oculta,
}: {
  foto: FotoGaleria;
  cargar: boolean;
  onAbrir: () => void;
  onError: () => void;
  vigilar: (img: HTMLImageElement | null) => void;
  sizes: string;
  className?: string;
  oculta?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={oculta ? undefined : `Ampliar: ${foto.alt}`}
      tabIndex={oculta ? -1 : undefined}
      className={cn("group relative block overflow-hidden rounded-[20px] border border-white/60 bg-ws-arena", className)}
    >
      {cargar && (
        <img
          src={foto.src}
          srcSet={foto.srcSet}
          sizes={sizes}
          ref={vigilar}
          onError={onError}
          alt={oculta ? "" : foto.alt}
          width={600}
          height={750}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      )}
      <span className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-ws-tinta/70 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <Expand className="h-4 w-4" aria-hidden="true" />
      </span>
    </button>
  );
}

function Carrusel({
  fotos,
  cargar,
  pausas,
  mover,
  onAbrir,
  marcar,
  vigilar,
}: {
  fotos: FotoGaleria[];
  cargar: boolean;
  pausas: MutableRefObject<Pausas>;
  mover: MutableRefObject<(dir: 1 | -1) => void>;
  onAbrir: (i: number) => void;
  marcar: (src: string) => void;
  vigilar: (src: string) => (img: HTMLImageElement | null) => void;
}) {
  const pista = useRef<HTMLDivElement | null>(null);
  const [copias, setCopias] = useState(3);
  // Estado del bucle, fuera de React: se toca en cada fotograma.
  const e = useRef({
    pos: 0,
    serie: 0,
    puesto: -1,
    anim: null as null | { desde: number; hasta: number; t0: number },
    arrastre: null as null | { x: number; scroll: number; movido: boolean; id: number },
    sinClic: false,
  });

  /** Pinta la posición lógica: siempre dentro de la segunda copia. */
  const aplicar = useCallback(() => {
    const el = pista.current;
    const s = e.current;
    if (!el || s.serie <= 0) return;
    s.pos = envolver(s.pos, s.serie);
    el.scrollLeft = s.serie + s.pos;
    s.puesto = el.scrollLeft;
  }, []);

  // Ancho de una serie y número de copias; se rehace al cambiar el tamaño.
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const medir = () => {
      const a = el.querySelector<HTMLElement>('[data-copia="0"]');
      const b = el.querySelector<HTMLElement>('[data-copia="1"]');
      if (!a || !b) return;
      const serie = b.offsetLeft - a.offsetLeft;
      if (serie <= 0) return;
      e.current.serie = serie;
      setCopias(copiasDelCarrusel(serie, el.clientWidth));
      aplicar();
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    const primera = el.querySelector('[data-copia="0"]');
    if (primera) ro.observe(primera);
    return () => ro.disconnect();
  }, [aplicar, fotos.length]);

  // Flechas: una foto adelante o atrás, 480 ms con curva de salida.
  useEffect(() => {
    mover.current = (dir) => {
      const el = pista.current;
      const item = el?.querySelector<HTMLElement>('[data-copia="1"] > li');
      if (!el || !item?.parentElement) return;
      const hueco = parseFloat(getComputedStyle(item.parentElement).columnGap) || 12;
      const s = e.current;
      const base = s.anim ? s.anim.hasta : s.pos;
      s.anim = { desde: s.pos, hasta: base + dir * (item.offsetWidth + hueco), t0: performance.now() };
      pausas.current.hasta = performance.now() + ESPERA_TRAS_TOCAR_MS;
    };
  }, [mover, pausas]);

  // El bucle: solo corre con la sección en pantalla y la pestaña visible.
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    let raf = 0;
    let previo = 0;
    const paso = (t: number) => {
      const s = e.current;
      const p = pausas.current;
      const dt = previo ? Math.min(64, t - previo) / 1000 : 0;
      previo = t;
      if (s.anim) {
        const k = Math.min(1, (t - s.anim.t0) / 480);
        const suave = 1 - Math.pow(1 - k, 3);
        s.pos = s.anim.desde + (s.anim.hasta - s.anim.desde) * suave;
        if (k >= 1) s.anim = null;
        aplicar();
      } else if (!s.arrastre && !p.usuario && !p.raton && !p.foco && !p.ampliada && t > p.hasta) {
        s.pos += PX_POR_SEGUNDO * dt;
        aplicar();
      }
      raf = requestAnimationFrame(paso);
    };
    const arrancar = () => {
      if (raf || pausas.current.fuera || document.hidden) return;
      previo = 0;
      raf = requestAnimationFrame(paso);
    };
    const parar = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entrada]) => {
            pausas.current.fuera = !entrada.isIntersecting;
            if (entrada.isIntersecting) arrancar();
            else parar();
          })
        : null;
    if (io) io.observe(el);
    else {
      pausas.current.fuera = false;
      arrancar();
    }
    const visibilidad = () => (document.hidden ? parar() : arrancar());
    document.addEventListener("visibilitychange", visibilidad);
    return () => {
      parar();
      io?.disconnect();
      document.removeEventListener("visibilitychange", visibilidad);
    };
  }, [pausas, aplicar]);

  // Scroll que no hemos puesto nosotros (dedo, rueda, trackpad, foco con
  // teclado): se adopta como nueva posición y se espera antes de seguir.
  const onScroll = () => {
    const el = pista.current;
    const s = e.current;
    if (!el || s.serie <= 0) return;
    if (Math.abs(el.scrollLeft - s.puesto) <= 2) return;
    s.anim = null;
    s.pos = envolver(el.scrollLeft - s.serie, s.serie);
    pausas.current.hasta = Math.max(pausas.current.hasta, performance.now() + ESPERA_TRAS_TOCAR_MS);
    // Solo se recoloca en la segunda copia si se ha ido lejos: recolocar en
    // cada evento cortaría la inercia del dedo.
    if (!s.arrastre && (el.scrollLeft < s.serie * 0.5 || el.scrollLeft > s.serie * (copias - 1.5))) aplicar();
    else s.puesto = el.scrollLeft;
  };

  // Arrastre con ratón (el dedo usa el scroll nativo). La captura del
  // puntero se pide al moverse, no al pulsar: si no, el clic no llegaría a
  // la foto y no se podría ampliar.
  const onPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (ev.pointerType !== "mouse") {
      pausas.current.hasta = Number.POSITIVE_INFINITY;
      return;
    }
    if (ev.button !== 0 || !pista.current) return;
    e.current.arrastre = { x: ev.clientX, scroll: pista.current.scrollLeft, movido: false, id: ev.pointerId };
  };
  const onPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const a = e.current.arrastre;
    const el = pista.current;
    if (!a || !el) return;
    const dx = ev.clientX - a.x;
    if (!a.movido && Math.abs(dx) > 5) {
      a.movido = true;
      el.setPointerCapture(a.id);
    }
    if (a.movido) el.scrollLeft = a.scroll - dx;
  };
  const soltar = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (ev.pointerType !== "mouse") {
      pausas.current.hasta = performance.now() + ESPERA_TRAS_TOCAR_MS;
      return;
    }
    const a = e.current.arrastre;
    e.current.arrastre = null;
    if (!a?.movido) return;
    e.current.sinClic = true;
    if (pista.current?.hasPointerCapture(a.id)) pista.current.releasePointerCapture(a.id);
    pausas.current.hasta = performance.now() + ESPERA_TRAS_TOCAR_MS;
    aplicar();
  };

  return (
    <div className="pb-14 md:pb-20">
      <div
        ref={pista}
        role="region"
        aria-roledescription="carrusel"
        aria-label="Fotos de la galería"
        onScroll={onScroll}
        onPointerEnter={(ev) => {
          if (ev.pointerType === "mouse") pausas.current.raton = true;
        }}
        onPointerLeave={(ev) => {
          if (ev.pointerType === "mouse") pausas.current.raton = false;
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onFocus={() => {
          pausas.current.foco = true;
        }}
        onBlur={(ev) => {
          if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) pausas.current.foco = false;
        }}
        onClickCapture={(ev) => {
          if (e.current.sinClic) {
            e.current.sinClic = false;
            ev.preventDefault();
            ev.stopPropagation();
          }
        }}
        className="sin-scrollbar flex cursor-grab select-none overflow-x-auto overscroll-x-contain active:cursor-grabbing"
      >
        {Array.from({ length: copias }, (_, c) => (
          <ul
            key={c}
            data-copia={c}
            // Solo la segunda copia existe para el lector de pantalla y el
            // tabulador; las demás se ven y se pueden pulsar (sin `inert`,
            // que las dejaría sordas al clic justo cuando están a la vista).
            aria-hidden={c === 1 ? undefined : true}
            className="flex shrink-0 gap-3 pr-3 md:gap-4 md:pr-4"
          >
            {fotos.map((foto, i) => (
              <li key={`${c}-${foto.src}`} className="shrink-0">
                <Miniatura
                  foto={foto}
                  cargar={cargar}
                  oculta={c !== 1}
                  onAbrir={() => onAbrir(i)}
                  onError={() => marcar(foto.src)}
                  vigilar={vigilar(foto.src)}
                  sizes="(min-width: 1467px) 352px, (min-width: 867px) 24vw, 208px"
                  className="aspect-[4/5] h-[clamp(260px,30vw,440px)]"
                />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
