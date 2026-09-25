import { inferBusinessType } from "@/lib/business-type";
import { respuestasLegibles } from "@/lib/preguntas-reserva";
import { useSalonStore } from "@/lib/store";
import type { BookingAnswers } from "@/lib/mock/types";

/**
 * Respuestas de la clienta al reservar, con el texto de SU pregunta según el
 * formulario del salón (lib/preguntas-reserva.ts). Lo usan el detalle de la
 * cita, la ventana de confirmar solicitudes, la hoja del día y la ficha.
 */
export function BookingAnswersSummary({ answers }: { answers?: BookingAnswers }) {
  const perfil = useSalonStore((s) => s.salonProfile);
  const lineas = respuestasLegibles(perfil, inferBusinessType(perfil.tagline, perfil.name), answers);
  if (!lineas.length) return null;
  return <div className="space-y-0.5 text-xs text-muted-foreground" aria-label="Respuestas al reservar">
    {lineas.map((r) => <p key={r.id}><span className="font-medium text-foreground/80">{r.pregunta}</span> {r.respuesta}</p>)}
  </div>;
}
