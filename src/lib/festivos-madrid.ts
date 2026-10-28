/**
 * Festivos de Madrid capital para 2026 y 2027 (nacionales + Comunidad de
 * Madrid + locales del Ayuntamiento), usados por el aviso de «domingo o
 * festivo» de la reserva web.
 *
 * Fechas «YYYY-MM-DD». Los domingos NO se listan: se detectan aparte.
 *
 * FUENTES
 * - 2026, Comunidad de Madrid: Decreto 75/2025, de 24 de septiembre (BOCM de
 *   25-09-2025). Texto leído del anexo. Incluye los traslados del 2 de noviembre
 *   y del 7 de diciembre.
 * - 2027, Comunidad de Madrid: Decreto 82/2026, de 30 de septiembre (BOCM de
 *   01-10-2026). Fechas tomadas de una nota de prensa (Time Out Madrid) que
 *   resume el decreto; el texto del decreto NO se ha leído directamente.
 *   TODO(verificar con el BOCM del 01-10-2026) antes de fiarse del todo.
 * - Locales de Madrid capital 2026: San Isidro (15 mayo) y La Almudena
 *   (9 noviembre). TODO(verificar): salen de fuentes secundarias que los dan
 *   como los de siempre; no se ha leído el acuerdo del Pleno.
 * - Locales de Madrid capital 2027: el Pleno del 29-09-2026 aprobó los dos,
 *   pero NO se ha podido confirmar qué días son. TODO: añadirlos aquí (no se
 *   inventan). Mientras tanto no hay locales de 2027 en la lista.
 */

export interface Festivo {
  fecha: string;
  nombre: string;
  ambito: "nacional" | "comunidad" | "local";
}

export const FESTIVOS_MADRID: Festivo[] = [
  // 2026 — Decreto 75/2025
  { fecha: "2026-01-01", nombre: "Año Nuevo", ambito: "nacional" },
  { fecha: "2026-01-06", nombre: "Epifanía del Señor", ambito: "nacional" },
  { fecha: "2026-04-02", nombre: "Jueves Santo", ambito: "comunidad" },
  { fecha: "2026-04-03", nombre: "Viernes Santo", ambito: "nacional" },
  { fecha: "2026-05-01", nombre: "Fiesta del Trabajo", ambito: "nacional" },
  { fecha: "2026-05-02", nombre: "Fiesta de la Comunidad de Madrid", ambito: "comunidad" },
  { fecha: "2026-05-15", nombre: "San Isidro (local Madrid) — TODO verificar", ambito: "local" },
  { fecha: "2026-08-15", nombre: "Asunción de la Virgen", ambito: "nacional" },
  { fecha: "2026-10-12", nombre: "Fiesta Nacional de España", ambito: "nacional" },
  { fecha: "2026-11-02", nombre: "Traslado de Todos los Santos", ambito: "comunidad" },
  { fecha: "2026-11-09", nombre: "La Almudena (local Madrid) — TODO verificar", ambito: "local" },
  { fecha: "2026-12-07", nombre: "Traslado del Día de la Constitución", ambito: "comunidad" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepción", ambito: "nacional" },
  { fecha: "2026-12-25", nombre: "Natividad del Señor", ambito: "nacional" },
  // 2027 — Decreto 82/2026 (ver TODO arriba)
  { fecha: "2027-01-01", nombre: "Año Nuevo", ambito: "nacional" },
  { fecha: "2027-01-06", nombre: "Epifanía del Señor", ambito: "nacional" },
  { fecha: "2027-03-19", nombre: "San José", ambito: "comunidad" },
  { fecha: "2027-03-25", nombre: "Jueves Santo", ambito: "comunidad" },
  { fecha: "2027-03-26", nombre: "Viernes Santo", ambito: "nacional" },
  { fecha: "2027-05-01", nombre: "Fiesta del Trabajo", ambito: "nacional" },
  { fecha: "2027-08-16", nombre: "Traslado de la Asunción", ambito: "comunidad" },
  { fecha: "2027-10-12", nombre: "Fiesta Nacional de España", ambito: "nacional" },
  { fecha: "2027-11-01", nombre: "Todos los Santos", ambito: "nacional" },
  { fecha: "2027-12-06", nombre: "Día de la Constitución", ambito: "nacional" },
  { fecha: "2027-12-08", nombre: "Inmaculada Concepción", ambito: "nacional" },
  { fecha: "2027-12-25", nombre: "Natividad del Señor", ambito: "nacional" },
];

const POR_FECHA = new Map(FESTIVOS_MADRID.map((f) => [f.fecha, f]));

export function festivoEn(dateKey: string): Festivo | undefined {
  return POR_FECHA.get(dateKey);
}

/** Domingo de una fecha «YYYY-MM-DD» (sin depender de la zona horaria). */
export function esDomingo(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

export function esDomingoOFestivo(dateKey: string): boolean {
  return esDomingo(dateKey) || POR_FECHA.has(dateKey);
}

/** Correo del aviso: el de ajustes y, si no, el de contacto del perfil (privacidad). */
export function correoAvisoFestivos(p: {
  correoDomingosFestivos?: string;
  correoPrivacidad?: string;
}): string | undefined {
  return p.correoDomingosFestivos?.trim() || p.correoPrivacidad?.trim() || undefined;
}

export function textoAvisoFestivo(correo: string | undefined): string {
  return correo
    ? `Es domingo o festivo: tiene costes especiales. Escríbenos a ${correo} para pedir precio y hora.`
    : "Es domingo o festivo: tiene costes especiales. Escríbenos para pedir precio y hora.";
}
