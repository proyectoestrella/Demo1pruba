import { useState } from "react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { serviceMap, employeeMap } from "@/lib/mock/salon";
import type { Appointment, AppointmentStatus } from "@/lib/mock/types";
import { StylistAvatar } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calendar, Clock, Euro } from "lucide-react";

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "confirmed", label: "Confirmada" },
  { value: "completed", label: "Completada" },
  { value: "no-show", label: "No asistió" },
  { value: "cancelled", label: "Cancelada" },
];

export interface AppointmentDetailSheetProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Sheet with appointment detail + change-status + cancel. Reused from the
 * dashboard "today" list, the appointments table and the calendar blocks so
 * clicking a booking never navigates away (DESIGN-DIRECTION §2.3 / §4.10).
 */
export function AppointmentDetailSheet({ appointment, open, onOpenChange }: AppointmentDetailSheetProps) {
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const service = appointment ? serviceMap[appointment.serviceId] : undefined;
  const start = appointment ? new Date(appointment.start) : null;

  function handleCancel() {
    if (!appointment) return;
    cancelAppointment(appointment.id);
    toast.success("Cita cancelada", { description: appointment.clientName });
    setConfirmOpen(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open && !!appointment} onOpenChange={onOpenChange}>
      {appointment && start && (
      <SheetContent className="flex flex-col gap-6 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{appointment.clientName}</SheetTitle>
          <SheetDescription>Detalle de la cita</SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-3">
          <StylistAvatar name={employeeMap[appointment.employeeId].name} employeeId={appointment.employeeId} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{employeeMap[appointment.employeeId].name}</p>
            <p className="text-xs text-muted-foreground">Estilista asignada</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={appointment.status} />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span>
              {start.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
              {start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span>{service?.name ?? "Servicio"} · {appointment.duration} min</span>
          </div>
          <div className="flex items-center gap-2">
            <Euro className="size-4 text-muted-foreground" />
            <span>€{appointment.priceEur}</span>
          </div>
          {appointment.note && (
            <p className="border-t border-border/60 pt-3 text-muted-foreground">{appointment.note}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cambiar estado</p>
          <Select
            value={appointment.status}
            onValueChange={(v) => {
              updateAppointment(appointment.id, { status: v as AppointmentStatus });
              toast.success("Estado actualizado");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SheetFooter className="mt-auto">
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                disabled={appointment.status === "cancelled"}
              >
                Cancelar cita
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se marcará como cancelada para {appointment.clientName}. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Volver</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sí, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
      )}
    </Sheet>
  );
}
