/**
 * Caja del día, lote 16: lo que la pantalla necesita para ser útil de verdad.
 *
 * La caja junta dos fuentes, sin contar nada dos veces:
 *   - los PAGOS apuntados (VentanaCobrar, importador de TPV, señales);
 *   - las CITAS marcadas como cobradas que no tienen ningún pago apuntado
 *     (historial anterior a los pagos, o la demo).
 * Funciones puras, con test. Nada de esto es un ticket ni una factura.
 */
import type { Appointment, Employee, PaymentMethod } from "./mock/types";
import type { Pago } from "./pagos";
import { fechaEnZona, momentoLocal } from "./zona-horaria";
import { cobradoHoy, esCobrable } from "./caja";

export type MetodoCaja = PaymentMethod;
export const METODOS_CAJA: MetodoCaja[] = ["efectivo", "tarjeta", "bizum"];

export interface Movimiento {
  id: string;
  fecha: string;
  /** Minuto del día en la zona del salón. */
  minuto: number;
  clienta: string;
  concepto: string;
  metodo: MetodoCaja;
  importeEur: number;
  profesional?: string;
  /** De dónde sale: un pago apuntado o una cita marcada como cobrada. */
  fuente: "pago" | "cita";
  pago?: Pago;
}

const CONCEPTO: Record<Pago["concepto"], string> = { servicio: "Servicio", producto: "Producto", propina: "Propina", senal: "Señal", ajuste: "Ajuste" };
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Movimientos de cada día entre `desde` y `hasta` (YYYY-MM-DD, en la zona del
 * salón), agrupados por día. Filtra primero por texto ISO (±1 día) para no
 * pasar por la zona horaria miles de citas que no tocan.
 */
export function movimientosPorDia(pagos: Pago[], citas: Appointment[], desde: string, hasta: string, zona: string): Map<string, Movimiento[]> {
  const lo = sumarDias(desde, -1);
  const hi = sumarDias(hasta, 2);
  const dentro = (iso: string) => iso >= lo && iso < hi;
  const conPago = new Set(pagos.map((p) => p.appointmentId).filter(Boolean) as string[]);
  const out = new Map<string, Movimiento[]>();
  const meter = (dia: string, m: Movimiento) => {
    if (dia < desde || dia > hasta) return;
    const l = out.get(dia);
    if (l) l.push(m);
    else out.set(dia, [m]);
  };
  for (const p of pagos) {
    if (!dentro(p.fecha)) continue;
    meter(fechaEnZona(p.fecha, zona), { id: p.id, fecha: p.fecha, minuto: momentoLocal(p.fecha, zona).minuto, clienta: p.clientName ?? "Sin clienta", concepto: CONCEPTO[p.concepto], metodo: p.metodo, importeEur: p.importeEur, profesional: p.cobradoPor, fuente: "pago", pago: p });
  }
  for (const a of citas) {
    if (!a.paidAt || !dentro(a.paidAt) || conPago.has(a.id) || !esCobrable(a)) continue;
    meter(fechaEnZona(a.paidAt, zona), { id: `cita:${a.id}`, fecha: a.paidAt, minuto: momentoLocal(a.paidAt, zona).minuto, clienta: a.clientName, concepto: "Servicio", metodo: a.paymentMethod ?? "efectivo", importeEur: cobradoHoy(a), profesional: a.employeeId, fuente: "cita" });
  }
  for (const l of out.values()) l.sort((x, y) => x.fecha.localeCompare(y.fecha));
  return out;
}

/** Todos los movimientos de un día (YYYY-MM-DD en la zona del salón), por hora. */
export function movimientosDelDia(pagos: Pago[], citas: Appointment[], dia: string, zona: string): Movimiento[] {
  return movimientosPorDia(pagos, citas, dia, dia, zona).get(dia) ?? [];
}

export interface ResumenCaja {
  total: number;
  cobros: number;
  porMetodo: Record<MetodoCaja, number>;
}

export function resumen(movs: Movimiento[]): ResumenCaja {
  const porMetodo: Record<MetodoCaja, number> = { efectivo: 0, tarjeta: 0, bizum: 0 };
  let total = 0;
  for (const m of movs) {
    porMetodo[m.metodo] = r2(porMetodo[m.metodo] + m.importeEur);
    total = r2(total + m.importeEur);
  }
  return { total, cobros: movs.length, porMetodo };
}

/** Lo cobrado en cada hora del día, de la primera a la última con movimiento (mínimo 9-20). */
export function porHora(movs: Movimiento[]): { hora: number; total: number }[] {
  const horas = movs.map((m) => Math.floor(m.minuto / 60));
  const ini = Math.min(9, ...horas);
  const fin = Math.max(20, ...horas);
  const out = Array.from({ length: fin - ini + 1 }, (_, i) => ({ hora: ini + i, total: 0 }));
  for (const m of movs) {
    const b = out[Math.floor(m.minuto / 60) - ini];
    b.total = r2(b.total + m.importeEur);
  }
  return out;
}

/** Suma un número de días a una fecha YYYY-MM-DD (calendario, sin zona). */
export function sumarDias(clave: string, n: number): string {
  const [y, m, d] = clave.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

/** Variación en % frente a otra cifra; null si no hay con qué comparar. */
export function variacion(ahora: number, antes: number): number | null {
  if (antes <= 0) return null;
  return Math.round(((ahora - antes) / antes) * 100);
}

/** Los `n` días anteriores a `dia` con su resumen (el más reciente primero); solo los que tuvieron cobros. */
export function diasAnteriores(pagos: Pago[], citas: Appointment[], dia: string, zona: string, n = 14): { dia: string; resumen: ResumenCaja }[] {
  const porDia = movimientosPorDia(pagos, citas, sumarDias(dia, -n), sumarDias(dia, -1), zona);
  const out: { dia: string; resumen: ResumenCaja }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = sumarDias(dia, -i);
    const movs = porDia.get(d);
    if (movs?.length) out.push({ dia: d, resumen: resumen(movs) });
  }
  return out;
}

/** Citas de `dia` que ya empezaron, se podían cobrar y siguen sin cobrar. */
export function pendientesDeCobrar(citas: Appointment[], dia: string, zona: string, ahora: Date): Appointment[] {
  const lo = sumarDias(dia, -1);
  const hi = sumarDias(dia, 2);
  return citas
    .filter((a) => a.start >= lo && a.start < hi && esCobrable(a) && !a.paidAt && a.status !== "pending" && fechaEnZona(a.start, zona) === dia && Date.parse(a.start) <= ahora.getTime())
    .sort((a, b) => a.start.localeCompare(b.start));
}

const eur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const NOMBRE_METODO: Record<MetodoCaja, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", bizum: "Bizum" };

/** El resumen del día en texto plano, para pegar en WhatsApp o mandar a la gestoría. */
export function textoResumen(opts: { salon: string; etiquetaDia: string; r: ResumenCaja; porProfesional: { nombre: string; total: number }[]; pendientes: number }): string {
  const l = [`*Caja de ${opts.salon}* · ${opts.etiquetaDia}`, `Total: ${eur(opts.r.total)} (${opts.r.cobros} ${opts.r.cobros === 1 ? "cobro" : "cobros"})`];
  for (const m of METODOS_CAJA) l.push(`· ${NOMBRE_METODO[m]}: ${eur(opts.r.porMetodo[m])}`);
  if (opts.porProfesional.length) l.push(`Por profesional: ${opts.porProfesional.map((p) => `${p.nombre} ${eur(p.total)}`).join(" · ")}`);
  if (opts.pendientes > 0) l.push(`Sin cobrar todavía: ${opts.pendientes} ${opts.pendientes === 1 ? "cita" : "citas"}`);
  l.push("Registro interno para cuadrar la caja; no es un ticket ni una factura.");
  return l.join("\n");
}

/** Lo cobrado por cada profesional, de más a menos. */
export function porProfesional(movs: Movimiento[], equipo: Pick<Employee, "id" | "name">[]): { id: string; nombre: string; total: number }[] {
  const m = new Map<string, number>();
  for (const x of movs) if (x.profesional) m.set(x.profesional, r2((m.get(x.profesional) ?? 0) + x.importeEur));
  return [...m].map(([id, total]) => ({ id, nombre: equipo.find((e) => e.id === id)?.name ?? id, total })).sort((a, b) => b.total - a.total);
}
