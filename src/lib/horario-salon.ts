import type { DiaEspecial } from "./mock/types";
import { parseFranjasEspeciales, parseRanges, type Range } from "./opening-hours";
import { diaEspecialDe, weekdayDeFecha } from "./horario-equipo";

export type AvisoHorarioSalon =
  | { tipo: "cerrado"; mensaje: "Ese día el salón está cerrado" }
  | { tipo: "fuera"; mensaje: string; horario: string };

function minutos(hora: string): number | null {
  const match = hora.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
}

function hhmm(valor: number): string {
  const minutoDelDia = ((valor % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutoDelDia / 60)).padStart(2, "0")}:${String(minutoDelDia % 60).padStart(2, "0")}`;
}

function textoFranjas(franjas: Range[]): string {
  return franjas.map((franja) => `${hhmm(franja.start)}–${hhmm(franja.end)}`).join(", ");
}

/** Horario del salón que manda en una fecha: la excepción sustituye a la semana. */
export function franjasSalonEnFecha(
  openingHours: string[] | undefined,
  diasEspeciales: DiaEspecial[] | undefined,
  fecha: string,
): Range[] {
  const especial = diaEspecialDe(diasEspeciales, fecha);
  if (especial?.cerrado) return [];
  if (especial?.franjas?.length) {
    return especial.franjas.flatMap((franja) =>
      parseFranjasEspeciales(`${franja.inicio}–${franja.fin}`),
    );
  }
  if (especial?.soloProfesionales) {
    return Object.values(especial.soloProfesionales).flatMap((franjas) =>
      franjas.flatMap((franja) => parseFranjasEspeciales(`${franja.inicio}–${franja.fin}`)),
    );
  }
  if (!openingHours || openingHours.length !== 7) return [];
  const indiceLunes = (weekdayDeFecha(fecha) + 6) % 7;
  return parseRanges(openingHours[indiceLunes]);
}

/**
 * Aviso puro para citas fuera del horario general del salón. No comprueba el
 * turno de una profesional: esa es otra regla y se muestra por separado.
 */
export function avisoHorarioSalon({
  openingHours,
  diasEspeciales,
  fecha,
  hora,
  duracionMin,
}: {
  openingHours: string[] | undefined;
  diasEspeciales: DiaEspecial[] | undefined;
  fecha: string;
  hora: string;
  duracionMin: number;
}): AvisoHorarioSalon | null {
  const inicio = minutos(hora);
  if (inicio === null || !Number.isFinite(duracionMin) || duracionMin <= 0) return null;

  const franjas = franjasSalonEnFecha(openingHours, diasEspeciales, fecha);
  if (!franjas.length) return { tipo: "cerrado", mensaje: "Ese día el salón está cerrado" };
  if (franjas.some((franja) => inicio >= franja.start && inicio + duracionMin <= franja.end)) {
    return null;
  }
  const horario = textoFranjas(franjas);
  return {
    tipo: "fuera",
    horario,
    mensaje: `Fuera del horario del salón (${horario})`,
  };
}
