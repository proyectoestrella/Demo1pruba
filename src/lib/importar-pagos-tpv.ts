/**
 * Importador del "Histórico X Clientes" de TPV 123, a PAGOS (lote 11).
 *
 * Reutiliza el mismo lector y las mismas columnas que `importarVisitas`
 * (`aliasVisita`, `claveCabecera`, `parseFecha`, `importeNumero`,
 * `encontrarNombre` — todo en `importar-clientas.ts`), pero con una
 * diferencia deliberada: `importarVisitas` AGRUPA varias líneas de una
 * visita en una sola cita; aquí, en cambio, CADA LÍNEA es un pago propio,
 * porque lo que hace falta para la caja es el importe de cada apunte, no
 * el resumen de la visita.
 *
 * "Traer, no teclear": la `refExterna` es el número de Factura (o
 * `Factura#2`, `Factura#3`… si la misma factura tiene varias líneas), así
 * que reimportar el mismo export nunca duplica — el mismo fichero, leído en
 * el mismo orden, produce siempre las mismas referencias.
 */
import { aliasVisita, claveCabecera, claveNombre, encontrarNombre, importeNumero, parseFecha, type TablaImportacion } from "./importar-clientas";
import type { Client, Employee } from "./mock/types";
import type { ConceptoPago } from "./pagos";

export interface PagoImportadoTpv {
  fila: number;
  refExterna: string;
  /** ISO. */
  fecha: string;
  importeEur: number;
  clienteId?: string;
  clienteNombre: string;
  /** employeeId, si se pudo casar por nombre. */
  cobradoPor?: string;
  concepto: ConceptoPago;
  nota?: string;
}

export interface ResultadoImportarPagosTpv {
  pagos: PagoImportadoTpv[];
  /** Encontraron clienta, por código de TPV 123 o por nombre normalizado. */
  casadas: number;
  /** No se pudo casar con ninguna clienta: el pago se sube igual, sin `clienteId`. */
  noCasadas: number;
  errores: number;
  lineas: number;
}

const ALIAS_FACTURA = ["factura", "num factura", "n factura", "nº factura", "numero factura", "número factura"];

export interface OpcionesImportarPagosTpv {
  equipo?: Employee[];
  /** tpv_code → id de la clienta ya existente. */
  codigos?: Map<string, string>;
}

export function importarPagosTpv(
  tabla: TablaImportacion,
  clientas: Client[],
  opciones: OpcionesImportarPagosTpv = {},
): ResultadoImportarPagosTpv {
  const cabeceras = tabla.cabeceras;
  const colFactura = cabeceras.findIndex((h) => ALIAS_FACTURA.includes(claveCabecera(h)));
  const cols = Object.fromEntries(
    Object.entries(aliasVisita).map(([k, alias]) => [k, cabeceras.findIndex((h) => (alias as readonly string[]).includes(claveCabecera(h)))]),
  ) as Record<keyof typeof aliasVisita, number>;
  const get = (r: string[], k: keyof typeof aliasVisita) => (cols[k] < 0 ? "" : (r[cols[k]] ?? "").trim());
  const codigos = opciones.codigos ?? new Map<string, string>();

  const pagos: PagoImportadoTpv[] = [];
  let casadas = 0;
  let noCasadas = 0;
  let errores = 0;
  let lineas = 0;
  const contadorFactura = new Map<string, number>();
  let codigoActual = "";
  let nombreActual = "";
  let fechaActual = "";

  tabla.filas.forEach((r, i) => {
    let codigo = get(r, "codigo");
    let nombre = get(r, "cliente");
    let rawFecha = get(r, "fecha");
    const facturaCelda = colFactura >= 0 ? (r[colFactura] ?? "").trim() : "";
    // Mismas cabeceras de grupo que en importarVisitas: una fila con solo la
    // clienta, y las siguientes con los conceptos bajo ella.
    const nuevaClienta = (!!codigo && codigo !== codigoActual) || (!!nombre && claveNombre(nombre) !== claveNombre(nombreActual));
    if (nuevaClienta && !rawFecha) fechaActual = "";
    if (codigo) codigoActual = codigo;
    if (nombre) nombreActual = nombre;
    if (rawFecha) fechaActual = rawFecha;
    codigo ||= codigoActual;
    nombre ||= nombreActual;
    rawFecha ||= fechaActual;

    const concepto = get(r, "concepto") || get(r, "venta");
    const importeTexto = get(r, "importe");
    if (!concepto && !importeTexto) return; // cabecera de grupo: no es una línea de pago
    lineas++;

    const factura = facturaCelda || `sin-factura-${i + 2}`;
    const veces = (contadorFactura.get(factura) ?? 0) + 1;
    contadorFactura.set(factura, veces);
    const refExterna = veces === 1 ? factura : `${factura}#${veces}`;

    const fecha = parseFecha(rawFecha);
    const importe = importeNumero(importeTexto);
    if (!Number.isFinite(+fecha) || +fecha > Date.now() || importe === undefined) {
      errores++;
      return;
    }

    const clienteId = (codigo && codigos.get(codigo)) || encontrarNombre(nombre, clientas)?.id;
    if (clienteId) casadas++;
    else noCasadas++;

    const empleadoRaw = get(r, "profesional");
    const empleado = empleadoRaw ? encontrarNombre(empleadoRaw, opciones.equipo ?? []) : undefined;

    pagos.push({
      fila: i + 2,
      refExterna,
      fecha: fecha.toISOString(),
      importeEur: importe,
      clienteId,
      clienteNombre: nombre,
      cobradoPor: empleado?.id,
      concepto: "servicio",
      nota: concepto || undefined,
    });
  });

  return { pagos, casadas, noCasadas, errores, lineas };
}
