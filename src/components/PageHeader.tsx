import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned slot for primary/secondary actions (buttons, dropdowns...). Wraps below the title on mobile. */
  actions?: ReactNode;
  className?: string;
}

/** Título de página «Arena» (26 px móvil · 32 px desde md), igual en todas las pantallas, con sus acciones a la derecha; si no caben, bajan debajo del título y se reparten en filas (nunca se salen). */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  const descripcionVisible = description?.trim().replace(/\.$/, "") === "Todas las reservas de tu equipo"
    ? undefined
    : description;
  return (
    <div
      className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}
    >
      <div className="min-w-0 flex-[1_1_16rem]">
        <h1 className="truncate text-[26px] leading-[1.1] font-medium tracking-[-0.035em] text-foreground md:text-[32px]">
          {title}
        </h1>
        {descripcionVisible ? <p className="mt-1 text-muted-foreground">{descripcionVisible}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
