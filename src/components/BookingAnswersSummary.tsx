import { bookingAnswerLines } from "@/lib/booking-answers";
import type { BookingAnswers } from "@/lib/mock/types";

export function BookingAnswersSummary({ answers }: { answers?: BookingAnswers }) {
  const lines = bookingAnswerLines(answers);
  if (!lines.length) return null;
  return <div className="space-y-0.5 text-xs text-muted-foreground" aria-label="Respuestas al reservar">
    {lines.map((line) => <p key={line}>{line}</p>)}
  </div>;
}
