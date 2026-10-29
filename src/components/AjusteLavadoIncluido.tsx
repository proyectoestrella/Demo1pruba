import { toast } from "sonner";
import { lavadoDe } from "@/lib/appointment-services";
import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { useSalonStore } from "@/lib/store";
import { Switch } from "@/components/ui/switch";

/**
 * Interruptor único del lavado incluido. Activo (lo de siempre): el lavado
 * suelto no se suma cuando va con un servicio que ya lo lleva (Color, Corte
 * con lavado…). Apagado: el lavado se cobra y se cuenta aparte SIEMPRE. Se
 * guarda en el perfil (`lavado`); sin tocarlo, manda lo deducido de la carta.
 */
export function AjusteLavadoIncluido() {
  const perfil = useSalonStore((s) => s.salonProfile);
  const services = useSalonStore((s) => s.services);
  const porDefecto = lavadoDe({ descripcionesServicios: perfil.descripcionesServicios }, services);
  const actual = lavadoDe(perfil, services);
  if (!porDefecto && !actual?.servicioId) return null;
  const activo = !!actual?.servicioId && (actual.incluidoEn?.length ?? 0) > 0;
  const cambiar = (v: boolean) => {
    // Apagar = `servicioId` vacío (explícito); encender = volver a lo deducido de la carta.
    guardarPerfil({ lavado: v ? undefined : { servicioId: "", incluidoEn: [] } });
    toast.success(v ? "Lavado incluido en los servicios que lo llevan" : "El lavado se cobra aparte en todas las reservas");
  };
  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-lino bg-card px-4 py-3">
      <div>
        <p className="text-sm font-bold">Lavado incluido en los servicios que lo llevan</p>
        <p className="text-xs text-muted-foreground">
          {activo
            ? "Ahora, si una cita junta el lavado con un servicio que ya lo incluye (por ejemplo el color), el lavado no suma precio ni tiempo. Apágalo para que el lavado cuente siempre aparte."
            : "Ahora el lavado cuenta aparte (precio y tiempo) en todas las reservas. Enciéndelo para que no sume cuando el servicio ya lo incluye."}
        </p>
      </div>
      <Switch aria-label="Lavado incluido en los servicios que lo llevan" checked={activo} onCheckedChange={cambiar} />
    </div>
  );
}
