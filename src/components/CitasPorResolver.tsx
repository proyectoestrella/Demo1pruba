import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Clock3, UserX, HelpCircle } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { citasSinDesenlace, ESTADO_POR_DESENLACE, type Desenlace } from "@/lib/deuda";
import { employeeMap } from "@/lib/mock/salon";
import { serviceLabelOf } from "@/lib/appointment-services";
import type { Appointment, AppointmentStatus, Client } from "@/lib/mock/types";
import { DecisionDeudaDialog } from "@/components/DecisionDeudaDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Los tres botones de "¿qué pasó?", juntos y siempre en el mismo orden.
 *
 * Se usan aquí y en el detalle de la cita. Eran dos salidas ("vino" / "no
 * vino") y ahora son tres: Tomás pidió expresamente poder distinguir a quien
 * llega tarde sin avisar.
 */
export function BotonesDesenlace({
  onElegir,
  actual,
  size = "sm",
}: {
  onElegir: (d: Desenlace) => void;
  /** Estado actual de la cita, para marcar el botón que ya está elegido. */
  actual?: AppointmentStatus;
  size?: "sm" | "default";
}) {
  const opciones: { d: Desenlace; texto: string; icon: typeof Check }[] = [
    { d: "vino", texto: "Vino", icon: Check },
    { d: "tarde", texto: "Tarde sin avisar", icon: Clock3 },
    { d: "no-vino", texto: "No vino", icon: UserX },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(({ d, texto, icon: Icon }) => {
        const elegido = actual === ESTADO_POR_DESENLACE[d];
        return (
          <Button
            key={d}
            size={size}
            variant={elegido ? "default" : "outline"}
            aria-pressed={elegido}
            onClick={(e) => {
              e.stopPropagation();
              onElegir(d);
            }}
            className={cn(
              "gap-1.5",
              !elegido && d === "no-vino" && "text-destructive hover:text-destructive",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {texto}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Aplica un desenlace a una cita y deja el "Deshacer" cargado.
 * Devuelve el cliente al que habría que anotarle algo, si lo hay.
 */
export function useAplicarDesenlace() {
  const updateAppointment = useSalonStore((s) => s.updateAppointment);

  return function aplicar(a: Appointment, d: Desenlace) {
    const previo = a.status;
    updateAppointment(a.id, { status: ESTADO_POR_DESENLACE[d] });
    const mensajes: Record<Desenlace, string> = {
      vino: `${a.clientName} vino`,
      tarde: `${a.clientName} llegó tarde sin avisar`,
      "no-vino": `${a.clientName} no vino`,
    };
    toast.success(mensajes[d], {
      description: new Date(a.start).toLocaleString("es", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      duration: 9000,
      action: {
        label: "Deshacer",
        onClick: () => updateAppointment(a.id, { status: previo }),
      },
    });
  };
}

export interface CitasPorResolverProps {
  /** Cuántas filas se enseñan de golpe. El resto se cuenta al pie. */
  limite?: number;
  className?: string;
}

/**
 * "¿Qué pasó con estas citas?" — la pregunta en el sitio y en el momento.
 *
 * Una cita que ya terminó y sigue en "pendiente" o "confirmada" es una cita
 * de la que nadie ha dicho si la persona apareció. Hasta ahora eso no se
 * preguntaba en ningún sitio: había que entrar a la ficha del cliente y
 * marcarlo a mano, y por eso Adam no usaba lo que le vendimos.
 */
export function CitasPorResolver({ limite = 5, className }: CitasPorResolverProps) {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const aplicarDesenlace = useAplicarDesenlace();
  const [decision, setDecision] = useState<{
    client: Client | undefined;
    cita: Appointment;
    desenlace: Desenlace;
  } | null>(null);

  const pendientes = useMemo(() => citasSinDesenlace(appointments), [appointments]);
  const visibles = pendientes.slice(0, limite);

  function elegir(a: Appointment, d: Desenlace) {
    aplicarDesenlace(a, d);
    if (d === "vino") return;
    // Solo cuando algo fue mal se pregunta por el dinero, y solo si esa cita
    // tiene ficha de cliente a la que anotárselo.
    const client = clients.find((c) => c.id === a.clientId);
    if (!client) return;
    setDecision({ client, cita: a, desenlace: d });
  }

  // Ojo: la tarjeta desaparece en cuanto se marca la última cita, pero el
  // diálogo de la deuda NO puede irse con ella — si se desmonta, la pregunta
  // por el dinero no llega a verse nunca. Por eso el diálogo vive fuera.
  return (
    <>
      {pendientes.length > 0 && (
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-[var(--warning)]/50 bg-[var(--warning)]/10",
            className,
          )}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--warning)]/25 px-4 py-3">
            <HelpCircle className="size-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-display text-base leading-tight">
                ¿Qué pasó con{" "}
                {pendientes.length === 1 ? "esta cita" : `estas ${pendientes.length} citas`}?
              </p>
              <p className="text-xs text-muted-foreground">
                Ya pasaron y no has dicho si vinieron. Márcalo y te aviso si alguien te queda a
                deber.
              </p>
            </div>
          </div>
          <div className="divide-y divide-[var(--warning)]/20">
            {visibles.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.clientName || "Sin nombre"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(a.start).toLocaleString("es", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {serviceLabelOf(a)}
                    {employeeMap[a.employeeId] ? ` · con ${employeeMap[a.employeeId].name}` : ""}
                  </p>
                </div>
                <BotonesDesenlace actual={a.status} onElegir={(d) => elegir(a, d)} />
              </div>
            ))}
          </div>
          {pendientes.length > visibles.length && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Y {pendientes.length - visibles.length} más. Ve marcando: desaparecen solas de aquí.
            </p>
          )}
        </div>
      )}

      <DecisionDeudaDialog
        client={decision?.client}
        cita={decision?.cita}
        desenlace={decision?.desenlace ?? "no-vino"}
        open={!!decision}
        onOpenChange={(o) => !o && setDecision(null)}
      />
    </>
  );
}
