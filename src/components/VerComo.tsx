import { Eye } from "lucide-react";
import { useAccesosDemo, NOMBRE_ROL } from "@/lib/accesos-maqueta";
import { useEsDemo, useMiembroActual, usePlanSalon } from "@/lib/accesos-panel";
import { NOMBRE_PLAN, PLANES, muestraConmutadorDePlan, type PlanSishow } from "@/lib/plan";
import { useSalonStore } from "@/lib/store";
import { PLAN_DEL_CLIENTE_DE_DEMO, esVistaCliente, tieneVistaCliente, useVistaDemo } from "@/lib/vista-demo";
import { cn } from "@/lib/utils";

/**
 * «Ver como» (lote 11): solo en una demo, para enseñar el panel desde cada
 * miembro (la gerente, una estilista, la subencargada) sin crear cuentas.
 * En un salón real no existe.
 */
export function VerComo({ className, apilado = false }: { className?: string; apilado?: boolean }) {
  const esDemo = useEsDemo();
  const miembros = useAccesosDemo((s) => s.miembros);
  const setVerComo = useAccesosDemo((s) => s.setVerComo);
  const actual = useMiembroActual();
  const plan = usePlanSalon();
  const slug = useSalonStore((s) => s.salonProfile.slug);
  const vista = useVistaDemo((s) => s.vista);
  const fijarVista = useVistaDemo((s) => s.fijar);
  const conmutador = useSalonStore((s) => muestraConmutadorDePlan({ realSalonSlug: s.realSalonSlug, slug: s.salonProfile.slug, resolucion: s.publicBookingResolution, vista }));
  if (!esDemo || !miembros || !actual) return null;
  const activos = miembros.filter((m) => m.estado === "activa");
  // Lote 13: en la demo también se elige el plan, para enseñar lo que abre cada uno.
  const cambiarPlan = (p: PlanSishow) => useSalonStore.getState().updateSalonProfile({ plan: p });
  return (
    <label
      className={cn(
        "min-h-[42px] flex-wrap items-center gap-x-2 gap-y-0.5 border border-dashed border-salvia bg-salvia-suave text-[13px] font-bold text-hoja-tinta",
        // Apilado: el sitio fijo del pie del menú lateral, que no depende del ancho de la ventana.
        apilado ? "flex flex-col items-stretch gap-1 rounded-2xl px-3 py-2" : "rounded-full py-1 pr-2 pl-3.5",
        className,
      )}
      title="Solo en la demo: mira el panel como lo vería cada persona del salón"
    >
      <span className="flex shrink-0 items-center gap-2">
        <Eye className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
        Ver como
      </span>
      <select
        value={actual.userId}
        onChange={(e) => setVerComo(e.target.value)}
        aria-label="Ver el panel como"
        className={cn("min-w-[5rem] flex-1 cursor-pointer rounded-full bg-transparent py-1 pr-1 text-[13px] font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40", apilado && "w-full flex-none")}
      >
        {activos.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.displayName} · {NOMBRE_ROL[m.rol]}
          </option>
        ))}
      </select>
      {conmutador && !apilado && <span className="h-5 w-px shrink-0 bg-salvia" aria-hidden="true" />}
      {conmutador && <select
        value={plan}
        onChange={(e) => cambiarPlan(e.target.value as PlanSishow)}
        aria-label="Plan de la demo"
        className={cn("min-w-0 max-w-[9.5rem] cursor-pointer rounded-full bg-transparent py-1 pr-1 text-[13px] font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40", apilado && "w-full max-w-none")}
      >
        {PLANES.map((p) => (
          <option key={p} value={p}>
            {NOMBRE_PLAN[p]}
          </option>
        ))}
      </select>}
      {tieneVistaCliente(slug) && (
        <button
          type="button"
          onClick={() => {
            const siguiente = esVistaCliente(slug, vista) ? "prospecto" : "cliente";
            fijarVista(slug, siguiente);
            if (siguiente === "cliente") cambiarPlan(PLAN_DEL_CLIENTE_DE_DEMO[slug]);
          }}
          className={cn("shrink-0 rounded-full px-2 text-[12px] font-bold underline underline-offset-2 hover:bg-salvia-clara", apilado && "self-start px-0 text-left")}
        >
          {esVistaCliente(slug, vista) ? "Vista de prospecto (con selector)" : "Vista del salón"}
        </button>
      )}
    </label>
  );
}

/** Plan contratado, solo informativo: lo que ve un salón real en lugar del conmutador de las demos. */
export function PlanContratado({ className }: { className?: string }) {
  const real = useSalonStore((s) => !!s.realSalonSlug);
  const plan = usePlanSalon();
  if (!real) return null;
  return (
    <span className={cn("inline-flex h-[34px] items-center rounded-full bg-salvia-suave px-3 text-[13px] font-bold text-hoja-tinta", className)} title="El plan que tienes contratado">
      Plan {NOMBRE_PLAN[plan]}
    </span>
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
