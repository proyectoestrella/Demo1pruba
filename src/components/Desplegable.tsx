import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Divulgación progresiva de las fichas (guía de diseño §6): un título que dice
 * lo que se encontrará, un resumen de una línea y el contenido plegado.
 * Sin cajas: solo un filete fino entre apartados.
 */
export function Desplegable({ titulo, resumen, children, abiertoAlInicio = false, className }: {
  titulo: string;
  resumen?: ReactNode;
  children: ReactNode;
  abiertoAlInicio?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  const id = useId();
  return (
    <section className={cn("border-t border-border/70 first:border-t-0", className)}>
      <h3>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={() => setAbierto((v) => !v)}
          className="flex min-h-12 w-full items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold">{titulo}</span>
            {resumen && !abierto && <span className="block truncate text-[12.5px] text-muted-foreground">{resumen}</span>}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-cafe-suave transition-transform", abierto && "rotate-180")} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </h3>
      {abierto && <div id={id} className="pb-4">{children}</div>}
    </section>
  );
}
