import { parseRanges } from "./opening-hours";

const CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/**
 * El horario de la semana en una línea, agrupando días seguidos con las
 * mismas horas: «Mar–Vie 10:00–20:00 · Sáb 9:00–14:00». Recibe siete
 * textos de lunes a domingo («10:00–20:00», «Cerrado»…).
 */
export function resumenHorario(semana: (string | undefined)[]): string {
  const franja = (d: number) =>
    parseRanges(semana[d])
      .map((r) => `${hhmm(r.start)}–${hhmm(r.end)}`)
      .join(" y ");
  const trozos: string[] = [];
  let d = 0;
  while (d < 7) {
    const f = franja(d);
    if (!f) {
      d++;
      continue;
    }
    let hasta = d;
    while (hasta + 1 < 7 && franja(hasta + 1) === f) hasta++;
    const dias = hasta === d ? CORTOS[d] : hasta === d + 1 ? `${CORTOS[d]} y ${CORTOS[hasta]}` : `${CORTOS[d]}–${CORTOS[hasta]}`;
    trozos.push(`${dias} ${f}`);
    d = hasta + 1;
  }
  return trozos.length ? trozos.join(" · ") : "No trabaja ningún día";
}
