import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { useBusinessType } from "@/lib/use-display-profile";
import { professionalWord } from "@/lib/business-type";
import { serviceMap, employeeMap } from "@/lib/mock/salon";
import type { WaitlistEntry } from "@/lib/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { Button } from "@/components/ui/button";
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
import { CalendarCheck, Clock, ListChecks, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/waitlist")({ component: Waitlist });

function Waitlist() {
  const waitlist = useSalonStore((s) => s.waitlist);
  const deleteWaitlist = useSalonStore((s) => s.deleteWaitlist);
  const tipo = useBusinessType();

  const [deleteTarget, setDeleteTarget] = useState<WaitlistEntry | null>(null);
  const [convertTarget, setConvertTarget] = useState<WaitlistEntry | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);

  function handleDelete() {
    if (!deleteTarget) return;
    deleteWaitlist(deleteTarget.id);
    toast.success("Eliminado de la lista de espera", { description: deleteTarget.clientName });
    setDeleteTarget(null);
  }

  function openConvert(w: WaitlistEntry) {
    setConvertTarget(w);
    setConvertOpen(true);
  }

  function handleConverted() {
    if (convertTarget) {
      deleteWaitlist(convertTarget.id);
    }
    setConvertTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Lista de espera" description="Clientes esperando un hueco." />

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm">
        <p className="font-medium text-primary">Para cuando se libere un hueco</p>
        <p className="mt-1 text-muted-foreground">
          Si alguien cancela, aquí tienes a quién llamar primero: <strong>Convertir a cita</strong> lo
          mete en la agenda. Hoy el aviso lo das tú; el aviso automático lo estamos terminando.
        </p>
      </div>

      {waitlist.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card">
          <EmptyState icon={ListChecks} title="Lista de espera vacía" description="Cuando un cliente pida un hueco que no está disponible, aparecerá aquí." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          {waitlist.map((w) => {
            const s = serviceMap[w.serviceId];
            const e = w.preferredEmployeeId === "any" ? null : employeeMap[w.preferredEmployeeId];
            return (
              <div key={w.id} className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:gap-4">
                <Clock className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{w.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s?.name} · {e ? `con ${e.name}` : `cualquier ${professionalWord(tipo)}`} · {w.preferredRange}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{w.phone}</span>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" className="gap-1.5" onClick={() => openConvert(w)}>
                    <CalendarCheck className="h-3.5 w-3.5" /> Convertir a cita
                  </Button>
                  <Button size="icon" variant="outline" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(w)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewAppointmentDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        defaultClientName={convertTarget?.clientName}
        defaultPhone={convertTarget?.phone}
        defaultServiceId={convertTarget?.serviceId}
        defaultEmployeeId={convertTarget?.preferredEmployeeId === "any" ? undefined : convertTarget?.preferredEmployeeId}
        onCreated={handleConverted}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar de la lista de espera?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${deleteTarget.clientName} dejará de estar en la lista de espera.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
