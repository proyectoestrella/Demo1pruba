import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import type { Service } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

export interface ServiceFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing service to edit it; omit/null to create a new one. */
  service?: Service | null;
}

/** Create/edit form for the services catalog (DESIGN-DIRECTION §RECON, app.services.tsx). */
export function ServiceFormSheet({ open, onOpenChange, service }: ServiceFormSheetProps) {
  const addService = useSalonStore((s) => s.addService);
  const updateService = useSalonStore((s) => s.updateService);
  const isEdit = !!service;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState("45");
  const [priceEur, setPriceEur] = useState("40");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setDurationMin(String(service?.durationMin ?? 45));
    setPriceEur(String(service?.priceEur ?? 40));
    setActive(service?.active ?? true);
  }, [open, service]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El servicio necesita un nombre");
      return;
    }
    const duration = Number(durationMin) || 0;
    const price = Number(priceEur) || 0;
    if (isEdit && service) {
      updateService(service.id, { name: name.trim(), description: description.trim(), durationMin: duration, priceEur: price, active });
      toast.success("Servicio actualizado", { description: name });
    } else {
      addService({ name: name.trim(), description: description.trim(), durationMin: duration, priceEur: price, active });
      toast.success("Servicio creado", { description: name });
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6 sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex h-full flex-col gap-6">
          <SheetHeader>
            <SheetTitle>{isEdit ? "Editar servicio" : "Nuevo servicio"}</SheetTitle>
            <SheetDescription>
              {isEdit ? "Actualiza el nombre, duración o precio." : "Añade un tratamiento a tu catálogo."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="svc-name">Nombre</Label>
              <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte de caballero" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-desc">Descripción</Label>
              <Textarea id="svc-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Lavado, corte y acabado." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="svc-duration">Duración (min)</Label>
                <Input id="svc-duration" type="number" min={5} step={5} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-price">Precio (€)</Label>
                <Input id="svc-price" type="number" min={0} step={1} value={priceEur} onChange={(e) => setPriceEur(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">Visible para reservar en la web pública.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <SheetFooter className="mt-auto">
            <Button type="submit" className="w-full">
              {isEdit ? "Guardar cambios" : "Crear servicio"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
