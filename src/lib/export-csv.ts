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

/* -------------------------------------------------------------------------
 * «Exportar resumen» de Citas (22-oct): un solo archivo con el resumen del
 * periodo y, debajo, el detalle cita a cita. Sustituye a los dos botones de
 * antes («Exportar a Excel (CSV)» y «Resumen del mes»): el resumen era un
 * subconjunto del detalle y además ignoraba el periodo elegido.
 * ---------------------------------------------------------------------- */

/** Estados que cuentan como ingreso: la clienta vino. */
const ESTADOS_INGRESO = new Set(["completed", "late"]);
/** Estados aún por pasar o en curso: su importe es previsto, no ingresado. */
const ESTADOS_PREVISTO = new Set(["pending", "confirmed", "in-progress"]);

export interface OpcionesResumenCitas {
  /** «Este mes (1 oct – 31 oct)», tal cual se ve en pantalla. */
  periodo: string;
  /** Filtros además del periodo («Estado: Vino · Profesional: Ana»), si los hay. */
  filtros?: string;
  salon?: string;
  timeZone?: string;
  ahora?: Date;
  formulario?: { perfil: Parameters<typeof respuestasLegibles>[0]; tipo: BusinessType };
  pagosPorCita?: Map<string, number>;
}

/** Evita que Excel lea un nombre como «=…» o «+…» como fórmula. */
function textoSeguro(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function fechaZonaEs(iso: string | Date, timeZone: string): string {
  return fechaEnZona(iso, timeZone).split("-").reverse().join("/");
}

/**
 * CSV para Excel en español: BOM UTF-8, `;`, fechas dd/mm/aaaa y horas en la
 * zona del salón, euros con coma decimal. Las canceladas salen en el detalle y
 * en «Por estado», pero no cuentan como cita atendida ni como dinero.
 */
export function resumenCitasToCsv(
  appointments: Appointment[],
  services: Record<string, Service>,
  employees: Record<string, Employee>,
  opciones: OpcionesResumenCitas,
): string {
  const tz = opciones.timeZone ?? ZONA_HORARIA_SALON;
  const ahora = opciones.ahora ?? new Date();
  const citas = appointments.filter((a) => a.status !== "blocked").slice().sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const importe = (a: Appointment) => (opciones.pagosPorCita ? cobradoDeCita(a.id, opciones.pagosPorCita, a.priceEur) : a.priceEur) ?? 0;
  const nombreServicio = (id: string) => services[id]?.name ?? nombreServicioLibre(id) ?? id;
  const nombrePro = (id: string) => employees[id]?.name ?? id;

  const activas = citas.filter((a) => a.status !== "cancelled");
  const ingresadas = citas.filter((a) => ESTADOS_INGRESO.has(a.status));
  const previstas = citas.filter((a) => ESTADOS_PREVISTO.has(a.status));
  const suma = (xs: Appointment[]) => xs.reduce((s, a) => s + importe(a), 0);

  const porEstado = new Map<string, { citas: number; eur: number }>();
  for (const o of STATUS_OPTIONS) porEstado.set(o.value, { citas: 0, eur: 0 });
  for (const a of citas) {
    const e = porEstado.get(a.status) ?? { citas: 0, eur: 0 };
    e.citas += 1;
    e.eur += importe(a);
    porEstado.set(a.status, e);
  }

  // Por servicio y por profesional, solo lo que se hizo o está por hacer (sin
  // canceladas ni «No vino»): «Ingresos» es lo de las citas a las que vino.
  const contables = activas.filter((a) => a.status !== "no-show");
  const porServicio = new Map<string, { citas: number; ingresos: number }>();
  for (const a of contables) {
    const ids = a.serviceIds.length ? a.serviceIds : ["—"];
    const pesos = ids.map((id) => services[id]?.priceEur ?? 0);
    const total = pesos.reduce((s, p) => s + p, 0);
    ids.forEach((id, i) => {
      const nombre = id === "—" ? "Sin servicio" : nombreServicio(id);
      const e = porServicio.get(nombre) ?? { citas: 0, ingresos: 0 };
      e.citas += 1;
      if (ESTADOS_INGRESO.has(a.status)) e.ingresos += importe(a) * (total > 0 ? pesos[i] / total : 1 / ids.length);
      porServicio.set(nombre, e);
    });
  }
  const porPro = new Map<string, { citas: number; ingresos: number }>();
  for (const a of contables) {
    const nombre = nombrePro(a.employeeId);
    const e = porPro.get(nombre) ?? { citas: 0, ingresos: 0 };
    e.citas += 1;
    if (ESTADOS_INGRESO.has(a.status)) e.ingresos += importe(a);
    porPro.set(nombre, e);
  }
  const ordenar = (m: Map<string, { citas: number; ingresos: number }>) =>
    [...m.entries()].sort((a, b) => b[1].ingresos - a[1].ingresos || b[1].citas - a[1].citas || a[0].localeCompare(b[0], "es"));

  const lineas: string[] = [
    fila([opciones.salon ? `Resumen de citas · ${opciones.salon}` : "Resumen de citas"]),
    fila(["Periodo", opciones.periodo]),
    ...(opciones.filtros ? [fila(["Filtros", opciones.filtros])] : []),
    fila(["Generado", `${fechaZonaEs(ahora, tz)} ${horaEnZona(ahora, tz)}`]),
    "",
    fila(["Totales"]),
    fila(["Citas (sin canceladas)", activas.length]),
    fila(["Canceladas", citas.length - activas.length]),
    fila(["Ingresos: vino o vino tarde (€)", euroEs(suma(ingresadas))]),
    fila(["Previsto: pendientes, confirmadas y en el salón (€)", euroEs(suma(previstas))]),
    "",
    fila(["Por estado"]),
    fila(["Estado", "Citas", "Importe (€)"]),
    ...[...porEstado.entries()].filter(([, v]) => v.citas > 0).map(([estado, v]) => fila([ESTADO_LABEL[estado] ?? estado, v.citas, euroEs(v.eur)])),
    "",
    fila(["Por servicio"]),
    fila(["Servicio", "Citas", "Ingresos (€)"]),
    ...ordenar(porServicio).map(([n, v]) => fila([n, v.citas, euroEs(v.ingresos)])),
    "",
    fila(["Por profesional"]),
    fila(["Profesional", "Citas", "Ingresos (€)"]),
    ...ordenar(porPro).map(([n, v]) => fila([n, v.citas, euroEs(v.ingresos)])),
    "",
    fila(["Detalle"]),
    fila(["Fecha", "Hora", "Clienta", "Servicio", "Profesional", "Precio (€)", "Estado", "Respuestas al reservar"]),
    ...(citas.length === 0
      ? [fila(["Sin citas en este periodo."])]
      : citas.map((a) =>
          fila([
            fechaZonaEs(a.start, tz),
            horaEnZona(a.start, tz),
            textoSeguro(a.clientName),
            a.serviceIds.map(nombreServicio).join(" + "),
            nombrePro(a.employeeId),
            euroEs(importe(a)),
            ESTADO_LABEL[a.status] ?? a.status,
            respuestasLegibles(opciones.formulario?.perfil ?? {}, opciones.formulario?.tipo ?? "peluqueria", a.bookingAnswers)
              .map((r) => textoSeguro(`${r.pregunta} ${r.respuesta}`))
              .join(" | "),
          ]),
        )),
  ];
  return BOM + lineas.join("\r\n");
}
