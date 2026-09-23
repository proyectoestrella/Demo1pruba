import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { useBusinessType, useDisplayProfile } from "@/lib/use-display-profile";
import { employeesForType } from "@/lib/mock/salon";
import { fotoDeProfesional, professionalWord } from "@/lib/business-type";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import type { EmployeeId } from "@/lib/mock/types";
import { StylistAvatar } from "@/components/StylistAvatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface WalkInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Sin cita": registra en un toque a quien acaba de entrar por la puerta sin
 * haber reservado. Nombre opcional, servicio, profesional y "ahora mismo" —
 * nada de fecha, hora ni teléfono, que es fricción que no pinta nada cuando
 * el cliente ya está sentado en la silla. Cambio priorizado #2 del informe de
 * referencias (Fresha: "walk-in" es una opción de un toque dentro de crear cita).
 */
export function WalkInDialog({ open, onOpenChange }: WalkInDialogProps) {
  const tipo = useBusinessType();
  const profile = useDisplayProfile();
  const services = useSalonStore((s) => s.services);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const activeServices = services.filter((s) => s.active !== false);
  const serviceMap = selectServiceMap(services);
  // Este diálogo vive en el panel (/app), pero llama a la versión pura para
  // que respete el equipo real del enlace sin depender de que
  // `applyBusinessType` ya haya corrido — igual que las páginas públicas.
  const employees = employeesForType(tipo, profile.team);
  // En un salón real no se enseñan las fotos de stock (ver fotoDeProfesional).
  const esSalonReal = useSalonStore((s) => s.realSalonSlug) === profile.slug;
  // Un solo profesional: la cita se le asigna sola, sin preguntar.
  const soloUno = esSoloUnProfesional(employees);

  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState<string | undefined>(activeServices[0]?.id);
  const [employeeId, setEmployeeId] = useState<EmployeeId | undefined>(employees[0]?.id);

  useEffect(() => {
    if (!open) return;
    setName("");
    setServiceId(activeServices[0]?.id);
    setEmployeeId(employees[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const service = serviceId ? serviceMap[serviceId] : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !employeeId) {
      toast.error(soloUno ? "Elige un servicio" : "Elige servicio y " + professionalWord(tipo));
      return;
    }
    const clientName = name.trim() || "Cliente sin cita";
    addAppointment({
      clientId: `walkin-${Date.now()}`,
      clientName,
      serviceIds: [service.id],
      employeeId,
      start: new Date().toISOString(),
      duration: service.durationMin,
      priceEur: service.priceEur,
      status: "confirmed",
      note: "Sin cita — entró directamente",
    });
    toast.success("Cliente en agenda", {
      description: `${clientName} · ${service.name} · ahora`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Cliente sin cita
            </DialogTitle>
            <DialogDescription>
              Acaba de entrar. Queda en la agenda ahora mismo, sin fecha ni hora que rellenar.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-name">Nombre (opcional)</Label>
              <Input
                id="walkin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Si no lo sabes, no pasa nada"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {activeServices.map((s) => {
                  const selected = serviceId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setServiceId(s.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border/60 hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      <span className="min-w-0 truncate font-medium">{s.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {s.durationMin} min
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!soloUno && (
              <div className="space-y-1.5">
                <Label className="capitalize">{professionalWord(tipo)}</Label>
                <div className="flex flex-wrap gap-2">
                  {employees.map((e) => {
                    const selected = employeeId === e.id;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setEmployeeId(e.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-1.5 text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border/60 hover:border-primary/40",
                        )}
                      >
                        <StylistAvatar
                          name={e.name}
                          employeeId={e.id}
                          photo={fotoDeProfesional(e.name, e.id, e.photo, tipo, esSalonReal)}
                          size="sm"
                        />
                        {e.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Registrar ahora</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
