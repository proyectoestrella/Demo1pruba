export interface CitaCalendario {
  id: string;
  clientName: string;
  service: string;
  employeeId: string;
  start: string;
  duration: number;
  status: string;
}

function escapar(valor: string): string {
  return valor.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function fechaIcs(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** 75 octetos por línea, contando UTF-8 como pide el formato iCalendar. */
function plegar(linea: string): string {
  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const caracter of linea) {
    const n = new TextEncoder().encode(caracter).length;
    if (bytes + n > 75) { partes.push(actual); actual = " "; bytes = 1; }
    actual += caracter;
    bytes += n;
  }
  partes.push(actual);
  return partes.join("\r\n");
}

export function generarCalendarioIcs(citas: CitaCalendario[], salon: string, profesional?: string, ahora = new Date()): string {
  const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//siShow//Agenda del salon//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapar(salon)}`];
  for (const cita of citas) {
    if (cita.status !== "confirmed" || (profesional && cita.employeeId !== profesional)) continue;
    const inicio = new Date(cita.start);
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(cita.duration) || cita.duration <= 0) continue;
    const fin = new Date(inicio.getTime() + cita.duration * 60_000);
    const nombre = cita.clientName.trim().split(/\s+/)[0] || "Cliente";
    lineas.push("BEGIN:VEVENT", `UID:${escapar(cita.id)}@sishow`, `DTSTAMP:${fechaIcs(ahora)}`, `DTSTART:${fechaIcs(inicio)}`, `DTEND:${fechaIcs(fin)}`, `SUMMARY:${escapar(cita.service)} · ${escapar(nombre)}`, "END:VEVENT");
  }
  lineas.push("END:VCALENDAR");
  return lineas.map(plegar).join("\r\n") + "\r\n";
}
