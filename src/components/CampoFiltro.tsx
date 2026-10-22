import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/** Buscador de listas compartido: 44 px en móvil, 42 px en escritorio. */
export function CampoFiltro({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <label
      className={cn(
        "flex h-11 w-full items-center gap-2 rounded-full border border-input bg-card px-3.5 text-muted-foreground lg:h-[42px] lg:w-[360px]",
        className,
      )}
    >
      <Search className="size-[18px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
      <input
        {...props}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
