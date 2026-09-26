/**
 * Cita de siShow → lo que se escribe en el calendario externo, y al revés.
 *
 * El UID es SIEMPRE `icalUidDeCita(citaId)` (ver tipos.ts), tanto en el
 * `iCalUID` de Google como en el `UID:` del VEVENT de Apple: es lo que hace
 * que mover una cita de hora actualice el MISMO evento en vez de duplicarlo,
 * y es parte de cómo se reconoce un eco al releer el calendario.
 *
 * El folding a 75 octetos y el escapado de campos de texto están duplicados
 * a propósito de `calendario-ics.ts` (el feed público suscribible): son
 * consumidores distintos con distinto radio de impacto si algo se rompe, y
 * la duplicación aquí es de ~15 líneas.
 */
import { icalUidDeCita, type CitaParaCalendario } from "./tipos";

function escapar(valor: string): string {
  return valor.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function fechaIcs(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function plegar(linea: string): string {
  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const caracter of linea) {
    const n = new TextEncoder().encode(caracter).length;
    if (bytes + n > 75) {
      partes.push(actual);
      actual = " ";
      bytes = 1;
    }
    actual += caracter;
    bytes += n;
  }
  partes.push(actual);
  return partes.join("\r\n");
}

/** "Corte de pelo · Ana" — mismo criterio que el feed público (nombre de pila, nunca el apellido). */
export function resumenDeCita(cita: CitaParaCalendario): string {
  const nombre = cita.clientName.trim().split(/\s+/)[0] || "Cliente";
  return `${cita.service} · ${nombre}`;
}

/** El VCALENDAR completo con un único VEVENT: es lo que espera un PUT de CalDAV como cuerpo del recurso. */
export function icsDeCita(cita: CitaParaCalendario, ahora = new Date()): string {
  const inicio = new Date(cita.start);
  const fin = new Date(inicio.getTime() + cita.duration * 60_000);
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//siShow//Agenda del salon//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapar(icalUidDeCita(cita.id))}`,
    `DTSTAMP:${fechaIcs(ahora)}`,
    `DTSTART:${fechaIcs(inicio)}`,
    `DTEND:${fechaIcs(fin)}`,
    `SUMMARY:${escapar(resumenDeCita(cita))}`,
    // Marca propia (Apple no tiene "extendedProperties"): un evento que
    // llega de vuelta con esta propiedad es un eco de siShow, no un hueco
    // real que la profesional metió a mano en Apple.
    `X-SISHOW-CITA-ID:${escapar(cita.id)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lineas.map(plegar).join("\r\n") + "\r\n";
}

/** Si el VEVENT trae la marca propia, de qué cita es. null si es un evento ajeno (de verdad ocupado). */
export function citaIdDeIcs(ics: string): string | null {
  const m = /^X-SISHOW-CITA-ID:(.*)$/m.exec(ics.replace(/\r\n[ \t]/g, ""));
  return m ? m[1].trim().replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\") : null;
}

/** El nombre libre "resumen" de un VEVENT ajeno, para guardarlo en el bloqueo importado (sin más detalle). */
export function resumenDeIcs(ics: string): string | null {
  const desplegado = ics.replace(/\r\n[ \t]/g, "");
  const m = /^SUMMARY:(.*)$/m.exec(desplegado);
  return m ? m[1].trim() : null;
}

/** Las fechas DTSTART/DTEND de un VEVENT ajeno (formato con o sin hora local — se asume UTC si acaba en "Z"). */
export function fechasDeIcs(ics: string): { start: string; end: string } | null {
  const desplegado = ics.replace(/\r\n[ \t]/g, "");
  const inicio = /^DTSTART[^:]*:(.*)$/m.exec(desplegado)?.[1]?.trim();
  const fin = /^DTEND[^:]*:(.*)$/m.exec(desplegado)?.[1]?.trim();
  if (!inicio || !fin) return null;
  const aIso = (v: string) => {
    const m2 = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
    if (!m2) return null;
    const [, y, mo, d, h, mi, s, z] = m2;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : ""}`;
  };
  const startIso = aIso(inicio);
  const endIso = aIso(fin);
  if (!startIso || !endIso) return null;
  return { start: startIso, end: endIso };
}

/** Los datos del evento que necesita Google, calculados desde la cita (sin cifrado ni credenciales). */
export function eventoGoogleDeCita(cita: CitaParaCalendario) {
  return {
    citaId: cita.id,
    resumen: resumenDeCita(cita),
    inicioISO: new Date(cita.start).toISOString(),
    finISO: new Date(new Date(cita.start).getTime() + cita.duration * 60_000).toISOString(),
    descripcion: cita.note ?? undefined,
  };
}
