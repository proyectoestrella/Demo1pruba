/**
 * Colores que la dueña ha elegido en Ajustes (lote 9h): por servicio, un
 * índice de la paleta del calendario (1-6); por profesional, uno de los
 * cuatro pasteles (1-4). Lo que no elija sigue saliendo por posición.
 *
 * Registro de módulo en vez de pasarlo por cada llamada: las funciones de
 * color ya se usan en muchas pantallas con su firma de siempre. El armazón
 * del panel lo sincroniza con el perfil en cada render (es idempotente).
 */
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
  return n && n >= 1 && n <= 4 ? n : null;
}
