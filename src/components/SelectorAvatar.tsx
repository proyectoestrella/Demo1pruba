import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type AvatarElegido } from "@/lib/avatar";
import {
  EXPRESIONES_RETRATO,
  PEINADOS_RETRATO,
  guardarRetrato,
  retratoGuardado,
  uriRetrato,
  type Retrato,
} from "@/lib/retratos-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const borradorInicial = (actual: unknown): Retrato =>
  retratoGuardado(actual) ?? { version: 2, peinado: "largo-liso", expresion: "amable" };

export function SelectorAvatar({
  abierto,
  onOpenChange,
  nombre,
  id,
  actual,
  onElegir,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  nombre: string;
  id: string;
  actual?: unknown;
  onElegir: (avatar: AvatarElegido | null) => void;
  onSubirFoto?: () => void;
}) {
  const [borrador, setBorrador] = useState<Retrato>(() => borradorInicial(actual));
  useEffect(() => {
    if (abierto) setBorrador(borradorInicial(actual));
  }, [abierto, actual, id]);
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-[520px] flex-col gap-0 overflow-hidden bg-card p-0">
        <DialogHeader className="shrink-0 px-5 pt-6 pb-4 text-left">
          <DialogTitle className="pr-7 text-xl font-bold">Avatar de {nombre}</DialogTitle>
          <DialogDescription>
            Elige un peinado y una sonrisa. Puedes cambiarlo cuando quieras.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div className="mb-5 flex items-center gap-4 rounded-2xl bg-nata/60 p-4">
            <img
              src={uriRetrato(borrador)}
              alt={`Vista previa del avatar de ${nombre}`}
              className="size-20 shrink-0 rounded-full"
            />
            <div>
              <p className="text-sm font-semibold">Tu avatar</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                La vista previa se actualiza al elegir. Guarda cuando esté a tu gusto.
              </p>
            </div>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-bold">Peinado</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {PEINADOS_RETRATO.map((peinado) => {
                const activo = borrador.peinado === peinado.id;
                return (
                  <button
                    key={peinado.id}
                    type="button"
                    aria-pressed={activo}
                    aria-label={peinado.nombre}
                    onClick={() => setBorrador({ ...borrador, peinado: peinado.id })}
                    className={cn(
                      "relative grid min-h-20 min-w-0 place-items-center rounded-2xl px-1.5 pt-1.5 pb-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "bg-miel ring-2 ring-cafe/50" : "bg-nata/40 hover:bg-nata",
                    )}
                  >
                    <img
                      src={uriRetrato({ ...borrador, peinado: peinado.id })}
                      alt=""
                      draggable={false}
                      className="aspect-square w-full max-w-20 rounded-full"
                    />
                    <span className="mt-1 line-clamp-2 text-center text-[11px] leading-tight font-medium">
                      {peinado.nombre}
                    </span>
                    {activo && (
                      <span className="absolute right-1 bottom-1 rounded-full bg-cafe p-1 text-white">
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="mt-5">
            <legend className="mb-3 text-sm font-bold">Sonrisa</legend>
            <div className="grid grid-cols-3 gap-2">
              {EXPRESIONES_RETRATO.map((expresion) => {
                const activo = borrador.expresion === expresion.id;
                return (
                  <button
                    key={expresion.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setBorrador({ ...borrador, expresion: expresion.id })}
                    className={cn(
                      "relative min-h-11 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "bg-miel ring-2 ring-cafe/50" : "bg-nata/40 hover:bg-nata",
                    )}
                  >
                    {expresion.nombre}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-nata/50 px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              onElegir(guardarRetrato(borrador));
              onOpenChange(false);
            }}
          >
            Guardar avatar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
