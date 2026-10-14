import { Ban, Check, CheckCheck, Clock3, TriangleAlert, UserX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/mock/types";

/**
 * Chips de estado «Arena» (DESIGN.md): lo pendiente de la dueña va con borde
 * discontinuo moca, lo confirmado y lo resuelto en salvia (acento verde 9c), los avisos en melocotón y el resto
 * en nata. Nunca un color de alarma para lo que solo está pendiente.
 */
const STATUS_CONFIG: Record<AppointmentStatus, { label: string; className: string; Icono?: LucideIcon }> = {
  pending: { Icono: Clock3,
    label: "Por confirmar",
    className: "border-[1.5px] border-dashed border-moca bg-card text-primary",
  },
  confirmed: { Icono: Check, label: "Confirmada", className: "bg-salvia-suave text-hoja-tinta" },
  completed: { Icono: CheckCheck, label: "Vino", className: "bg-salvia-clara text-hoja-tinta" },
  cancelled: { Icono: Ban, label: "Cancelada", className: "bg-nata text-muted-foreground line-through" },
  late: { Icono: TriangleAlert, label: "Tarde sin avisar", className: "bg-melocoton text-melocoton-tinta" },
  "no-show": { Icono: UserX, label: "No vino", className: "bg-melocoton text-melocoton-tinta" },
  // "blocked" exists in the type but isn't currently used by any seed/UI; kept for completeness.
  blocked: { label: "Bloqueado", className: "bg-nata text-muted-foreground" },
};

export interface StatusBadgeProps {
  status: AppointmentStatus;
  className?: string;
}

/** Low-contrast status pill for appointments. See DESIGN-DIRECTION §2.3. Spanish labels. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const { Icono } = cfg;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-bold whitespace-nowrap",
        cfg.className,
        className,
      )}
    >
      {Icono && <Icono className="size-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />}
      {cfg.label}
    </span>
  );
}
