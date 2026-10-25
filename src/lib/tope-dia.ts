/**
 * Tope de citas al día por profesional para la reserva web (22-oct, PeluChic:
 * «nueve por tres sería el máximo»: nueve citas por cada una de las tres).
 * Solo cuentan las citas ya CONFIRMADAS (o en curso / atendidas): las
 * solicitudes pendientes no, para que nadie pueda llenar el día con reservas
 * falsas. El panel no tiene tope: la dueña puede meter las que quiera.
 */
export const TOPE_CITAS_DIA_POR_SALON: Record<string, number> = { peluchic: 9 };
export const ESTADOS_QUE_CUENTAN_PARA_TOPE = ["confirmed", "in-progress", "completed"] as const;

export function topeCitasDiaProfesional(perfil: { maxCitasDiaProfesional?: number | null }, slug: string): number | null {
  const propio = Number(perfil.maxCitasDiaProfesional);
  if (Number.isFinite(propio) && propio > 0) return Math.round(propio);
  return TOPE_CITAS_DIA_POR_SALON[slug] ?? null;
}

/** ¿Ya tiene esa profesional el día lleno de citas confirmadas? */
export function diaCompletoParaProfesional(
  citas: ReadonlyArray<{ employeeId: string; start: string; status: string }>,
  employeeId: string,
  fecha: string,
  fechaDe: (iso: string) => string,
  tope: number | null,
): boolean {
  if (!tope) return false;
  const n = citas.filter(
    (c) => c.employeeId === employeeId && (ESTADOS_QUE_CUENTAN_PARA_TOPE as readonly string[]).includes(c.status) && fechaDe(c.start) === fecha,
  ).length;
  return n >= tope;
}
