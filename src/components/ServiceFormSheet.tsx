import { useEffect, useMemo, useState } from "react";
import { categoryOrderOf } from "@/lib/business-type";
import { exposicionDe } from "@/lib/solape";
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
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const services = useSalonStore((s) => s.services);
  // Lote P: las secciones de SU carta, para elegir una o escribir otra.
  const secciones = useMemo(
    () => categoryOrderOf(services).filter((c) => c !== "Servicios" && c !== "Otros"),
    [services],
  );
  const isEdit = !!service;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState("45");
  const [priceEur, setPriceEur] = useState("40");
  const [active, setActive] = useState(true);
  const [category, setCategory] = useState("");
  const [priceText, setPriceText] = useState("");
  const [aplicacionMin, setAplicacionMin] = useState("");
  const [exposicionMin, setExposicionMin] = useState("");
  const perfil = useSalonStore((s) => s.salonProfile);
  // Lavado que no se cobra aparte: este servicio ES el lavado suelto, o lo INCLUYE.
  const lavadoCfg = perfil.lavado;
  const [esLavado, setEsLavado] = useState(false);
  const [incluyeLavado, setIncluyeLavado] = useState(false);
  const hayLavado = !!lavadoCfg?.servicioId && services.some((x) => x.id === lavadoCfg.servicioId);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setDurationMin(String(service?.durationMin ?? 45));
    setPriceEur(String(service?.priceEur ?? 40));
    setActive(service?.active ?? true);
    setCategory(service?.category && service.category !== "Servicios" ? service.category : "");
    setPriceText(service?.priceText ?? "");
    const perfilActual = useSalonStore.getState().salonProfile;
    const exposicion = service ? exposicionDe(service, perfilActual) : undefined;
    setAplicacionMin(exposicion ? String(exposicion.aplicacionMin) : "");
    setExposicionMin(exposicion ? String(exposicion.exposicionMin) : "");
    const cfg = perfilActual.lavado;
    setEsLavado(!!service && cfg?.servicioId === service.id);
    setIncluyeLavado(!!service && !!cfg?.incluidoEn?.includes(service.id));
  }, [open, service]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El servicio necesita un nombre");
      return;
    }
    const duration = Number(durationMin) || 0;
    const price = Number(String(priceEur).replace(",", ".")) || 0;
    const leerMinutos = (valor: string, etiqueta: string): number | undefined | null => {
      if (!valor.trim()) return undefined;
      const minutos = Number(valor);
      if (!Number.isInteger(minutos) || minutos < 0) {
        toast.error(`${etiqueta} tiene que ser un número entero de minutos`);
        return null;
      }
      return minutos;
    };
    const aplicacion = leerMinutos(aplicacionMin, "La aplicación");
    const exposicion = leerMinutos(exposicionMin, "La exposición");
    if (aplicacion === null || exposicion === null) return;
    if ((aplicacion ?? 0) + (exposicion ?? 0) > duration) {
      toast.error("Aplicación y exposición no pueden superar la duración del servicio");
      return;
    }
    const grupo = category.trim() || undefined;
    let id: string;
    if (isEdit && service) {
      id = service.id;
      updateService(service.id, {
        name: name.trim(),
        description: description.trim(),
        durationMin: duration,
        priceEur: price,
        active,
        category: grupo ?? service.category,
      });
      toast.success("Servicio actualizado", { description: name });
    } else {
      id = addService({
        name: name.trim(),
        description: description.trim(),
        durationMin: duration,
        priceEur: price,
        active,
        ...(grupo ? { category: grupo } : {}),
      }).id;
      toast.success("Servicio creado", { description: name });
    }
    // El precio «como lo anuncias» vive en el perfil (lo lee también la web).
    const literal = priceText.trim();
    const actuales = useSalonStore.getState().salonProfile.preciosLiterales ?? {};
    if ((actuales[id] ?? "") !== literal) {
      const siguiente = { ...actuales };
      if (literal) siguiente[id] = literal;
      else delete siguiente[id];
      updateSalonProfile({ preciosLiterales: siguiente });
    }
    // Los tiempos de exposición no forman parte de la carta serializada: se
    // guardan por id en el perfil para no exigir una migración de base de datos.
    const exposicionesActuales = useSalonStore.getState().salonProfile.exposicionServicios ?? {};
    const exposicionesSiguientes = { ...exposicionesActuales };
    if (aplicacion === undefined && exposicion === undefined) delete exposicionesSiguientes[id];
    else {
      exposicionesSiguientes[id] = {
        ...(aplicacion !== undefined ? { aplicacionMin: aplicacion } : {}),
        ...(exposicion !== undefined ? { exposicionMin: exposicion } : {}),
      };
    }
    if (JSON.stringify(exposicionesSiguientes) !== JSON.stringify(exposicionesActuales)) {
      updateSalonProfile({
        exposicionServicios: Object.keys(exposicionesSiguientes).length
          ? exposicionesSiguientes
          : undefined,
      });
    }
    // «Incluye lavado»: vive en el perfil y lo leen la reserva, el servidor y Nueva cita.
    const cfg = useSalonStore.getState().salonProfile.lavado;
    let servicioId = cfg?.servicioId ?? "";
    if (esLavado) servicioId = id;
    else if (servicioId === id) servicioId = "";
    const incluidoEn = new Set(cfg?.incluidoEn ?? []);
    if (incluyeLavado && !esLavado) incluidoEn.add(id);
    else incluidoEn.delete(id);
    const hayCambio =
      servicioId !== (cfg?.servicioId ?? "") ||
      incluidoEn.size !== (cfg?.incluidoEn?.length ?? 0) ||
      [...incluidoEn].some((x) => !cfg?.incluidoEn?.includes(x));
    if (hayCambio)
      updateSalonProfile({
        lavado: servicioId ? { servicioId, incluidoEn: [...incluidoEn] } : undefined,
      });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6 sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex h-full flex-col gap-6">
          <SheetHeader>
            <SheetTitle>{isEdit ? "Editar servicio" : "Nuevo servicio"}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Actualiza el nombre, duración o precio."
                : "Añade un tratamiento a tu catálogo."}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="svc-name">Nombre</Label>
              <Input
                id="svc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Corte de caballero"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-desc">Descripción</Label>
              <Textarea
                id="svc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Lavado, corte y acabado."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="svc-duration">Duración (min)</Label>
                <Input
                  id="svc-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-price">Precio (€)</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  step={0.5}
                  value={priceEur}
                  onChange={(e) => setPriceEur(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-lino bg-nata p-4">
              <div>
                <p className="text-sm font-bold">Tiempo de exposición</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Durante la exposición puedes atender a otra clienta. Déjalo vacío si la
                  profesional está ocupada todo el servicio; pon exposición 0 para desactivar un
                  valor automático de color.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="svc-application">Aplicación (min)</Label>
                  <Input
                    id="svc-application"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={5}
                    value={aplicacionMin}
                    onChange={(e) => setAplicacionMin(e.target.value)}
                    placeholder="15"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-exposure">Exposición (min)</Label>
                  <Input
                    id="svc-exposure"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={5}
                    value={exposicionMin}
                    onChange={(e) => setExposicionMin(e.target.value)}
                    placeholder="30"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-price-text">Precio como lo anuncias (opcional)</Label>
              <Input
                id="svc-price-text"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="24 € / 28 € / 31 € · desde 150 €"
              />
              <p className="text-xs text-muted-foreground">
                Si tiene varios precios o un «desde». Se reserva con el de arriba.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-category">Sección de la carta</Label>
              <Input
                id="svc-category"
                list="svc-secciones"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={secciones[0] ?? "Cortes, Color, Tratamientos…"}
              />
              <datalist id="svc-secciones">
                {secciones.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">
                  Visible para reservar en la web pública.
                </p>
              </div>
              <Switch aria-label="Servicio activo" checked={active} onCheckedChange={setActive} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Es el lavado suelto</p>
                <p className="text-xs text-muted-foreground">
                  El que se cobra solo cuando va sin otro servicio que lo lleve.
                </p>
              </div>
              <Switch
                aria-label="Es el lavado suelto"
                checked={esLavado}
                onCheckedChange={(v) => {
                  setEsLavado(v);
                  if (v) setIncluyeLavado(false);
                }}
              />
            </div>
            {hayLavado && !esLavado && (
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Incluye el lavado</p>
                  <p className="text-xs text-muted-foreground">
                    Si se reserva junto al lavado suelto, este no se cobra aparte ni alarga la cita.
                  </p>
                </div>
                <Switch
                  aria-label="Incluye el lavado"
                  checked={incluyeLavado}
                  onCheckedChange={setIncluyeLavado}
                />
              </div>
            )}
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
