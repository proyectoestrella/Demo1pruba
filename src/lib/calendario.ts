/**
 * Construcción pura de enlaces de calendario para la pantalla de
 * confirmación de reserva pública (s.$salonSlug.confirmation.tsx).
 *
 * Todo aquí es puro y sin dependencias externas: recibe los datos de la
 * cita ya resueltos (fecha/hora locales de España, duración en minutos,
 * nombre del servicio, del salón y su dirección) y devuelve cadenas listas
 * para usar en un <a href>. No toca el DOM ni hace I/O.
 */

export interface DatosCita {
  /** Fecha en formato YYYY-MM-DD, tal y como la deja el wizard de reserva. */
  fecha: string;
  /** Hora en formato HH:mm, en la zona horaria del salón (Europe/Madrid). */
  hora: string;
  /** Duración total de la cita en minutos. */
  duracionMin: number;
  /** Nombre del servicio o servicios, ya unidos con " + " si son varios. */
  servicio: string;
  /** Nombre del salón. */
  salon: string;
  /** Dirección del salón. */
  direccion: string;
}

/**
 * Fecha/hora de inicio y fin como objetos Date, interpretando `fecha` y
 * `hora` como hora local de España (que es la única zona en la que opera
 * el producto). new Date("YYYY-MM-DDTHH:mm:00") ya se interpreta en la
 * zona horaria del entorno de ejecución, que en producción y en local es
 * Europe/Madrid.
 */
function rangoCita(datos: DatosCita): { inicio: Date; fin: Date } {
  const inicio = new Date(`${datos.fecha}T${datos.hora}:00`);
  const fin = new Date(inicio.getTime() + datos.duracionMin * 60_000);
  return { inicio, fin };
}

/** Formatea una fecha en UTC como YYYYMMDDTHHMMSSZ, el formato de iCalendar. */
function formatoICal(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Escapa texto para un campo de propiedad de iCalendar (RFC 5545 §3.3.11). */
function escaparICal(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

const NOTA_ICS = "Reserva pendiente de confirmar por el salón.";

/** Construye el cuerpo del fichero .ics (VCALENDAR/VEVENT) para la cita. */
export function construirIcs(datos: DatosCita): string {
  const { inicio, fin } = rangoCita(datos);
  const resumen = `${datos.servicio} en ${datos.salon}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//siShow//Reservas//ES",
    "BEGIN:VEVENT",
    `DTSTART:${formatoICal(inicio)}`,
    `DTEND:${formatoICal(fin)}`,
    `SUMMARY:${escaparICal(resumen)}`,
    `LOCATION:${escaparICal(datos.direccion)}`,
    `DESCRIPTION:${escaparICal(NOTA_ICS)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** URI `data:` con el .ics, lista para un <a href> que Safari de iOS abre sin descargar nada. */
export function construirIcsDataUri(datos: DatosCita): string {
  const ics = construirIcs(datos);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

/** Formatea una fecha en UTC como YYYYMMDDTHHMMSSZ para el parámetro `dates` de Google Calendar. */
function formatoGoogle(d: Date): string {
  return formatoICal(d);
}

/** Enlace de plantilla de Google Calendar que abre el diálogo de "añadir evento" sin API ni login previo. */
export function construirEnlaceGoogleCalendar(datos: DatosCita): string {
  const { inicio, fin } = rangoCita(datos);
  const resumen = `${datos.servicio} en ${datos.salon}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: resumen,
    dates: `${formatoGoogle(inicio)}/${formatoGoogle(fin)}`,
    details: NOTA_ICS,
    location: datos.direccion,
    ctz: "Europe/Madrid",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** true si el user-agent es de un dispositivo Apple (iPhone/iPad/iPod). */
export function esDispositivoApple(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}
