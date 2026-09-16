import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "@/lib/appointment-status";
import { useSalonStore } from "@/lib/store";
import { employeeMap } from "@/lib/mock/salon";
import { serviceNamesOf } from "@/lib/appointment-services";
import type { Appointment, AppointmentStatus } from "@/lib/mock/types";
import { StylistAvatar } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Calendar, Clock, Euro, CheckCheck } from "lucide-react";

/** Duraciones que puede elegir el salón al ajustar una cita, en minutos. */
const DURATION_OPTIONS_MIN = [15, 30, 45, 60, 90, 120, 150, 180];

// Local time components (not toISOString, que es UTC) — igual que en
// NewAppointmentDialog, para que "09:00" en el input sea "09:00" en la cita.
function toTimeInputValue(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

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
export function AppointmentDetailSheet({
  appointment: appointmentProp,
  open,
  onOpenChange,
}: AppointmentDetailSheetProps) {
  // La cita llega como prop desde quien abrió el panel, y esa copia se queda
  // congelada: al cambiar el estado o marcar la confirmación del cliente, el
  // store se actualizaba pero aquí se seguía pintando el objeto viejo. Se lee
  // la versión viva del store y la prop queda solo como respaldo.
  const stored = useSalonStore((s) =>
    appointmentProp ? s.appointments.find((a) => a.id === appointmentProp.id) : undefined,
  );
  const appointment = stored ?? appointmentProp;

  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const markClientConfirmed = useSalonStore((s) => s.markClientConfirmed);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const serviceNames = appointment ? serviceNamesOf(appointment) : [];
  const start = appointment ? new Date(appointment.start) : null;
  // La cita puede llevar una duración que no está en la lista fija (suma de
  // varios servicios): se añade como opción propia para que el desplegable
  // siempre muestre el valor real en vez de quedarse en blanco.
  const durationOptions =
    appointment && !DURATION_OPTIONS_MIN.includes(appointment.duration)
      ? [...DURATION_OPTIONS_MIN, appointment.duration].sort((a, b) => a - b)
      : DURATION_OPTIONS_MIN;

  function handleDurationChange(minutes: number) {
    if (!appointment) return;
    updateAppointment(appointment.id, { duration: minutes });
    toast.success("Duración actualizada");
  }

  function handleTimeChange(time: string) {
    if (!appointment || !start || !time) return;
    const [hh, mm] = time.split(":").map(Number);
    const next = new Date(start);
    next.setHours(hh, mm, 0, 0);
    updateAppointment(appointment.id, { start: next.toISOString() });
    toast.success("Hora actualizada");
  }

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
            <StylistAvatar
              name={employeeMap[appointment.employeeId].name}
              employeeId={appointment.employeeId}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {employeeMap[appointment.employeeId].name}
              </p>
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
                {start.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}{" "}
                · {start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                {serviceNames.length > 1 ? (
                  <ul className="space-y-0.5">
                    {serviceNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <span>{serviceNames[0] ?? "Servicio"}</span>
                )}
                <p className="text-xs text-muted-foreground">
                  {appointment.duration} min{serviceNames.length > 1 ? " en total" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Euro className="size-4 text-muted-foreground" />
              <span>€{appointment.priceEur}</span>
            </div>
            {appointment.note && (
              <p className="border-t border-border/60 pt-3 text-muted-foreground">
                {appointment.note}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Duración y hora
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={String(appointment.duration)}
                onValueChange={(v) => handleDurationChange(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((min) => (
                    <SelectItem key={min} value={String(min)}>
                      {min} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                value={toTimeInputValue(start)}
                onChange={(e) => handleTimeChange(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cambiar estado
            </p>
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
            <p className="text-xs text-muted-foreground">
              Es el estado que llevas tú en la agenda.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Confirmación del cliente
            </p>
            <button
              type="button"
              onClick={() => {
                const yaConfirmada = !!appointment.clientConfirmedAt;
                markClientConfirmed(appointment.id, !yaConfirmada);
                toast.success(
                  yaConfirmada
                    ? "Marcada como no confirmada"
                    : "Marcada como confirmada por el cliente",
                );
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                appointment.clientConfirmedAt
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted/50",
              )}
            >
              <CheckCheck className="size-4 shrink-0" />
              {appointment.clientConfirmedAt ? (
                <span>
                  El cliente confirmó el{" "}
                  {new Date(appointment.clientConfirmedAt).toLocaleDateString("es", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              ) : (
                <span>El cliente aún no ha confirmado</span>
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              De momento se marca a mano. Cuando haya recordatorios, lo marcará el cliente al
              responder.
            </p>
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
                    Se marcará como cancelada para {appointment.clientName}. Esta acción no se puede
                    deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
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
