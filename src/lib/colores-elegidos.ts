/**
 * Colores que la dueña ha elegido en Ajustes (lote 9h): por servicio, un
 * índice de la paleta del calendario (1-6); por profesional, uno de los
 * siete tintes (1-7). Lo que no elija sigue saliendo por posición.
 *
 * Registro de módulo en vez de pasarlo por cada llamada: las funciones de
 * color ya se usan en muchas pantallas con su firma de siempre. El armazón
 * del panel lo sincroniza con el perfil en cada render (es idempotente).
 */
/** Tintes de profesional disponibles (--pro-1…7 en styles.css). */
export const PROFESIONAL_COLORES = 7;

/** Índice de color de la profesional: el elegido o, si no, por posición. */
export const indiceColorProfesional = (i: number, id?: string): number => colorElegidoProfesional(id) ?? (i % PROFESIONAL_COLORES) + 1;
/** Tinte de fondo (texto café encima) y borde saturado de 4 px. */
export const tinteProfesional = (i: number, id?: string) => `var(--pro-${indiceColorProfesional(i, id)})`;
export const bordeProfesional = (i: number, id?: string) => `var(--pro-${indiceColorProfesional(i, id)}-borde)`;

let porServicio: Record<string, number> = {};
let porProfesional: Record<string, number> = {};

export function sincronizarColores(servicio?: Record<string, number>, profesional?: Record<string, number>) {
  porServicio = servicio ?? {};
  porProfesional = profesional ?? {};
}

export function colorElegidoServicio(id: string | undefined): number | null {
  const n = id ? porServicio[id] : undefined;
  return n && n >= 1 && n <= 6 ? n : null;
}

export function colorElegidoProfesional(id: string | undefined): number | null {
  const n = id ? porProfesional[id] : undefined;
  return n && n >= 1 && n <= PROFESIONAL_COLORES ? n : null;
}
