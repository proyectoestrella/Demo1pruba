import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type AvatarElegido } from "@/lib/avatar";
import { guardarRetrato, peinadosRetrato, retratoGuardado, uriRetrato, type Retrato, type TipoRetrato } from "@/components/retratos-avatar";
import { Avatar } from "@/components/Avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function SelectorAvatar({ abierto, onOpenChange, nombre, id, actual, onElegir }: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  nombre: string;
  id: string;
  actual?: unknown;
  onElegir: (avatar: AvatarElegido | null) => void;
  onSubirFoto?: () => void;
}) {
  const [borrador, setBorrador] = useState<Retrato | undefined>(() => retratoGuardado(actual));
  useEffect(() => {
    if (abierto) setBorrador(retratoGuardado(actual));
  }, [abierto, actual, id]);
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-[520px] flex-col gap-0 overflow-hidden bg-card p-0">
        <DialogHeader className="shrink-0 px-5 pt-6 pb-4 text-left">
          <DialogTitle className="pr-7 text-xl font-bold">Avatar de {nombre}</DialogTitle>
          <DialogDescription>Elige un retrato y el peinado que más se parezca a ti.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div className="mb-5 flex items-center gap-4 rounded-2xl bg-nata/60 p-4">
            {borrador ? <img src={uriRetrato(borrador)} alt={`Vista previa del avatar de ${nombre}`} className="size-20 shrink-0 rounded-full" />
              : <Avatar nombre={nombre} id={id} elegido={actual} size={80} />}
            <div><p className="text-sm font-semibold">Tu avatar</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">La vista previa se actualiza al elegir. Guarda cuando esté a tu gusto.</p></div>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-bold">Elige tu retrato</legend>
            <div className="grid grid-cols-2 gap-3">
              {(["mujer", "hombre"] as TipoRetrato[]).map((tipo) => {
                const activo = borrador?.tipo === tipo;
                return <button key={tipo} type="button" aria-pressed={activo} aria-label={tipo === "mujer" ? "Mujer" : "Hombre"}
                  onClick={() => setBorrador({ version: 1, tipo, peinado: 0 })}
                  className={cn("relative flex min-h-28 items-center justify-center rounded-2xl p-3 transition-colors",
                    activo ? "bg-miel ring-2 ring-cafe/50" : "bg-nata/40 hover:bg-nata")}>
                  <img src={uriRetrato({ version: 1, tipo, peinado: 0 })} alt="" draggable={false} className="size-24 rounded-full" />
                  {activo && <Check className="absolute top-3 right-3 size-4 text-cafe" aria-hidden="true" />}
                </button>;
              })}
            </div>
          </fieldset>
          {borrador && <fieldset className="mt-5">
            <legend className="mb-3 text-sm font-bold">Elige el peinado</legend>
            <div className="grid grid-cols-4 gap-2">
              {peinadosRetrato(borrador.tipo).map((indice) => {
                const activo = borrador.peinado === indice;
                return <button key={indice} type="button" aria-pressed={activo} aria-label={`Peinado ${indice + 1}`}
                  onClick={() => setBorrador({ ...borrador, peinado: indice })}
                  className={cn("relative grid aspect-square min-h-11 min-w-0 place-items-center rounded-2xl p-1.5 transition-colors",
                    activo ? "bg-miel ring-2 ring-cafe/50" : "bg-nata/40 hover:bg-nata")}>
                  <img src={uriRetrato({ ...borrador, peinado: indice })} alt="" draggable={false} className="aspect-square w-full rounded-full" />
                  {activo && <span className="absolute right-1 bottom-1 rounded-full bg-cafe p-1 text-white"><Check className="size-3" aria-hidden="true" /></span>}
                </button>;
              })}
            </div>
          </fieldset>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-nata/50 px-5 py-4">
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" className="min-h-11" disabled={!borrador} onClick={() => {
            if (!borrador) return;
            onElegir(guardarRetrato(borrador));
            onOpenChange(false);
          }}>Guardar avatar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
