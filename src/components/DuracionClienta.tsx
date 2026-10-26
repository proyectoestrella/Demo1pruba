import { useState } from "react";
import { Clock3, X } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { EtiquetaFicha } from "@/components/FichaCompleta";

/**
 * «Su tiempo» en la ficha de la clienta (pedido por PeluChic el 22-oct: «hay
 * unas que tardan más»). Lo que se apunta aquí manda sobre la carta y sobre
 * «la última vez» cuando el panel propone la duración de una cita suya.
 */
export function DuracionClienta({ clientId, editable }: { clientId: string; editable: boolean }) {
  const services = useSalonStore((s) => s.services);
  const todas = useSalonStore((s) => s.salonProfile.duracionClientas);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const propias = todas?.[clientId] ?? {};
  const filas = Object.entries(propias)
    .map(([id, min]) => ({ id, min, servicio: services.find((s) => s.id === id) }))
    .filter((f) => f.servicio && f.min > 0);
  const [servicioId, setServicioId] = useState("");
  const [minutos, setMinutos] = useState("");

  function guardar(siguiente: Record<string, number>) {
    const resto = { ...(useSalonStore.getState().salonProfile.duracionClientas ?? {}) };
    if (Object.keys(siguiente).length) resto[clientId] = siguiente;
    else delete resto[clientId];
    updateSalonProfile({ duracionClientas: resto });
  }
  const min = Math.round(Number(minutos));
  const valido = !!servicioId && Number.isFinite(min) && min >= 5 && min <= 600;
  const elegibles = services.filter((s) => s.active !== false && !(s.id in propias));
  const extra = Number(propias["*"]) || 0;

  if (!editable && filas.length === 0) return null;
  return (
    <section className="mt-3 rounded-2xl bg-card px-4 pb-4 pt-1">
      <EtiquetaFicha id="tiempo-clienta">Su tiempo</EtiquetaFicha>
      <p className="mb-2 text-xs text-muted-foreground">
        Si tarda más (o menos) que la carta en algún servicio. Se propone solo al darle cita.
      </p>
      {filas.length > 0 && (
        <ul className="mb-2 divide-y divide-border/60" aria-labelledby="tiempo-clienta">
          {filas.map((f) => (
            <li key={f.id} className="flex min-h-11 items-center gap-2 text-sm">
              <Clock3 className="size-4 shrink-0 text-cafe-suave" strokeWidth={1.7} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{f.servicio!.name}</span>
              <span className="tabular-nums font-bold">{f.min} min</span>
              <span className="text-xs text-muted-foreground tabular-nums">(carta {f.servicio!.durationMin})</span>
              {editable && (
                <button
                  type="button"
                  aria-label={`Quitar su tiempo de ${f.servicio!.name}`}
                  onClick={() => {
                    const { [f.id]: _fuera, ...resto } = propias;
                    guardar(resto);
                  }}
                  className="grid size-11 place-items-center rounded-full hover:bg-muted"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <label className="mb-2 flex min-h-11 flex-wrap items-center gap-2 text-sm">
        <span>Tarda más en cualquier servicio: +</span>
        <input
          aria-label="Minutos de más en cualquier servicio"
          inputMode="numeric"
          disabled={!editable}
          defaultValue={extra || ""}
          placeholder="0"
          onBlur={(e) => {
            const n = Math.min(240, Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, "")) || 0)));
            if (n === extra) return;
            const { ["*"]: _quitado, ...resto } = propias;
            guardar(n ? { ...resto, "*": n } : resto);
          }}
          className="h-11 w-20 rounded-xl border border-border bg-background px-3 text-sm tabular-nums"
        />
        <span>min</span>
      </label>
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Servicio"
            value={servicioId}
            onChange={(e) => {
              setServicioId(e.target.value);
              const s = services.find((x) => x.id === e.target.value);
              if (s && !minutos) setMinutos(String(s.durationMin));
            }}
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="">Elige un servicio…</option>
            {elegibles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMin} min)
              </option>
            ))}
          </select>
          <input
            aria-label="Minutos que tarda ella"
            inputMode="numeric"
            value={minutos}
            onChange={(e) => setMinutos(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="min"
            className="h-11 w-20 rounded-xl border border-border bg-background px-3 text-sm tabular-nums"
          />
          <button
            type="button"
            disabled={!valido}
            onClick={() => {
              guardar({ ...propias, [servicioId]: min });
              setServicioId("");
              setMinutos("");
            }}
            className="h-11 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      )}
    </section>
  );
}
