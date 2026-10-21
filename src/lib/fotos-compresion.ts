/**
 * Recorte cuadrado y compresión de una foto en el navegador, antes de subirla.
 * El entorno (decodificar, canvas) se inyecta para poder probarlo sin navegador.
 */
import { LADO_FOTO_PX, OBJETIVO_BYTES, recorteCuadrado } from "./fotos-personas";

export interface ImagenDecodificada {
  width: number;
  height: number;
  /** Dibuja el recorte cuadrado (sx, sy, lado) en un canvas de `destino`×`destino`. */
  dibujar: (ctx: unknown, sx: number, sy: number, lado: number, destino: number) => void;
  cerrar?: () => void;
}
export interface CanvasMinimo {
  getContext: (tipo: "2d") => unknown;
  toBlob: (cb: (b: Blob | null) => void, tipo: string, calidad?: number) => void;
  width: number;
  height: number;
}
export interface EntornoImagen {
  decodificar: (archivo: Blob) => Promise<ImagenDecodificada>;
  crearCanvas: (lado: number) => CanvasMinimo;
}

export class ErrorFoto extends Error {}
export const MENSAJE_NO_SE_PUEDE_LEER = "No se puede leer esa foto. Si viene de un iPhone, prueba a hacerla de nuevo o elige otra.";

export interface FotoComprimida { blob: Blob; mime: string; lado: number }

const CALIDADES = [0.85, 0.75, 0.65, 0.55, 0.45];
const LADOS = [LADO_FOTO_PX, 384, 256];

function aBlob(c: CanvasMinimo, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((ok) => c.toBlob(ok, tipo, calidad));
}

export async function comprimirFoto(archivo: Blob, entorno: EntornoImagen = entornoNavegador()): Promise<FotoComprimida> {
  if (archivo.size === 0) throw new ErrorFoto(MENSAJE_NO_SE_PUEDE_LEER);
  let img: ImagenDecodificada;
  try { img = await entorno.decodificar(archivo); } catch { throw new ErrorFoto(MENSAJE_NO_SE_PUEDE_LEER); }
  try {
    if (!(img.width > 0 && img.height > 0)) throw new ErrorFoto(MENSAJE_NO_SE_PUEDE_LEER);
    const { sx, sy, lado } = recorteCuadrado(img.width, img.height);
    let ultima: FotoComprimida | null = null;
    for (const destino of LADOS) {
      const lienzo = entorno.crearCanvas(Math.min(destino, lado));
      const ctx = lienzo.getContext("2d");
      if (!ctx) throw new ErrorFoto(MENSAJE_NO_SE_PUEDE_LEER);
      img.dibujar(ctx, sx, sy, lado, lienzo.width);
      for (const calidad of CALIDADES) {
        // Safari antiguo ignora webp y devuelve png: en ese caso se pide jpeg.
        let b = await aBlob(lienzo, "image/webp", calidad);
        if (b && b.type !== "image/webp") b = await aBlob(lienzo, "image/jpeg", calidad);
        if (!b) throw new ErrorFoto(MENSAJE_NO_SE_PUEDE_LEER);
        ultima = { blob: b, mime: b.type || "image/jpeg", lado: lienzo.width };
        if (b.size <= OBJETIVO_BYTES) return ultima;
      }
    }
    if (ultima) return ultima;
    throw new ErrorFoto(MENSAJE_NO_SE_PUEDE_LEER);
  } finally {
    img.cerrar?.();
  }
}

/** Entorno real del navegador. */
export function entornoNavegador(): EntornoImagen {
  return {
    decodificar: async (archivo) => {
      if (typeof createImageBitmap === "function") {
        try {
          const bmp = await createImageBitmap(archivo);
          return {
            width: bmp.width, height: bmp.height,
            dibujar: (ctx, sx, sy, lado, d) => (ctx as CanvasRenderingContext2D).drawImage(bmp, sx, sy, lado, lado, 0, 0, d, d),
            cerrar: () => bmp.close(),
          };
        } catch { /* sigue con <img> */ }
      }
      const url = URL.createObjectURL(archivo);
      try {
        const el = await new Promise<HTMLImageElement>((ok, mal) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.onerror = () => mal(new Error("no se decodifica"));
          i.src = url;
        });
        return {
          width: el.naturalWidth, height: el.naturalHeight,
          dibujar: (ctx, sx, sy, lado, d) => (ctx as CanvasRenderingContext2D).drawImage(el, sx, sy, lado, lado, 0, 0, d, d),
          cerrar: () => URL.revokeObjectURL(url),
        };
      } catch (e) { URL.revokeObjectURL(url); throw e; }
    },
    crearCanvas: (lado) => {
      const c = document.createElement("canvas");
      c.width = lado; c.height = lado;
      return c as unknown as CanvasMinimo;
    },
  };
}
