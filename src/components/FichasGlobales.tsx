import { useSalonStore } from "@/lib/store";
import { useFichaAbierta, useFichas } from "@/lib/use-fichas";
import { ClientHistorySheet } from "@/components/ClientHistorySheet";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";

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
    <>
      <ClientHistorySheet client={clienta} open={!!clienta} onOpenChange={(o) => !o && cerrar()} />
      <AppointmentDetailSheet appointment={cita} open={!!cita} onOpenChange={(o) => !o && cerrar()} />
    </>
  );
}
