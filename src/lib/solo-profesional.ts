/**
 * El salón de un solo profesional.
 *
 * Adam («THE BEST SHAVE & BARBER») es el único barbero de su barbería, y hasta
 * ahora el producto daba por hecho que siempre hay varios: la web le ofrecía
 * «Elige tu barbero» para elegir entre uno, el panel le pintaba columnas y
 * filtros «por profesional» que con una sola persona no significan nada, y
 * cada cita llevaba escrito «con Adam» como si pudiera ser con otro.
 *
 * Todo lo de aquí se deriva del ESTADO —cuántos profesionales activos hay—, no
 * de un interruptor manual ni del slug del salón. Con dos o más, todas estas
 * funciones devuelven exactamente el comportamiento de siempre, así que las
 * demos de venta con varios barberos no cambian ni un píxel.
 *
 * Módulo puro a propósito: sin React y sin store, para poder probarlo con
 * `bun test` sin montar nada.
 */

/** ¿Trabaja una sola persona en este salón? */
export function esSoloUnProfesional(equipo: { length: number } | number): boolean {
  return (typeof equipo === "number" ? equipo : equipo.length) === 1;
}

/* ---------------------------------------------------------------------- */
/* Pasos de la reserva pública                                            */
/* ---------------------------------------------------------------------- */

/**
 * La reserva tiene cuatro pantallas internas (servicio, profesional, fecha y
 * hora, datos). Con un solo profesional la segunda no tiene nada que
 * preguntar, así que se salta: el cliente ve tres pasos, no cuatro.
 *
 * Los números internos NO se renumeran —el paso «fecha y hora» sigue siendo el
 * 3 en el código— para no tocar la lógica de cada pantalla. Lo que cambia es
 * por dónde se navega y qué se pinta en la barra de progreso.
 */
export type PasoReserva = 1 | 2 | 3 | 4;

/** El paso del que se parte al abrir la reserva. */
export function pasoInicial(tieneServicios: boolean, soloUno: boolean): PasoReserva {
  if (!tieneServicios) return 1;
  return soloUno ? 3 : 2;
}

/** Siguiente paso, saltándose el del profesional cuando solo hay uno. */
export function siguientePaso(paso: PasoReserva, soloUno: boolean): PasoReserva {
  if (paso >= 4) return 4;
  const next = (paso + 1) as PasoReserva;
  return soloUno && next === 2 ? 3 : next;
}

/** Paso anterior, con el mismo salto en sentido contrario. */
export function pasoAnterior(paso: PasoReserva, soloUno: boolean): PasoReserva {
  if (paso <= 1) return 1;
  const prev = (paso - 1) as PasoReserva;
  return soloUno && prev === 2 ? 1 : prev;
}

/** Cuántos pasos ve el cliente: 4 de siempre, o 3 cuando solo hay un profesional. */
export function totalPasos(soloUno: boolean): number {
  return soloUno ? 3 : 4;
}

/**
 * Qué número de paso enseñar ("Paso 2 de 3"). Con un solo profesional, el
 * paso interno 3 es el 2º que ve el cliente y el 4 es el 3º.
 */
export function pasoVisible(paso: PasoReserva, soloUno: boolean): number {
  return soloUno && paso > 2 ? paso - 1 : paso;
}

/**
 * Rótulos de la barra de progreso. `palabra` es «barbero», «estilista» o
 * «profesional» según el oficio (ver `professionalWord`).
 */
export function rotulosDePaso(palabra: string, soloUno: boolean): string[] {
  const conProfesional = ["Servicio", cap(palabra), "Fecha y hora", "Tus datos"];
  return soloUno ? ["Servicio", "Fecha y hora", "Tus datos"] : conProfesional;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
