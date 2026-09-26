import { useMemo } from "react";
import { MessageCircle } from "lucide-react";
import { recordatorioSenal, reglaSenal, type RecordatorioSenal } from "@/lib/senal";
import { useSalonStore } from "@/lib/store";
import { useCitasVisibles } from "@/lib/accesos-panel";
import { Button } from "@/components/ui/button";
import type { Appointment } from "@/lib/mock/types";

/** Las señales pedidas a las que les queda menos de 1 hora, con su mensaje listo (14a). */
export function useRecordatoriosSenal(ahora: Date = new Date()): Array<{ cita: Appointment; r: RecordatorioSenal }> {
  const citas = useCitasVisibles();
  const clientes = useSalonStore((s) => s.clients);
  const perfil = useSalonStore((s) => s.salonProfile);
  // Lote 16: teléfonos en un mapa y cálculo memoizado al minuto (antes, un
  // `find` sobre todas las clientas por cada cita, en cada pintado de Hoy).
  const minuto = Math.floor(ahora.getTime() / 60_000);
  return useMemo(() => {
    const regla = reglaSenal(perfil);
    const telefonos = new Map(clientes.map((c) => [c.id, c.phone] as const));
    const momento = new Date(minuto * 60_000);
    return citas.flatMap((cita) => {
      const telefono = telefonos.get(cita.clientId) ?? "";
      if (!telefono) return [];
      const r = recordatorioSenal({ ...cita, clientPhone: telefono }, regla, { name: perfil.name }, momento);
      return r ? [{ cita, r }] : [];
    });
  }, [citas, clientes, perfil, minuto]);
}

/**
 * Hoy › Avisos: «A Lucía le quedan 35 min para el Bizum» con el WhatsApp de
 * un toque (recordatorioSenal de BACKEND). Si no llega, la señal se libera
 * sola al vencer (Ajustes › Señal).
 */
export function RecordatoriosSenal() {
  const lista = useRecordatoriosSenal();
  const abrir = useSalonStore((s) => s.abrirWhatsAppDeCita);
  if (!lista.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-[14px] font-extrabold">Señales a punto de vencer</h3>
      <ul className="divide-y divide-lino overflow-hidden rounded-2xl border border-lino bg-card">
        {lista.map(({ cita, r }) => (
          <li key={cita.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <p className="min-w-0 flex-1 text-[14px]">
              <b>{cita.clientName.split(" ")[0]}</b> tiene {r.minutosRestantes} min para el Bizum
              <span className="block text-[12.5px] text-muted-foreground">
                Cita a las {new Date(cita.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}. Si no llega, el hueco se libera solo.
              </span>
            </p>
            <Button size="sm" className="gap-1.5 rounded-full font-bold" onClick={() => abrir(cita.id, r.enlace)}>
              <MessageCircle className="size-4" strokeWidth={1.7} aria-hidden="true" />
              Recordárselo
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
