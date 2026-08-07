import { useState } from "react";
import { Expand } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/Reveal";
import galleryRecorte from "@/assets/gallery-recorte.jpg";
import galleryDegradado from "@/assets/gallery-degradado.jpg";
import galleryDetalle from "@/assets/gallery-detalle.jpg";

/**
 * Imágenes de la galería de trabajos: fotos reales de barbería en acción.
 * La rejilla está pensada para exactamente 3 fotos (2 columnas en móvil, 3 en escritorio).
 * ⚠️ TEMPORAL: gallery-detalle.jpg lleva marca de agua de Unsplash+ visible — sustituir por una foto con licencia antes de mostrarla a un cliente real o pasar a producción.
 */
const GALLERY_IMAGES: { src: string; alt: string }[] = [
  { src: galleryRecorte, alt: "Repasado de barba con tijera" },
  { src: galleryDegradado, alt: "Degradado con máquina y peine" },
  { src: galleryDetalle, alt: "Acabado y detalle de corte" },
];

export function WorkGallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openImage = openIndex !== null ? GALLERY_IMAGES[openIndex] : null;

  return (
    <section id="galeria" className="border-t border-border/40">
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <Reveal className="mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Nuestro trabajo</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Galería</h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {GALLERY_IMAGES.map((img, i) => (
            <Reveal key={img.src} delay={i * 80}>
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-border/60 transition-colors hover:border-primary/40"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/30 group-hover:opacity-100">
                  <Expand className="h-5 w-5 text-white" />
                </span>
              </button>
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
