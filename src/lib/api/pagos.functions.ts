/**
 * Caja en el servidor (lote 11): listar, registrar y borrar pagos, cerrar el
 * día, el CSV para la gestoría y la subida en bloque del importador de
 * TPV 123. Mismo patrón que `cambios.functions.ts`: `createServerFn`, zod
 * para validar y `getSupabaseServerClient()`.
 *
 * Todas exigen sesión de miembro (`exigirAcceso`): no hay Caja en una demo de
 * venta. Ver el contrato completo en docs/contrato-caja.md.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { exigirAcceso } from "./autorizacion.server";
import { PermisoDenegado, tienePermiso } from "./autorizacion";
import { conSesion } from "./sesion.middleware";
import { getSupabaseServerClient } from "../supabase.server";
import { pagosToCsvGestoria } from "../export-csv";
import { calcularDescuadre, pagosPorMetodo, type ConceptoPago, type MetodoPago, type Pago } from "../pagos";

const slug = z.string().min(1).max(120);
const metodoSchema = z.enum(["efectivo", "tarjeta", "bizum"]);
const conceptoSchema = z.enum(["servicio", "producto", "propina", "senal", "ajuste"]);
const fechaISO = z.string().min(10);

function filaAPago(f: Record<string, unknown>): Pago {
  return {
    id: f.id as string,
    appointmentId: (f.appointment_id as string | null) ?? undefined,
    clientId: (f.client_id as string | null) ?? undefined,
    clientName: (f.client_name as string | null) ?? undefined,
    importeEur: Number(f.importe_eur),
    metodo: f.metodo as MetodoPago,
    concepto: f.concepto as ConceptoPago,
    cobradoPor: (f.cobrado_por as string | null) ?? undefined,
    nota: (f.nota as string | null) ?? undefined,
    origen: (f.origen as Pago["origen"]) ?? "sishow",
    refExterna: (f.ref_externa as string | null) ?? undefined,
    fecha: f.fecha as string,
    createdAt: f.created_at as string,
  };
}

/** El aviso de siempre cuando una tabla del lote aún no está aplicada en producción. */
const AVISO_SIN_TABLA = "La caja aún no está activada en este salón.";

export const listarPagos = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, desde: fechaISO, hasta: fechaISO }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    const puedeTodo = tienePermiso(quien, "dinero.ver-global");
    const puedePropio = tienePermiso(quien, "dinero.ver-propio");
    if (!puedeTodo && !puedePropio) throw new PermisoDenegado("dinero.ver-global");
    const supabase = getSupabaseServerClient();
    if (!supabase) return { pagos: [] as Pago[] };
    const { data: filas, error } = await supabase
      .from("payments")
      .select("*")
      .eq("salon_slug", data.slug)
      .gte("fecha", data.desde)
      .lte("fecha", data.hasta)
      .order("fecha", { ascending: false });
    if (error) return { pagos: [] as Pago[], aviso: AVISO_SIN_TABLA };
    let pagos = (filas ?? []).map(filaAPago);
    if (!puedeTodo) {
      const miEmployeeId = quien.tipo === "miembro" ? quien.employeeId : null;
      pagos = pagos.filter((p) => !!miEmployeeId && p.cobradoPor === miEmployeeId);
    }
    return { pagos };
  });

const pagoInputSchema = z.object({
  id: z.string().min(8).max(64),
  appointmentId: z.string().max(200).optional(),
  clientId: z.string().max(64).optional(),
  clientName: z.string().max(200).optional(),
  importeEur: z.number().positive(),
  metodo: metodoSchema,
  concepto: conceptoSchema,
  cobradoPor: z.string().max(120).optional(),
  nota: z.string().max(500).optional(),
  refExterna: z.string().max(200).optional(),
  fecha: fechaISO,
});

/** Alta manual de un pago (no la señal aplicada: esa la crea `syncAppointmentPatch`). */
export const registrarPago = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, pago: pagoInputSchema }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    if (!tienePermiso(quien, "dinero.crear")) throw new PermisoDenegado("dinero.crear");
    const supabase = getSupabaseServerClient();
    if (!supabase) return { guardado: false as const };
    const p = data.pago;
    const { error } = await supabase.from("payments").upsert(
      {
        id: p.id, salon_slug: data.slug, appointment_id: p.appointmentId ?? null, client_id: p.clientId ?? null,
        client_name: p.clientName ?? null, importe_eur: p.importeEur, metodo: p.metodo, concepto: p.concepto,
        cobrado_por: p.cobradoPor ?? null, nota: p.nota ?? null, origen: "sishow", ref_externa: p.refExterna ?? null,
        fecha: p.fecha,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) {
      console.warn(`registrarPago (¿falta aplicar supabase/pendiente.sql sección 14?): ${error.message}`);
      return { guardado: false as const };
    }
    return { guardado: true as const };
  });

/** Borra un pago manual mal apuntado. Mismo permiso que crearlo. */
export const borrarPago = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, id: z.string().min(8) }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    if (!tienePermiso(quien, "dinero.crear")) throw new PermisoDenegado("dinero.crear");
    const supabase = getSupabaseServerClient();
    if (!supabase) return { ok: false as const };
    const { error } = await supabase.from("payments").delete().eq("id", data.id).eq("salon_slug", data.slug);
    if (error) {
      console.warn(`borrarPago: ${error.message}`);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

/** Instantánea del cierre que había antes de un re-cierre (auditoría mínima). */
export interface CierreAnterior {
  efectivoContado: number;
  esperado: number;
  descuadre: number;
  cerradoPor: string | null;
  nota: string | null;
  fecha: string;
}

export interface CierreCaja {
  fecha: string;
  efectivoContado: number;
  esperado: number;
  descuadre: number;
  cerradoPor?: string;
  nota?: string;
  anterior?: CierreAnterior;
  createdAt?: string;
  updatedAt?: string;
}

function filaACierre(f: Record<string, unknown>): CierreCaja {
  return {
    fecha: f.fecha as string,
    efectivoContado: Number(f.efectivo_contado),
    esperado: Number(f.esperado),
    descuadre: Number(f.descuadre),
    cerradoPor: (f.cerrado_por as string | null) ?? undefined,
    nota: (f.nota as string | null) ?? undefined,
    anterior: (f.anterior as CierreAnterior | null) ?? undefined,
    createdAt: (f.created_at as string | undefined) ?? undefined,
    updatedAt: (f.updated_at as string | undefined) ?? undefined,
  };
}

/**
 * Cierra (o re-cierra) el día. El "esperado" es el efectivo apuntado en
 * `payments` para esa fecha — se compara con lo contado, no con el total del
 * día (tarjeta y Bizum no están en el cajón). Re-cerrar guarda el cierre
 * anterior en su propia fila (`anterior`), como auditoría mínima.
 */
export const cerrarCaja = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), efectivoContado: z.number().nonnegative(), nota: z.string().max(500).optional() }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    if (!tienePermiso(quien, "dinero.cerrar")) throw new PermisoDenegado("dinero.cerrar");
    const supabase = getSupabaseServerClient();
    if (!supabase) return null;
    const desde = `${data.fecha}T00:00:00.000Z`;
    const hasta = `${data.fecha}T23:59:59.999Z`;
    const { data: filas, error } = await supabase
      .from("payments").select("*").eq("salon_slug", data.slug).gte("fecha", desde).lte("fecha", hasta);
    if (error) {
      console.warn(`cerrarCaja (leer pagos): ${error.message}`);
      return null;
    }
    const porMetodo = pagosPorMetodo((filas ?? []).map(filaAPago));
    const { descuadre } = calcularDescuadre(data.efectivoContado, porMetodo.efectivo);

    const { data: previa } = await supabase
      .from("cash_closings").select("*").eq("salon_slug", data.slug).eq("fecha", data.fecha).maybeSingle();
    const anterior = previa
      ? { efectivoContado: previa.efectivo_contado, esperado: previa.esperado, descuadre: previa.descuadre, cerradoPor: previa.cerrado_por, nota: previa.nota, fecha: previa.updated_at ?? previa.created_at }
      : null;
    const { error: errUpsert } = await supabase.from("cash_closings").upsert(
      {
        salon_slug: data.slug, fecha: data.fecha, efectivo_contado: data.efectivoContado, esperado: porMetodo.efectivo,
        descuadre, cerrado_por: quien.tipo === "miembro" ? quien.userId : null, nota: data.nota ?? null,
        anterior, updated_at: new Date().toISOString(),
      },
      { onConflict: "salon_slug,fecha" },
    );
    if (errUpsert) {
      console.warn(`cerrarCaja (guardar): ${errUpsert.message}`);
      return null;
    }
    return { fecha: data.fecha, efectivoContado: data.efectivoContado, esperado: porMetodo.efectivo, descuadre, porMetodo, reCierre: !!previa };
  });

export const listarCierresCaja = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, desde: fechaISO, hasta: fechaISO }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    if (!tienePermiso(quien, "dinero.cerrar")) throw new PermisoDenegado("dinero.cerrar");
    const supabase = getSupabaseServerClient();
    if (!supabase) return { cierres: [] };
    const { data: filas, error } = await supabase
      .from("cash_closings").select("*").eq("salon_slug", data.slug).gte("fecha", data.desde).lte("fecha", data.hasta)
      .order("fecha", { ascending: false });
    if (error) return { cierres: [], aviso: AVISO_SIN_TABLA };
    return { cierres: (filas ?? []).map(filaACierre) };
  });

/** El CSV ya formado (separador `;`, coma decimal, BOM): ver `pagosToCsvGestoria`. */
export const generarCsvGestoria = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, desde: fechaISO, hasta: fechaISO }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    if (!tienePermiso(quien, "dinero.exportar")) throw new PermisoDenegado("dinero.exportar");
    const supabase = getSupabaseServerClient();
    if (!supabase) return { csv: null };
    const { data: filas, error } = await supabase
      .from("payments").select("*").eq("salon_slug", data.slug).gte("fecha", data.desde).lte("fecha", data.hasta)
      .order("fecha", { ascending: true });
    if (error) return { csv: null, aviso: AVISO_SIN_TABLA };
    const pagos = (filas ?? []).map(filaAPago);
    const clientIds = [...new Set(pagos.map((p) => p.clientId).filter((x): x is string => !!x))];
    const clientNameById: Record<string, string> = {};
    if (clientIds.length) {
      const { data: clientesFilas } = await supabase.from("clients").select("id, name").eq("salon_slug", data.slug).in("id", clientIds);
      for (const c of clientesFilas ?? []) clientNameById[c.id as string] = c.name as string;
    }
    return { csv: pagosToCsvGestoria(pagos, clientNameById) };
  });

const pagoImportadoSchema = z.object({
  refExterna: z.string().min(1).max(200),
  fecha: fechaISO,
  importeEur: z.number().nonnegative(),
  clienteId: z.string().max(64).optional(),
  clienteNombre: z.string().max(200),
  cobradoPor: z.string().max(120).optional(),
  concepto: conceptoSchema,
  nota: z.string().max(500).optional(),
});

/**
 * Sube en bloque lo que ya calculó `importarPagosTpv` (dominio puro). El
 * TPV 123 no dice el método de cobro de cada línea: se guarda como
 * "efectivo" (el caso general del mostrador); si algún día el histórico trae
 * el método, este es el único sitio que hay que tocar.
 */
export const importarPagosTpvServidor = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, pagos: z.array(pagoImportadoSchema).max(5000) }))
  .handler(async ({ data }) => {
    const quien = await exigirAcceso(data.slug);
    if (!tienePermiso(quien, "dinero.importar")) throw new PermisoDenegado("dinero.importar");
    const supabase = getSupabaseServerClient();
    if (!supabase || !data.pagos.length) return { insertados: 0 };
    const filas = data.pagos.map((p) => ({
      salon_slug: data.slug, appointment_id: null, client_id: p.clienteId ?? null, client_name: p.clienteNombre,
      importe_eur: p.importeEur, metodo: "efectivo" as const, concepto: p.concepto, cobrado_por: p.cobradoPor ?? null,
      nota: p.nota ?? null, origen: "tpv123" as const, ref_externa: p.refExterna, fecha: p.fecha,
    }));
    const { error, count } = await supabase
      .from("payments")
      .upsert(filas, { onConflict: "salon_slug,origen,ref_externa", ignoreDuplicates: true, count: "exact" });
    if (error) {
      console.warn(`importarPagosTpvServidor: ${error.message}`);
      return { insertados: 0 };
    }
    return { insertados: count ?? filas.length };
  });
