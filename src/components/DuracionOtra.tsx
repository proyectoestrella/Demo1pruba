import { useState } from "react";
import { DURACION_MAXIMA, DURACION_MINIMA, minutosPersonalizados } from "@/lib/hoy-arena";
import { cn } from "@/lib/utils";

/**
 * Chip «Otra…» junto a las duraciones propuestas: abre un campo de minutos
 * (de 5 en 5, de 5 min a 8 h). Al aplicarlo, esa duración pasa a ser la
 * elegida y sale como un chip más de la fila.
 */
export function DuracionOtra({
  onElegir,
  claseChip,
  etiqueta = "Otra…",
  abiertoAlInicio = false,
  onCancelar,
}: {
  onElegir: (minutos: number) => void;
  /** Clase del chip sin elegir, para que case con los de su fila. */
  claseChip: string;
  etiqueta?: string;
  abiertoAlInicio?: boolean;
  onCancelar?: () => void;
}) {
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const aplicar = () => {
    const r = minutosPersonalizados(texto);
    if ("error" in r) return setError(r.error);
    onElegir(r.minutos);
    setAbierto(false);
    setTexto("");
    setError(null);
  };
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={claseChip}>
        {etiqueta}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        autoFocus
        min={DURACION_MINIMA}
        max={DURACION_MAXIMA}
        step={5}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            aplicar();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            setAbierto(false);
            onCancelar?.();
          }
        }}
        aria-label="Minutos de la cita"
        aria-invalid={!!error}
        placeholder="min"
        className={cn("h-9 w-20 rounded-full border bg-blanco px-3 text-[13px] font-bold tabular-nums", error ? "border-melocoton-tinta" : "border-input")}
      />
      <button type="button" onClick={aplicar} className="h-9 rounded-full bg-primary px-3.5 text-[13px] font-bold text-primary-foreground">
        Usar
      </button>
      <button type="button" onClick={() => { setAbierto(false); onCancelar?.(); }} className="h-9 rounded-full px-2 text-[13px] font-bold text-cafe-medio hover:text-foreground">
        Cancelar
      </button>
      {error && (
        <span role="alert" className="basis-full text-[12.5px] text-melocoton-tinta">
          {error}
        </span>
      )}
    </span>
  );
}
