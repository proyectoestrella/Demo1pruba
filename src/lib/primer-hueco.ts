/**
 * «Lo antes posible» en la reserva pública (lote 16).
 *
 * Bug visto por FRONTEND: un sábado a las 19:05 (el salón cierra a las 14:00)
 * el paso 3 ofrecía «Lo antes posible: hoy a las 12:30». La pantalla daba por
 * reservable cualquier hueco de HOY, también los que ya habían pasado: ni el
 * día se descartaba (quedaban huecos libres por la mañana) ni la lista de
 * horas se recortaba por «ahora». Aquí vive la regla, en puro y con tests.
 *
 * La comparación se hace entre INSTANTES (hora de la agenda en la zona del
 * salón → ISO → milisegundos), no entre minutos del día: así el cambio de
 * hora y un navegador en otra zona no la engañan.
 */
import { isoDelSalon } from "./zona-horaria";

/** Margen por defecto entre «ahora» y el primer hueco que se ofrece. */
export const ANTELACION_MINIMA_POR_DEFECTO = 30;

/** Antelación del perfil acotada (0-1440), o la de por defecto. */
export function antelacionMinima(valor: number | undefined | null): number {
  if (valor === undefined || valor === null || !Number.isFinite(valor)) return ANTELACION_MINIMA_POR_DEFECTO;
  return Math.min(Math.max(Math.round(valor), 0), 1440);
}

/** ¿El hueco «fecha a las hora» (agenda del salón) empieza a partir de ahora + antelación? */
export function huecoAunReservable(
  fecha: string,
  hora: string,
  timeZone: string,
  ahora: Date,
  antelacionMin = ANTELACION_MINIMA_POR_DEFECTO,
): boolean {
  return Date.parse(isoDelSalon(fecha, hora, timeZone)) >= ahora.getTime() + antelacionMin * 60_000;
}

/** Día de la semana (Date.getDay) de una fecha "YYYY-MM-DD", sin depender de la zona del proceso. */
export function diaSemanaDeFecha(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "YYYY-MM-DD" + n días, en calendario puro (sin horas ni zonas). */
export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Primer hueco reservable desde `hoy` (fecha del salón), mirando hasta
 * `dias` días. `huecosDelDia` da las horas libres de ese día en orden
 * ("HH:mm", ya filtradas por horario del salón y de la profesional y por
 * citas); un día cerrado devuelve []. Aquí solo se añade «después de ahora».
 */
export function primerHuecoReservable(opts: {
  hoy: string;
  ahora: Date;
  timeZone: string;
  antelacionMin?: number;
  dias?: number;
  huecosDelDia: (fecha: string, weekday: number) => string[];
}): { fecha: string; hora: string } | null {
  const { hoy, ahora, timeZone, huecosDelDia } = opts;
  const antelacion = antelacionMinima(opts.antelacionMin);
  for (let i = 0; i < (opts.dias ?? 60); i++) {
    const fecha = sumarDias(hoy, i);
    const hora = huecosDelDia(fecha, diaSemanaDeFecha(fecha)).find((h) =>
      huecoAunReservable(fecha, h, timeZone, ahora, antelacion),
    );
    if (hora) return { fecha, hora };
  }
  return null;
}
