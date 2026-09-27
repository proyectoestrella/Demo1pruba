import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Copia un texto al portapapeles y lo confirma en el propio botón durante dos
 * segundos (y a los lectores de pantalla, con aria-live). Si el navegador no
 * deja copiar, selecciona el texto para que se copie a mano.
 */
export function BotonCopiar({ texto, idTexto, className }: { texto: string; idTexto?: string; className?: string }) {
  const [estado, setEstado] = useState<"quieto" | "copiado" | "manual">("quieto");
  useEffect(() => {
    if (estado === "quieto") return;
    const t = window.setTimeout(() => setEstado("quieto"), 2200);
    return () => window.clearTimeout(t);
  }, [estado]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      const el = idTexto ? document.getElementById(idTexto) : null;
      if (el) {
        const rango = document.createRange();
        rango.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(rango);
      }
      setEstado("manual");
    }
  };

  return (
    <button type="button" onClick={copiar} className={cn("ws-boton ws-boton-s", className)}>
      {estado === "copiado" ? (
        <Check className="h-4 w-4 text-[color:var(--ws-hoja)]" strokeWidth={2.6} aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
      <span aria-live="polite">
        {estado === "copiado" ? "Copiado" : estado === "manual" ? "Seleccionado: cópialo" : "Copiar el correo"}
      </span>
    </button>
  );
}
