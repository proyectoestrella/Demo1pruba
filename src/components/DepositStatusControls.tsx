import { useState } from "react";
import { toast } from "sonner";
import type { Appointment } from "@/lib/mock/types";
import { depositState, effectiveDepositDueAt } from "@/lib/deposit-deadline";
import { useClientNow } from "@/lib/use-client-now";
import { useSalonStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function DepositStatusControls({ appointment, hours, onReleased }: {
  appointment: Appointment;
  hours: number;
  onReleased?: () => void;
}) {
  const now = useClientNow();
  const [confirmRelease, setConfirmRelease] = useState(false);
  const markReceived = useSalonStore((s) => s.markDepositReceived);
  const extend = useSalonStore((s) => s.extendDepositDeadline);
  const cancel = useSalonStore((s) => s.cancelAppointment);
  const state = depositState(appointment, now ?? new Date(0), hours);
  const due = effectiveDepositDueAt(appointment, hours);
  if (state === "none") return null;
  if (state === "received") return <button type="button" className="text-sm font-medium text-success underline-offset-2 hover:underline" onClick={() => { markReceived(appointment.id, false); toast.success("Señal desmarcada"); }}>Señal recibida · Desmarcar</button>;
  if (state === "requested") return <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-foreground">
    Vence a las {due && new Date(due).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
    {due && new Date(due).toDateString() !== now?.toDateString() &&
      ` del ${new Date(due).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`}
  </p><Button size="sm" variant="outline" onClick={() => { markReceived(appointment.id, true); toast.success("Señal recibida"); }}>Ha llegado</Button></div>;
  return <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
    <p className="text-sm font-semibold text-destructive">Señal vencida</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => { markReceived(appointment.id, true); toast.success("Señal recibida"); }}>Ha llegado</Button>
      <Button size="sm" variant="outline" onClick={() => { extend(appointment.id); toast.success("Plazo ampliado"); }}>Dar más tiempo</Button>
      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmRelease(true)}>Liberar el hueco</Button>
    </div>
    {confirmRelease && <div className="space-y-2 border-t border-destructive/30 pt-2 text-sm">
      <p>¿Cancelar la cita de {appointment.clientName} y liberar el hueco? No se cobrará ningún recargo.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={() => { cancel(appointment.id, { porSalon: true }); setConfirmRelease(false); onReleased?.(); toast.success("Hueco liberado"); }}>Sí, liberar</Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmRelease(false)}>Mantener cita</Button>
      </div>
    </div>}
  </div>;
}
