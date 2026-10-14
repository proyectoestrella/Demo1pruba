import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { TOTAL_AVATARES, avatarValido, elegirAvatar, type AvatarElegido } from "@/lib/avatar";
import { uriDeCurado } from "@/lib/avatar-svg";

/**
 * Rejilla de los 48 avatares curados (Open Peeps, CC0): variedad de pelo, piel
 * y edad, solo caras amables. «Subir foto» queda preparado con `onSubirFoto`:
 * hoy el producto no tiene subida de fotos de personas, así que nadie lo pasa
 * y el botón no aparece (si hay foto, la foto sustituye siempre al avatar).
 */
export function SelectorAvatar({ abierto, onOpenChange, nombre, id, actual, onElegir, onSubirFoto }: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  nombre: string;
  id: string;
  /** Lo que tiene guardado ahora (o nada: usa el automático). */
  actual?: unknown;
  /** `null` = quitar la elección y volver al avatar automático. */
  onElegir: (avatar: AvatarElegido | null) => void;
  onSubirFoto?: () => void;
}) {
  const elegido = avatarValido(actual) ? actual.curado : null;
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-xl flex-col gap-4 overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        <DialogHeader className="flex-row items-center gap-4 border-b border-border px-5 pt-5 pb-4 text-left">
          <Avatar nombre={nombre} id={id} elegido={actual} size="xl" />
          <div className="min-w-0 pr-8">
            <DialogTitle className="text-[17px] font-extrabold">Avatar de {nombre}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">Elige uno de los 48. Si hay foto, la foto manda.</DialogDescription>
          </div>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Avatares disponibles"
          className="grid min-h-0 flex-1 grid-cols-4 gap-2.5 overflow-y-auto px-5 pb-2 sm:grid-cols-6"
        >
          {Array.from({ length: TOTAL_AVATARES }, (_, i) => {
            const activo = elegido === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={`Avatar ${i + 1}`}
                data-curado={i}
                onClick={() => onElegir(elegirAvatar(i))}
                className={cn(
                  "relative aspect-square cursor-pointer overflow-hidden rounded-full border-2 transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  activo ? "border-moca-fuerte" : "border-transparent",
                )}
              >
                <img src={uriDeCurado(i)} alt="" draggable={false} className="h-full w-full" loading="lazy" />
                {activo && (
                  <span className="absolute right-0.5 bottom-0.5 grid size-5 place-items-center rounded-full bg-moca-fuerte text-white" aria-hidden="true">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-perla px-5 py-3">
          <Button type="button" variant="ghost" className="rounded-full font-bold" onClick={() => onElegir(null)} disabled={elegido === null}>
            Usar el automático
          </Button>
          <div className="flex gap-2">
            {onSubirFoto && <Button type="button" variant="outline" className="rounded-full font-bold" onClick={onSubirFoto}>Subir foto</Button>}
            <Button type="button" className="rounded-full font-bold" onClick={() => onOpenChange(false)}>Listo</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
