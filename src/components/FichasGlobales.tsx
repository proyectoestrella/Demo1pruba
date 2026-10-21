import { lazy, Suspense } from "react";
import { useSalonStore } from "@/lib/store";
import { useFichaAbierta, useFichas } from "@/lib/use-fichas";

const ClientHistorySheet = lazy(() =>
  import("@/components/ClientHistorySheet").then((m) => ({ default: m.ClientHistorySheet })),
);
const AppointmentDetailSheet = lazy(() =>
  import("@/components/AppointmentDetailSheet").then((m) => ({ default: m.AppointmentDetailSheet })),
);

/**
 * Las fichas de clienta y de cita, pintadas UNA vez para todo el panel y
 * dirigidas por la URL (`?clienta=<id>` / `?cita=<id>`). Desde cualquier
 * pantalla basta con `useFichas().abrirClienta(id)` o `.abrirCita(id)`.
 * Si el id no existe (aún no han cargado los datos, o ya no está), no se pinta
 * nada y la URL queda como estaba.
 */
export function FichasGlobales() {
  const ficha = useFichaAbierta();
  const { cerrar } = useFichas();
  const clienta = useSalonStore((s) => (ficha?.tipo === "clienta" ? (s.clients.find((c) => c.id === ficha.id) ?? null) : null));
  const cita = useSalonStore((s) => (ficha?.tipo === "cita" ? (s.appointments.find((a) => a.id === ficha.id) ?? null) : null));
  return (
    <Suspense fallback={null}>
      {clienta && <ClientHistorySheet client={clienta} open onOpenChange={(o) => !o && cerrar()} />}
      {cita && <AppointmentDetailSheet appointment={cita} open onOpenChange={(o) => !o && cerrar()} />}
    </Suspense>
  );
}
