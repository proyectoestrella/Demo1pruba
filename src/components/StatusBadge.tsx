import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/mock/types";

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; className: string }> = {
  confirmed: { label: "Confirmada", className: "bg-primary/10 text-primary" },
  completed: { label: "Completada", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
  "no-show": { label: "No asistió", className: "bg-amber-100 text-amber-800" },
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
