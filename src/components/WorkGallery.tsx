import { useEffect, useRef, useState } from "react";
import { Expand } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";
import { CONTENEDOR_WEB, SECCION_WEB } from "@/lib/web-publica";
import galleryRecorte from "@/assets/gallery-recorte.jpg";
import galleryDegradado from "@/assets/gallery-degradado.jpg";
import gallerySalon from "@/assets/gallery-salon.jpg";
import { inferBusinessType } from "@/lib/business-type";
import { useImagenesRotas } from "@/lib/imagen-rota";
import { conAncho } from "@/lib/demo-photos";

/**
 * Fotos de relleno, para cuando el local no tiene suficientes suyas.
 * La rejilla es de 3 columnas, así que 3 es el mínimo para que no quede coja.
 *
 * gallery-salon.jpg es "Hair salon - Arlington, MA" de Wikimedia Commons, CC0:
 * dominio público, sin atribución obligatoria. Sustituye a la anterior, que
 * llevaba la marca de agua de Unsplash+ repetida por toda la imagen y llegó a
 * verse en producción.
 */
const RELLENO_SALON = { src: gallerySalon, alt: "Interior de un salón de peluquería" };
const RELLENO_BARBERIA = [
  { src: galleryRecorte, alt: "Repasado de barba con tijera" },
  { src: galleryDegradado, alt: "Degradado con máquina y peine" },
];

/** El relleno arranca por lo que se parece más a este negocio. */
function relleno(tipo: string | undefined) {
  const esBarberia = inferBusinessType(tipo) === "barberia";
  return esBarberia ? [...RELLENO_BARBERIA, RELLENO_SALON] : [RELLENO_SALON, ...RELLENO_BARBERIA];
}

/** Con menos de esto la fila se ve incompleta y la página parece a medio hacer. */
const MINIMO_EN_REJILLA = 3;

/**
 * Lote 17: la rejilla nunca queda coja. Con 6 fotos en 4 columnas la segunda
 * fila dejaba dos huecos; ahora se enseñan en múltiplos de 3 (3 columnas
 * desde md) y, en móvil (2 columnas), si el número es impar la primera ocupa
 * el ancho entero. Tamaño fijo y carga diferida: sin saltos de maquetación.
 */
function paraRejilla<T>(items: T[]): T[] {
  if (items.length <= MINIMO_EN_REJILLA) return items;
  return items.slice(0, items.length - (items.length % 3));
}

export function WorkGallery({ photos = [], tipo }: { photos?: string[]; tipo?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { rotas, marcar, vigilar } = useImagenesRotas();
  const propias = photos.filter((src) => !rotas.has(src)).map((src, i) => ({ src, alt: `Foto ${i + 1} de ${tipo ? "la " + tipo.toLowerCase() : "el local"}` }));
  const faltan = Math.max(0, MINIMO_EN_REJILLA - propias.length);
  const images = paraRejilla([...propias, ...relleno(tipo).slice(0, faltan)]);
  const openImage = openIndex !== null ? images[openIndex] : null;
  const impar = images.length % 2 === 1;
  // Las fotos de la galería (de Google, 200–650 KB cada una) solo se piden
  // cuando la sección está a 600 px de verse. Con \`loading="lazy"\` a secas,
  // Chrome las descargaba al hidratar y le quitaban ancho de banda a la foto
  // de portada: el LCP móvil se iba a 6,7 s (lote 17). Mientras tanto, cada
  // hueco ya tiene su tamaño final: no hay salto de maquetación.
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

  return (
    <section id="galeria" ref={seccion} className="border-t border-lino bg-card">
      <div className={cn(CONTENEDOR_WEB, SECCION_WEB)}>
        <Reveal className="mb-8 md:mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cafe-suave">Nuestro trabajo</p>
          <h2 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight md:text-[32px]">Galería</h2>
        </Reveal>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {images.map((img, i) => (
            <li key={img.src} className={cn(impar && i === 0 && "col-span-2 md:col-span-1")}>
              <Reveal delay={(i % 3) * 60}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  aria-label={`Ampliar: ${img.alt}`}
                  className={cn(
                    "group relative block w-full overflow-hidden rounded-[20px] border border-lino bg-beige",
                    impar && i === 0 ? "aspect-[2/1] md:aspect-square" : "aspect-square",
                  )}
                >
                  {cerca && (
                  <img
                    src={conAncho(img.src, 600) ?? img.src}
                    ref={vigilar(img.src)}
                    onError={() => marcar(img.src)}
                    alt={img.alt}
                    width={600}
                    height={600}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  )}
                  <span className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-cafe/70 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Expand className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-w-3xl overflow-hidden border-lino p-0 sm:rounded-[20px]">
          <DialogTitle className="sr-only">{openImage?.alt ?? "Foto de la galería"}</DialogTitle>
          {openImage && (
            <img
              src={openImage.src}
              alt={openImage.alt}
              className="max-h-[80vh] w-full bg-background object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
