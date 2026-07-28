import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned slot for primary/secondary actions (buttons, dropdowns...). Wraps below the title on mobile. */
  actions?: ReactNode;
  className?: string;
}

/** Standard dashboard page title + actions row. Responsive: stacks on mobile, row on sm+. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-1 min-w-0">
        <h1 className="font-display text-2xl md:text-3xl tracking-tight text-foreground truncate">
          {title}
        </h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
