import { toast } from "sonner";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { recargoActivo } from "@/lib/recargo-activo";
import { clientsWithPendingPenalty, penaltyReasonLabel } from "@/lib/plantones";
import { serviceLabelOf } from "@/lib/appointment-services";
import { eur } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/mock/types";
import { ClientAvatar } from "@/components/ClientAvatar";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { CircleCheck, HandHeart, Wallet, CalendarClock } from "lucide-react";

export interface RecargosPendientesProps {
  /** Filtra la lista a un único cliente (ficha de cliente). Sin esto, enseña a todos. */
  clientId?: string;
  /** Título del bloque. Por defecto, "Recargos pendientes". */
  title?: string;
  /** Estilos extra para el contenedor. */
  className?: string;
}

/**
 * Lista de clientes con un recargo pendiente de la política de plantón:
 * motivo (no se presentó / llegó tarde), fecha y servicio de la cita que lo
 * originó, importe, y las tres acciones que decide el dueño — nunca se cobra
 * ni se perdona solo. Pensado para reutilizarse en la página "Hoy", en
 * Clientes (bloque destacado + ficha) y en cualquier otro sitio que necesite
 * la misma vista.
 *
 * No usa "plantón" ni "no-show" en la interfaz: está prohibido en el
 * material de venta de siShow.
 */
export function RecargosPendientes({ clientId, title, className }: RecargosPendientesProps) {
  const carta = selectServiceMap(useSalonStore((s) => s.services));
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const clients = useSalonStore((s) => s.clients);
  const appointments = useSalonStore((s) => s.appointments);
  const clearPenalty = useSalonStore((s) => s.clearPenalty);
  const reviewPenalty = useSalonStore((s) => s.reviewPenalty);

  const pendientes = clientsWithPendingPenalty(clients)
    .filter((c) => (clientId ? c.id === clientId : true))
    .sort((a, b) => +new Date(b.penaltyAt ?? 0) - +new Date(a.penaltyAt ?? 0));

  function citaDe(client: Client) {
    return client.penaltyAppointmentId
      ? appointments.find((a) => a.id === client.penaltyAppointmentId)
      : undefined;
  }

  function handlePerdonar(client: Client) {
    clearPenalty(client.id, "perdonado");
  }

  function handleMantener(client: Client) {
    reviewPenalty(client.id);
    toast.success(`Recargo de ${client.name} revisado: se queda pendiente`);
  }

  function handleCobrado(client: Client) {
    clearPenalty(client.id, "cobrado");
  }

  if (!recargoActivo({ noShowFeeEur })) return null;

  if (pendientes.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-card", className)}>
        <EmptyState
          icon={CircleCheck}
          title="Sin recargos pendientes"
          description="Cuando alguien no se presente o llegue tarde con recargo, aparecerá aquí."
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {title && <h2 className="font-display text-base">{title}</h2>}
      <div className="space-y-3">
        {pendientes.map((client) => {
          const cita = citaDe(client);
          const fecha = cita?.start ?? client.penaltyAt;
          return (
            <div
              key={client.id}
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ClientAvatar name={client.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{client.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {penaltyReasonLabel(client)}
                      {fecha && (
                        <>
                          {" · "}
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3" aria-hidden="true" />
                            {new Date(fecha).toLocaleDateString("es", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </>
                      )}
                      {cita && ` · ${serviceLabelOf(cita, carta)}`}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-display text-lg tabular-nums text-destructive">
                  {eur(client.penaltyEur ?? 0)}
                </span>
              </div>

              {/* Botones grandes, sin menú escondido — pensado para pulsar con el dedo. */}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  size="lg"
                  className="h-11 gap-1.5"
                  onClick={() => handleCobrado(client)}
                >
                  <Wallet className="size-4" aria-hidden="true" />
                  Marcar como pagada
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 gap-1.5"
                  onClick={() => handleMantener(client)}
                >
                  <CalendarClock className="size-4" aria-hidden="true" />
                  Mantener
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-11 gap-1.5"
                  onClick={() => handlePerdonar(client)}
                >
                  <HandHeart className="size-4" aria-hidden="true" />
                  Perdonar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
