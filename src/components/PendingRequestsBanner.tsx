import { toast } from "sonner";
import { Clock, MessageCircle } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { enlaceDeFianza } from "@/lib/avisos";
import { eur } from "@/lib/copy";
import type { Appointment } from "@/lib/mock/types";
import { StatusBadge } from "@/components/StatusBadge";
import { StylistDot } from "@/components/StylistAvatar";
import { Button } from "@/components/ui/button";

export interface PendingRequestsBannerProps {
  /** Abre el detalle de la cita (AppointmentDetailSheet) para cambiar duración u hora. */
  onOpenDetail: (appointment: Appointment) => void;
}

/**
 * Franja de "solicitudes pendientes de confirmar": las reservas que llegaron
 * de la web pública (`s.$salonSlug.book.tsx`) y todavía no ha revisado el
 * salón. Se usa tanto en el inicio del panel (`app.index.tsx`) como en la
 * pantalla de citas (`app.appointments.tsx`) — mismo componente para que no
 * se desvíen entre sí, igual que `AppointmentDetailSheet` o `StatusBadge`.
 */
export function PendingRequestsBanner({ onOpenDetail }: PendingRequestsBannerProps) {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const markDepositRequested = useSalonStore((s) => s.markDepositRequested);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const depositEnabled = useSalonStore((s) => !!s.salonProfile.depositEnabled);
  const depositBizumPhone = useSalonStore((s) => s.salonProfile.depositBizumPhone ?? "");
  // Con un solo profesional, "con Adam" en cada solicitud es ruido.
  const soloUno = esSoloUnProfesional(useEquipo());
  const depositAmountEur = useSalonStore((s) => s.salonProfile.depositAmountEur ?? 10);
  const pideFianza = depositEnabled && !!depositBizumPhone.trim();

  const pending = appointments
    .filter((a) => a.status === "pending")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  if (pending.length === 0) return null;

  function handleConfirm(a: Appointment) {
    updateAppointment(a.id, { status: "confirmed" });
    toast.success("Cita confirmada", { description: a.clientName });
  }

  /**
   * Rechazar era un toque, irreversible y sin red: si te equivocabas de fila
   * habías rechazado a un cliente de verdad y no había forma de volver atrás
   * desde la interfaz. Ahora el toast trae "Deshacer" durante unos segundos y
   * devuelve la solicitud exactamente al estado que tenía.
   */
  function handleReject(a: Appointment) {
    const estadoPrevio = a.status;
    cancelAppointment(a.id);
    toast.success("Solicitud rechazada", {
      description: a.clientName,
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: () => {
          updateAppointment(a.id, { status: estadoPrevio });
          toast.success("Solicitud recuperada", { description: a.clientName });
        },
      },
    });
  }

  /**
   * Pedir la señal por Bizum sin abrir el detalle: María (PeluChic) la pide a
   * toda clienta nueva, así que tiene que estar en la misma fila donde ve la
   * solicitud. Abre WhatsApp con el mensaje escrito — lo envía ella.
   */
  function handleFianza(a: Appointment) {
    const telefono = clients.find((c) => c.id === a.clientId)?.phone ?? "";
    if (!telefono) {
      toast.error("Esta solicitud no trae teléfono al que escribir");
      return;
    }
    const url = enlaceDeFianza(telefono, {
      clientName: a.clientName,
      startISO: a.start,
      salonName,
      bizumPhone: depositBizumPhone,
      importeEur: depositAmountEur,
    });
    markDepositRequested(a.id, depositAmountEur);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      data-tour="pending-requests"
      className="overflow-hidden rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10"
    >
      <div className="flex items-center gap-2 border-b border-[var(--warning)]/30 px-5 py-3">
        <Clock className="size-4 shrink-0 text-[var(--warning)]" />
        <h2 className="font-display text-base text-foreground">
          {pending.length} {pending.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"}{" "}
          de confirmar
        </h2>
      </div>
      <div className="divide-y divide-[var(--warning)]/20">
        {pending.map((a) => {
          const emp = employeeMap[a.employeeId];
          return (
            <div
              key={a.id}
              className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{a.clientName}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  {!soloUno && <StylistDot employeeId={a.employeeId} className="size-2" />}
                  {serviceLabelOf(a)} ·{" "}
                  {new Date(a.start).toLocaleString("es", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {soloUno ? "" : ` · con ${emp.name}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => handleConfirm(a)}>
                  Confirmar
                </Button>
                {pideFianza && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => handleFianza(a)}
                  >
                    <MessageCircle className="size-3.5" />
                    {a.depositReceivedAt
                      ? "Señal recibida"
                      : a.depositRequestedAt
                        ? "Reenviar señal"
                        : `Pedir ${eur(depositAmountEur)} de señal`}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onOpenDetail(a)}>
                  Cambiar fecha/hora
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleReject(a)}
                >
                  Rechazar
                </Button>
                <StatusBadge status={a.status} className="hidden sm:inline-flex" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
