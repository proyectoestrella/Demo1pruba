import { useState } from "react";
import { Expand } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/Reveal";
import { Lens } from "@/components/magicui/lens";
import galleryRecorte from "@/assets/gallery-recorte.jpg";
import galleryDegradado from "@/assets/gallery-degradado.jpg";
import gallerySalon from "@/assets/gallery-salon.jpg";
import { inferBusinessType } from "@/lib/business-type";

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

export function WorkGallery({ photos = [], tipo }: { photos?: string[]; tipo?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Se enseñan las fotos del propio local. Cuando tiene una o dos —hay locales
  // del rutero con una sola foto en Google, y alguno con ninguna— se completa
  // la fila con las de ejemplo: una rejilla con un hueco se lee como error, y
  // lo que se está enseñando es cómo quedaría su web, no un inventario de su
  // ficha. Las suyas van primero, que son las que le van a llamar la atención.
  const propias = photos.map((src, i) => ({ src, alt: `Foto ${i + 1} del local` }));
  const faltan = Math.max(0, MINIMO_EN_REJILLA - propias.length);
  const images = [...propias, ...relleno(tipo).slice(0, faltan)];
  const openImage = openIndex !== null ? images[openIndex] : null;

  return (
    <section id="galeria" className="border-t border-border/40">
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <Reveal className="mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Nuestro trabajo</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Galería</h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {images.map((img, i) => (
            <Reveal key={img.src} delay={i * 80}>
              {/* La lupa deja mirar el degradado y el remate de cerca sin salir
                  de la página; el clic sigue abriendo la foto a tamaño grande. */}
              <Lens zoomFactor={1.6} lensSize={140} ariaLabel={`Ampliar: ${img.alt}`}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-border/60 transition-colors hover:border-primary/40"
                >
                  <img src={img.src} alt={img.alt} className="h-full w-full object-cover" />
                  <span className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                    <Expand className="h-3.5 w-3.5" />
                  </span>
                </button>
              </Lens>
            </Reveal>
          ))}
        </div>
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-w-3xl overflow-hidden border-border p-0 sm:rounded-2xl">
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
