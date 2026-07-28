import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSalonStore } from "@/lib/store";
import { requiresDeposit } from "@/lib/mock/salon";
import type { Service } from "@/lib/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ServiceFormSheet } from "@/components/ServiceFormSheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, MoreHorizontal, Plus, Scissors } from "lucide-react";

export const Route = createFileRoute("/app/services")({ component: ServicesPage });

function ServicesPage() {
  const services = useSalonStore((s) => s.services);
  const updateService = useSalonStore((s) => s.updateService);
  const deleteService = useSalonStore((s) => s.deleteService);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: Service) {
    setEditing(s);
    setFormOpen(true);
  }
  function handleDelete() {
    if (!deleteTarget) return;
    deleteService(deleteTarget.id);
    toast.success("Servicio eliminado", { description: deleteTarget.name });
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Servicios"
        description="Tu catálogo, duraciones y precios."
        actions={
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo servicio
          </Button>
        }
      />

      {services.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card">
          <EmptyState
            icon={Scissors}
            title="Sin servicios todavía"
            description="Añade tu primer tratamiento para que los clientes puedan reservarlo."
            action={<Button onClick={openCreate}>+ Nuevo servicio</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border bg-card p-5 transition-opacity",
                s.active === false ? "border-border/40 opacity-60" : "border-border/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-xl">{s.name}</h3>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-display text-xl">€{s.priceEur}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(s)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(s)}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {s.durationMin} min
                </span>
                {requiresDeposit(s.durationMin) && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">20% de depósito</span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-xs text-muted-foreground">Activo</span>
                <Switch
                  checked={s.active !== false}
                  onCheckedChange={(checked) => {
                    updateService(s.id, { active: checked });
                    toast.success(checked ? "Servicio activado" : "Servicio desactivado", { description: s.name });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceFormSheet open={formOpen} onOpenChange={setFormOpen} service={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `"${deleteTarget.name}" dejará de estar disponible para reservar. Esta acción no se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
