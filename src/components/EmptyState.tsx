import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Lucide icon component (not an element), e.g. `icon={CalendarX}`. */
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional primary action, e.g. a <Button>+ Nueva cita</Button>. */
  action?: ReactNode;
  className?: string;
}

/** Empty state for tables/lists with no data. See DESIGN-DIRECTION §2.5. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
