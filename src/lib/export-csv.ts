import type { Appointment, Employee, Service } from "./mock/types";
import { STATUS_OPTIONS } from "./appointment-status";
import { nombreServicioLibre } from "./appointment-services";
import { respuestasLegibles } from "./preguntas-reserva";
import type { BusinessType } from "./business-type";
import { cobradoDeCita, type Pago } from "./pagos";
import { fechaEnZona, horaEnZona, ZONA_HORARIA_SALON } from "./zona-horaria";

/**
 * Exportación de citas y resumen mensual a CSV, generados en cliente con
 * `Blob` — sin backend de por medio. Separador `;` y BOM UTF-8 al principio
 * de cada archivo: es lo que hace que Excel en español (que trae la coma como
 * separador decimal) abra el CSV con acentos y columnas correctas en vez de
 * volcarlo todo en una sola celda.
 */

const SEPARADOR = ";";
export const BOM = "﻿";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fechaEs(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function horaEs(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Envuelve entre comillas y duplica las internas solo si el valor lo exige. */
function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(SEPARADOR) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fila(valores: (string | number)[]): string {
  return valores.map(escapeCsv).join(SEPARADOR);
}

const ESTADO_LABEL: Record<string, string> = {
  ...Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label])),
  blocked: "Bloqueado",
};

/**
 * CSV de citas: una fila por cita, ordenadas por fecha. `services` y
 * `employees` son mapas por id — pásale `selectServiceMap(services)` y
 * `Object.fromEntries(employees.map(e => [e.id, e]))` desde la pantalla.
 */
export function citasToCsv(
  appointments: Appointment[],
  services: Record<string, Service>,
  employees: Record<string, Employee>,
  /** Formulario del salón, para exportar las respuestas con el texto de su pregunta. */
  formulario?: { perfil: Parameters<typeof respuestasLegibles>[0]; tipo: BusinessType },
  /**
   * Lo cobrado real por cita (`agruparPagosPorCita` de `lib/pagos.ts`), para
   * salones que ya usan Caja. Sin este mapa (o para una cita sin pagos
   * propios), la columna sigue siendo `priceEur`, exactamente como hasta hoy.
   */
  pagosPorCita?: Map<string, number>,
): string {
  const header = fila(["Fecha", "Hora", "Clienta", "Servicio", "Profesional", "Precio (€)", "Estado", "Respuestas al reservar"]);
  const filas = appointments
    .slice()
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .map((a) =>
      fila([
        fechaEs(a.start),
        horaEs(a.start),
        a.clientName,
        a.serviceIds.map((id) => services[id]?.name ?? nombreServicioLibre(id) ?? id).join(" + "),
        employees[a.employeeId]?.name ?? a.employeeId,
        pagosPorCita ? cobradoDeCita(a.id, pagosPorCita, a.priceEur) : a.priceEur,
        ESTADO_LABEL[a.status] ?? a.status,
        respuestasLegibles(formulario?.perfil ?? {}, formulario?.tipo ?? "peluqueria", a.bookingAnswers)
          .map((r) => `${r.pregunta} ${r.respuesta}`)
          .join(" | "),
      ]),
    );
  return BOM + [header, ...filas].join("\r\n");
}

/**
 * CSV de "Resumen del mes": totales por día y por profesional, en dos
 * bloques dentro del mismo archivo. Las citas canceladas no cuentan como
 * cita ni como facturación; las "no asistió" cuentan como cita (ocuparon
 * hueco) pero no facturan.
 */
export function resumenMensualToCsv(appointments: Appointment[], employees: Employee[], pagosPorCita?: Map<string, number>): string {
  const facturacionDe = (a: Appointment) => (pagosPorCita ? cobradoDeCita(a.id, pagosPorCita, a.priceEur) : a.priceEur);
  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const cuentanComoCita = appointments.filter((a) => a.status !== "cancelled" && a.status !== "blocked");
  const facturan = cuentanComoCita.filter((a) => a.status !== "no-show");

  const porDia = new Map<string, { citas: number; facturacion: number }>();
  for (const a of cuentanComoCita) {
    const key = fechaEs(a.start);
    const entry = porDia.get(key) ?? { citas: 0, facturacion: 0 };
    entry.citas += 1;
    porDia.set(key, entry);
  }
  for (const a of facturan) {
    const entry = porDia.get(fechaEs(a.start));
    if (entry) entry.facturacion += facturacionDe(a);
  }
  // Orden cronológico real, no alfabético (si no, "2/1" sale antes que "10/1").
  const diasOrdenados = [...porDia.entries()].sort((a, b) => {
    const [da, ma, ya] = a[0].split("/").map(Number);
    const [db, mb, yb] = b[0].split("/").map(Number);
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
  });

  const porProfesional = new Map<string, { citas: number; facturacion: number }>();
  for (const a of cuentanComoCita) {
    const nombre = employeeMap[a.employeeId]?.name ?? a.employeeId;
    const entry = porProfesional.get(nombre) ?? { citas: 0, facturacion: 0 };
    entry.citas += 1;
    porProfesional.set(nombre, entry);
  }
  for (const a of facturan) {
    const nombre = employeeMap[a.employeeId]?.name ?? a.employeeId;
    const entry = porProfesional.get(nombre);
    if (entry) entry.facturacion += facturacionDe(a);
  }
  const profesionalesOrdenados = [...porProfesional.entries()].sort(
    (a, b) => b[1].facturacion - a[1].facturacion,
  );

  const bloques = [
    fila(["Resumen por día"]),
    fila(["Fecha", "Citas", "Facturación (€)"]),
    ...diasOrdenados.map(([fecha, v]) => fila([fecha, v.citas, v.facturacion])),
    "",
    fila(["Resumen por profesional"]),
    fila(["Profesional", "Citas", "Facturación (€)"]),
    ...profesionalesOrdenados.map(([nombre, v]) => fila([nombre, v.citas, v.facturacion])),
  ];

  return BOM + bloques.join("\r\n");
}

const CONCEPTO_LABEL: Record<Pago["concepto"], string> = {
  servicio: "Servicio", producto: "Producto", propina: "Propina", senal: "Señal", ajuste: "Ajuste",
};
const METODO_LABEL: Record<Pago["metodo"], string> = { efectivo: "Efectivo", bizum: "Bizum", tarjeta: "Tarjeta" };
const ORIGEN_LABEL: Record<Pago["origen"], string> = { sishow: "siShow", tpv123: "TPV 123" };

/** "20,00", no "20.00": este CSV lo abre una gestoría, no el propio panel. */
function euroEs(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/**
 * CSV de pagos para la gestoría, por rango de fechas. Mismo separador y BOM
 * que el resto, pero con coma decimal (`escapeCsv` no la toca: no lleva `;`
 * ni comillas). Nunca es un ticket ni una factura — es el registro interno
 * de lo apuntado en Caja (ver docs/contrato-caja.md §6).
 */
/**
 * `timeZone`: la del salón. Este CSV se genera en el SERVIDOR (en UTC en
 * Vercel), así que la fecha y la hora se escriben en la zona del salón, no en
 * la del proceso.
 */
export function pagosToCsvGestoria(
  pagos: Pago[],
  clientNameById: Record<string, string> = {},
  cobradoPorLabel: Record<string, string> = {},
  timeZone: string = ZONA_HORARIA_SALON,
): string {
  const header = fila(["Fecha", "Hora", "Concepto", "Método", "Importe (€)", "Cliente", "Cobrado por", "Nota", "Origen"]);
  const filas = pagos
    .slice()
    .sort((a, b) => +new Date(a.fecha) - +new Date(b.fecha))
    .map((p) =>
      fila([
        fechaEnZona(p.fecha, timeZone).split("-").reverse().join("/"),
        horaEnZona(p.fecha, timeZone),
        CONCEPTO_LABEL[p.concepto] ?? p.concepto,
        METODO_LABEL[p.metodo] ?? p.metodo,
        euroEs(p.importeEur),
        p.clientName ?? (p.clientId ? clientNameById[p.clientId] ?? "" : ""),
        p.cobradoPor ? cobradoPorLabel[p.cobradoPor] ?? p.cobradoPor : "",
        p.nota ?? "",
        ORIGEN_LABEL[p.origen] ?? p.origen,
      ]),
    );
  return BOM + [header, ...filas].join("\r\n");
}

/** Dispara la descarga de un CSV ya generado (con su BOM incluido) en el navegador. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
