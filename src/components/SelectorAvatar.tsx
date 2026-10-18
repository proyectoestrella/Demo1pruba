import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { avatarIdDeElegido, elegirAvatar, type AvatarElegido } from "@/lib/avatar";
import { GRUPOS_AVATAR, uriDeAvatar } from "@/lib/avatar-svg";

/**
 * Rejilla de los avatares propios: variedad de pelo y edad, con una única cara
 * amarillo emoji. «Subir foto» queda preparado con `onSubirFoto`:
 * hoy el producto no tiene subida de fotos de personas, así que nadie lo pasa
 * y el botón no aparece (si hay foto, la foto sustituye siempre al avatar).
 */
export function SelectorAvatar({
  abierto,
  onOpenChange,
  nombre,
  id,
  actual,
  onElegir,
  onSubirFoto,
}: {
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
  const elegido = avatarIdDeElegido(actual);
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-xl flex-col gap-4 overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        <DialogHeader className="flex-row items-center gap-4 border-b border-border px-5 pt-5 pb-4 text-left">
          <Avatar nombre={nombre} id={id} elegido={actual} size="xl" />
          <div className="min-w-0 pr-8">
            <DialogTitle className="text-[17px] font-extrabold">Avatar de {nombre}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">
              Elige una persona. Si hay foto, la foto manda.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Avatares disponibles"
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-1 pb-4"
        >
          {GRUPOS_AVATAR.map(({ titulo, avatares }) => (
            <section key={titulo} aria-label={titulo}>
              <p className="mb-2 text-[11px] font-bold tracking-[.06em] text-cafe-suave uppercase">
                {titulo}
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {avatares.map((avatar) => {
                  const activo = elegido === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      aria-label={avatar.nombre}
                      data-avatar={avatar.id}
                      onClick={() => onElegir(elegirAvatar(avatar.id))}
                      className={cn(
                        "relative grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border-2 p-0.5 transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        activo
                          ? "border-moca-fuerte bg-beige"
                          : "border-transparent hover:bg-beige",
                      )}
                    >
                      <img
                        src={uriDeAvatar(avatar.id)}
                        alt=""
                        draggable={false}
                        className="block size-full max-h-16 max-w-16 rounded-full"
                        loading="lazy"
                      />
                      {activo && (
                        <span
                          className="absolute right-0 bottom-0 grid size-5 place-items-center rounded-full bg-moca-fuerte text-white"
                          aria-hidden="true"
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-perla px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full font-bold"
            onClick={() => onElegir(null)}
            disabled={!elegido}
          >
            Usar el automático
          </Button>
          <div className="flex gap-2">
            {onSubirFoto && (
              <Button
                type="button"
                variant="outline"
                className="rounded-full font-bold"
                onClick={onSubirFoto}
              >
                Subir foto
              </Button>
            )}
            <Button
              type="button"
              className="rounded-full font-bold"
              onClick={() => onOpenChange(false)}
            >
              Listo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
