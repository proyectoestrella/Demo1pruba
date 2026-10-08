import type { SalonProfile } from "./mock/types";

/**
 * Proyección de la ficha que se entrega sin sesión. Los bloqueos y las
 * excepciones de horario sí se necesitan para no ofrecer horas falsas, pero
 * sus anotaciones son exclusivamente del equipo. Se construyen por lista
 * permitida para que un campo interno añadido mañana tampoco se filtre.
 */
export function perfilPublico(perfil: SalonProfile): SalonProfile {
  return {
    ...perfil,
    bloqueosAgenda: perfil.bloqueosAgenda?.map(({ id, profesionalId, inicio, fin, recurrente }) => ({
      id,
      profesionalId,
      inicio,
      fin,
      ...(recurrente ? { recurrente: { diaSemana: recurrente.diaSemana } } : {}),
    })),
    diasEspeciales: perfil.diasEspeciales?.map(({ fecha, cerrado, franjas, soloProfesionales }) => ({
      fecha,
      ...(cerrado ? { cerrado: true as const } : {}),
      ...(franjas ? { franjas: franjas.map(({ inicio, fin }) => ({ inicio, fin })) } : {}),
      ...(soloProfesionales
        ? {
            soloProfesionales: Object.fromEntries(
              Object.entries(soloProfesionales).map(([id, ranges]) => [
                id,
                ranges.map(({ inicio, fin }) => ({ inicio, fin })),
              ]),
            ),
          }
        : {}),
    })),
  };
}
