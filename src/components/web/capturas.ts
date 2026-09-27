/**
 * Capturas reales del producto (demo de PeluChic) que ilustran la web, ya
 * convertidas a WebP en `public/web/capturas/`. `anchos` son las variantes
 * que existen; `ancho`×`alto` es la proporción de la mayor, para reservar el
 * hueco antes de que cargue la imagen (sin saltos de maquetación).
 */
export type NombreCaptura =
  | "hoy"
  | "calendario-dia"
  | "calendario-semana"
  | "caja"
  | "ficha"
  | "asistente"
  | "historial"
  | "accesos"
  | "google-calendar"
  | "movil-reserva-servicio"
  | "movil-reserva-estilista"
  | "movil-hoy"
  | "movil-calendario";

export interface Captura {
  anchos: number[];
  ancho: number;
  alto: number;
  alt: string;
}

export const CAPTURAS: Record<NombreCaptura, Captura> = {
  hoy: {
    anchos: [800, 1600],
    ancho: 1600,
    alto: 1000,
    alt: "Pantalla Hoy del panel de siShow: 16 citas, huecos libres, ingresos del día y tres solicitudes que esperan confirmación.",
  },
  "calendario-dia": {
    anchos: [800, 1600],
    ancho: 1600,
    alto: 1000,
    alt: "Calendario del día con una columna por profesional, María, Sara y Noelia, y cada cita coloreada según el servicio.",
  },
  "calendario-semana": {
    anchos: [800, 1600],
    ancho: 1600,
    alto: 1000,
    alt: "Calendario de la semana del salón con las citas de todo el equipo, de lunes a domingo.",
  },
  caja: {
    anchos: [800, 1600],
    ancho: 1600,
    alto: 1000,
    alt: "Caja del día: total cobrado, reparto entre efectivo, tarjeta y Bizum, cobros por hora y cierre del día.",
  },
  ficha: {
    anchos: [437, 874],
    ancho: 874,
    alto: 2240,
    alt: "Ficha de la clienta Elena Martín con su último color (decoloración con oxidante de 20 volúmenes, 35 minutos; matiz 9.1) y el historial de visitas.",
  },
  asistente: {
    anchos: [438, 876],
    ancho: 876,
    alto: 1160,
    alt: "Asistente del salón respondiendo qué color lleva Elena Martín y cuánto se ha cobrado hoy: 320 € de 615 €.",
  },
  historial: {
    anchos: [600, 1200],
    ancho: 1200,
    alto: 372,
    alt: "Historial de cambios: María confirmó la cita de Marisol a las 12:40, con el botón Deshacer al lado.",
  },
  accesos: {
    anchos: [600, 1200],
    ancho: 1200,
    alto: 574,
    alt: "Ajustes de accesos: María es gerente, Sara y Noelia son estilistas y Laura es subencargada.",
  },
  "google-calendar": {
    anchos: [768],
    ancho: 768,
    alto: 238,
    alt: "Calendario del salón conectado a Google, con las opciones de bloquear huecos personales y escribir las citas en Google.",
  },
  "movil-reserva-servicio": {
    anchos: [390, 780],
    ancho: 780,
    alto: 1688,
    alt: "Web de reservas del salón en el móvil: la clienta elige Mechas / balayage, 120 minutos, 80 €.",
  },
  "movil-reserva-estilista": {
    anchos: [390, 780],
    ancho: 780,
    alto: 1688,
    alt: "Web de reservas en el móvil: la clienta elige estilista o cualquiera disponible.",
  },
  "movil-hoy": {
    anchos: [390, 780],
    ancho: 780,
    alto: 1688,
    alt: "Panel de siShow en el móvil: saludo, citas de hoy, huecos libres, ingresos y lo que te espera.",
  },
  "movil-calendario": {
    anchos: [390, 780],
    ancho: 780,
    alto: 1688,
    alt: "Calendario semanal de siShow en el móvil, con el día de hoy marcado.",
  },
};

export function rutaCaptura(nombre: NombreCaptura, ancho: number): string {
  return `/web/capturas/${nombre}-${ancho}.webp`;
}
