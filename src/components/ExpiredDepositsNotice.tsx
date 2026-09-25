import type { Appointment } from "@/lib/mock/types";
import { useClientNow } from "@/lib/use-client-now";
import { useCitasVisibles } from "@/lib/accesos-panel";
import { useSalonStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { estadoSenal } from "@/lib/senal";

/**
 * Aviso de Hoy: señales pedidas cuyo plazo pasó sin recibirlas (9j). Nunca
 * libera nada solo (salvo con la liberación automática, que es de BACKEND):
 * lleva a la cita, donde la dueña da más tiempo o libera el hueco.
 */
export function ExpiredDepositsNotice({ onOpenDetail }: { onOpenDetail: (appointment: Appointment) => void }) {
  const appointments = useCitasVisibles();
  const now = useClientNow();
  if (!now) return null;
  const vencidas = appointments.filter((a) => estadoSenal(a, now) === "vencida");
  if (!vencidas.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-melocoton-borde bg-melocoton px-4 py-3">
      <div>
        <p className="font-bold text-melocoton-tinta">
          {vencidas.length} {vencidas.length === 1 ? "señal vencida" : "señales vencidas"}
        </p>
        <p className="text-[12.5px] text-melocoton-tinta">Pasó el plazo sin recibirla. Da más tiempo o libera el hueco desde la cita.</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => onOpenDetail(vencidas[0])}>
        Ver {vencidas.length === 1 ? "la cita" : "la primera"}
      </Button>
    </div>
  );
}
