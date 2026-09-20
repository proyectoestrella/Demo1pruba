import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/mock/types";

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: {
    label: "Pendiente de confirmar",
    className: "bg-[var(--warning)]/15 text-[var(--warning)]",
  },
  confirmed: { label: "Confirmada", className: "bg-primary/10 text-primary" },
  completed: { label: "Vino", className: "bg-success/15 text-success" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
  late: {
    label: "Tarde sin avisar",
    className: "bg-[var(--warning)]/15 text-[var(--warning)]",
  },
  "no-show": { label: "No vino", className: "bg-destructive/15 text-destructive" },
  // "blocked" exists in the type but isn't currently used by any seed/UI; kept for completeness.
  blocked: { label: "Bloqueado", className: "bg-muted text-muted-foreground" },
};

export interface StatusBadgeProps {
  status: AppointmentStatus;
  className?: string;
}

/** Low-contrast status pill for appointments. See DESIGN-DIRECTION §2.3. Spanish labels. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
