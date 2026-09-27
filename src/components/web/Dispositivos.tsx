import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAPTURAS, rutaCaptura, type NombreCaptura } from "./capturas";

interface PropsImagen {
  captura: NombreCaptura;
  /** Atributo `sizes`: cuánto ocupa la imagen en pantalla. */
  sizes: string;
  /** La imagen principal de la página: sin carga diferida y con prioridad. */
  prioridad?: boolean;
  /** Si la imagen repite lo que ya dice el texto de al lado, alt vacío. */
  decorativa?: boolean;
  className?: string;
}

/** Captura del producto con sus variantes, tamaño reservado y carga diferida. */
export function ImagenCaptura({ captura, sizes, prioridad, decorativa, className }: PropsImagen) {
  const c = CAPTURAS[captura];
  const menor = Math.min(...c.anchos);
  return (
    <img
      src={rutaCaptura(captura, menor)}
      srcSet={c.anchos.map((a) => `${rutaCaptura(captura, a)} ${a}w`).join(", ")}
      sizes={sizes}
      width={c.ancho}
      height={c.alto}
      alt={decorativa ? "" : c.alt}
      loading={prioridad ? "eager" : "lazy"}
      decoding={prioridad ? undefined : "async"}
      fetchPriority={prioridad ? "high" : "auto"}
      className={className}
    />
  );
}

/** Portátil con una captura del panel en pantalla. */
export function Portatil({ className, ...imagen }: PropsImagen) {
  return (
    <figure className={cn("ws-portatil", className)}>
      <div className="ws-portatil-pantalla">
        <ImagenCaptura {...imagen} />
      </div>
      <div className="ws-portatil-base" aria-hidden="true" />
    </figure>
  );
}

/**
 * Móvil con una captura. `dominio` pinta encima la dirección de la web, para
 * que se vea que la web de reservas va con el nombre del salón.
 */
export function Movil({ className, dominio, hora = "12:40", ...imagen }: PropsImagen & { dominio?: string; hora?: string }) {
  return (
    <figure className={cn("ws-movil relative", className)}>
      <div className="ws-movil-marco">
        <div className="ws-movil-pantalla">
          <div className="ws-movil-estado" aria-hidden="true">
            <span className="ws-cifra">{hora}</span>
            <span className="ws-movil-isla" />
            <span className="ws-movil-iconos">
              <i style={{ height: "1.6cqw" }} />
              <i style={{ height: "2.2cqw" }} />
              <i style={{ height: "2.8cqw" }} />
              <b />
            </span>
          </div>
          <ImagenCaptura {...imagen} />
        </div>
      </div>
      {dominio && (
        <figcaption className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="ws-url">
            <Lock className="h-3.5 w-3.5 text-[color:var(--ws-hoja)]" aria-hidden="true" />
            {dominio}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** Recorte de una pantalla del panel, como una ventana suelta. */
export function Ventana({ className, ...imagen }: PropsImagen) {
  return (
    <figure className={cn("ws-ventana m-0", className)}>
      <ImagenCaptura {...imagen} />
    </figure>
  );
}
