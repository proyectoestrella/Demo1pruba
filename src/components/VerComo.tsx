import { Eye } from "lucide-react";
import { useAccesosDemo, NOMBRE_ROL } from "@/lib/accesos-maqueta";
import { useEsDemo, useMiembroActual, usePlanSalon } from "@/lib/accesos-panel";
import { NOMBRE_PLAN, PLANES, type PlanSishow } from "@/lib/plan";
import { useSalonStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * «Ver como» (lote 11): solo en una demo, para enseñar el panel desde cada
 * miembro (la gerente, una estilista, la subencargada) sin crear cuentas.
 * En un salón real no existe.
 */
export function VerComo({ className }: { className?: string }) {
  const esDemo = useEsDemo();
  const miembros = useAccesosDemo((s) => s.miembros);
  const setVerComo = useAccesosDemo((s) => s.setVerComo);
  const actual = useMiembroActual();
  const plan = usePlanSalon();
  if (!esDemo || !miembros || !actual) return null;
  const activos = miembros.filter((m) => m.estado === "activa");
  // Lote 13: en la demo también se elige el plan, para enseñar lo que abre cada uno.
  const cambiarPlan = (p: PlanSishow) => useSalonStore.getState().updateSalonProfile({ plan: p });
  return (
    <label
      className={cn(
        "h-[42px] items-center gap-2 rounded-full border border-dashed border-salvia bg-salvia-suave pr-2 pl-3.5 text-[13px] font-bold text-hoja-tinta",
        className,
      )}
      title="Solo en la demo: mira el panel como lo vería cada persona del salón"
    >
      <Eye className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      <span className="shrink-0">Ver como</span>
      <select
        value={actual.userId}
        onChange={(e) => setVerComo(e.target.value)}
        aria-label="Ver el panel como"
        className="min-w-0 flex-1 cursor-pointer rounded-full bg-transparent py-1 pr-1 text-[13px] font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {activos.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.displayName} · {NOMBRE_ROL[m.rol]}
          </option>
        ))}
      </select>
      <span className="h-5 w-px shrink-0 bg-salvia" aria-hidden="true" />
      <select
        value={plan}
        onChange={(e) => cambiarPlan(e.target.value as PlanSishow)}
        aria-label="Plan de la demo"
        className="min-w-0 max-w-[9.5rem] cursor-pointer rounded-full bg-transparent py-1 pr-1 text-[13px] font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {PLANES.map((p) => (
          <option key={p} value={p}>
            {NOMBRE_PLAN[p]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Franja fina mientras se ve la demo como alguien que no es la gerente. */
export function FranjaVerComo() {
  const esDemo = useEsDemo();
  const actual = useMiembroActual();
  const miembros = useAccesosDemo((s) => s.miembros);
  const setVerComo = useAccesosDemo((s) => s.setVerComo);
  if (!esDemo || !actual || actual.rol === "gerente") return null;
  const gerente = miembros?.find((m) => m.rol === "gerente" && m.estado === "activa");
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b border-salvia bg-salvia-suave px-4 py-1.5 text-center text-[13px] text-hoja-tinta" role="status">
      <span>
        Estás viendo el panel como <b>{actual.displayName}</b> ({NOMBRE_ROL[actual.rol].toLowerCase()}).
      </span>
      {gerente && (
        <button type="button" onClick={() => setVerComo(gerente.userId)} className="font-bold underline underline-offset-2">
          Volver a {gerente.displayName}
        </button>
      )}
    </div>
  );
}
