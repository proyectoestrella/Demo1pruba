import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned slot for primary/secondary actions (buttons, dropdowns...). Wraps below the title on mobile. */
  actions?: ReactNode;
  className?: string;
}

/** Título de página «Arena» (Manrope 800, 32 px) con sus acciones a la derecha; en móvil se apilan. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] text-foreground md:text-[32px]">
          {title}
        </h1>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
