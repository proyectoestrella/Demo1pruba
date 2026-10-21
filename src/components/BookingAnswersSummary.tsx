import { inferBusinessType } from "@/lib/business-type";
import { respuestasLegibles } from "@/lib/preguntas-reserva";
import { useSalonStore } from "@/lib/store";
import type { BookingAnswers } from "@/lib/mock/types";

/**
 * Respuestas de la clienta al reservar, con el texto de SU pregunta según el
 * formulario del salón (lib/preguntas-reserva.ts). Lo usan el detalle de la
 * cita, la ventana de confirmar solicitudes, la hoja del día y la ficha.
 */
export function BookingAnswersSummary({ answers, formato = "compacto" }: { answers?: BookingAnswers; formato?: "compacto" | "hoja" }) {
  const perfil = useSalonStore((s) => s.salonProfile);
  const lineas = respuestasLegibles(perfil, inferBusinessType(perfil.tagline, perfil.name), answers);
  if (!lineas.length) return null;
  if (formato === "hoja") return (
    <dl className="space-y-2 rounded-xl bg-nata/60 px-3 py-2 text-[12.5px] leading-snug text-cafe-medio" aria-label="Respuestas al reservar">
      {lineas.map((r) => <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_minmax(40px,0.3fr)] items-baseline gap-3">
        <dt className="min-w-0">{r.pregunta}</dt>
        <dd className="min-w-0 break-words text-right font-semibold text-cafe">{r.respuesta}</dd>
      </div>)}
    </dl>
  );
  return <div className="space-y-0.5 text-xs text-muted-foreground" aria-label="Respuestas al reservar">
    {lineas.map((r) => <p key={r.id}><span className="font-medium text-foreground/80">{r.pregunta}</span> {r.respuesta}</p>)}
  </div>;
}
