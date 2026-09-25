import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { acotarDuracion, duracionCorta, minutosPersonalizados } from "@/lib/hoy-arena";
import { cn } from "@/lib/utils";

/**
 * «Otra…» junto a las duraciones propuestas. Abre un control de horas y
 * minutos: dos selectores (0-8 h, 00-55 min de 5 en 5), −15 / +15 y un campo
 * para escribirla («2:30», «2 h 30» o «150»). Cada cambio se aplica al
 * momento: la duración elegida pasa a ser un chip más de la fila.
 */
export function DuracionOtra({
  valor,
  onElegir,
  claseChip,
  etiqueta = "Otra…",
  abiertoAlInicio = false,
  onCancelar,
}: {
  /** Duración elegida ahora, en minutos: de ella parten los selectores. */
  valor?: number;
  onElegir: (minutos: number) => void;
  /** Clase del chip sin elegir, para que case con los de su fila. */
  claseChip: string;
  etiqueta?: string;
  abiertoAlInicio?: boolean;
  /** Al cerrar el control («Listo» o Esc). */
  onCancelar?: () => void;
}) {
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const actual = acotarDuracion(valor ?? 60);
  const horas = Math.floor(actual / 60);
  const mins = actual % 60;
  const elegir = (m: number) => {
    onElegir(acotarDuracion(m));
    setError(null);
  };
  const aplicarTexto = () => {
    if (!texto.trim()) return;
    const r = minutosPersonalizados(texto);
    if ("error" in r) return setError(r.error);
    elegir(r.minutos);
    setTexto("");
  };
  const cerrar = () => {
    setAbierto(false);
    setTexto("");
    setError(null);
    onCancelar?.();
  };

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={claseChip}>
        {etiqueta}
      </button>
    );
  }

  const selector = "h-9 rounded-full border border-input bg-blanco pr-6 pl-2.5 text-[13px] font-bold tabular-nums text-cafe";
  const paso = "grid size-9 shrink-0 place-items-center rounded-full border border-input bg-card text-cafe-medio hover:bg-beige disabled:opacity-40";
  return (
    <div
      role="group"
      aria-label="Duración de la cita"
      className="flex basis-full flex-wrap items-center gap-1.5 rounded-2xl border border-lino bg-card px-2.5 py-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          cerrar();
        }
      }}
    >
      <span className="inline-flex items-center gap-1.5">
      <button type="button" className={paso} onClick={() => elegir(actual - 15)} disabled={actual <= 5} aria-label="Quitar 15 minutos">
        <Minus className="size-4" strokeWidth={1.8} />
      </button>
      <label className="inline-flex items-center gap-1 text-[13px] text-cafe-medio">
        <span className="sr-only">Horas</span>
        <select
          className={selector}
          value={horas}
          onChange={(e) => {
            const h = Number(e.target.value);
            elegir(h * 60 + (h === 8 ? 0 : h === 0 && mins === 0 ? 5 : mins));
          }}
        >
          {Array.from({ length: 9 }, (_, h) => (
            <option key={h} value={h}>
              {h} h
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex items-center gap-1 text-[13px] text-cafe-medio">
        <span className="sr-only">Minutos</span>
        <select className={selector} value={mins} onChange={(e) => elegir(horas * 60 + Number(e.target.value))} disabled={horas === 8}>
          {Array.from({ length: 12 }, (_, i) => i * 5)
            .filter((m) => !(horas === 0 && m === 0))
            .map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")} min
              </option>
            ))}
        </select>
      </label>
      <button type="button" className={paso} onClick={() => elegir(actual + 15)} disabled={actual >= 480} aria-label="Añadir 15 minutos">
        <Plus className="size-4" strokeWidth={1.8} />
      </button>
      </span>
      <span className="inline-flex items-center gap-1.5">
      <b className="px-1 text-[13px] text-cafe tabular-nums" aria-live="polite">
        {duracionCorta(actual)}
      </b>
      <input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            aplicarTexto();
          }
        }}
        onBlur={aplicarTexto}
        aria-label="Escribir la duración"
        aria-invalid={!!error}
        placeholder="o escribe 2:30"
        className={cn("h-9 w-[118px] rounded-full border bg-blanco px-3 text-[13px] tabular-nums", error ? "border-melocoton-tinta" : "border-input")}
      />
      <button type="button" onClick={cerrar} className="h-9 rounded-full px-2.5 text-[13px] font-bold text-cafe-medio hover:text-foreground">
        Listo
      </button>
      </span>
      {error && (
        <span role="alert" className="basis-full px-1 text-[12.5px] text-melocoton-tinta">
          {error}
        </span>
      )}
    </div>
  );
}
