import type { Client } from "./mock/types";

export type CampoCliente = "nombre" | "apellidos" | "telefono" | "telefono2" | "email" | "codigo" | "direccion" | "dni" | "alta" | "cumple" | "ultimaVisita";
export type MapaColumnas = Partial<Record<CampoCliente, number>>;
export interface TablaImportacion { cabeceras: string[]; filas: string[][] }
export interface FilaClienta {
  fila: number;
  nombre: string;
  telefono: string;
  codigo?: string;
  email?: string;
  address?: string;
  taxId?: string;
  tpvAltaDate?: string;
  birthday?: string;
  tpvLastVisit?: string;
  /** Avisos que no impiden importar la fila (p. ej. una fecha ilegible). */
  avisos?: string[];
  estado: "nueva" | "duplicada" | "error";
  motivo?: string;
}
export interface VistaPrevia {
  filas: FilaClienta[];
  nuevas: number;
  duplicadas: number;
  errores: number;
  conCumpleanos: number;
  conDireccion: number;
  conDniCif: number;
  conFechaAlta: number;
  conUltimaVisita: number;
  avisosFecha: number;
  avisosDniCif: number;
}
export interface VisitaImportada { fila: number; fecha: string; cliente: Client; servicios: string[]; importe: number; profesional: string; notas?: string; colorFormula?: string }

const normal = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
export const claveNombre = (s: string) => normal(s).replace(/\s+/g, " ");
export function normalizarTelefono(s: string): string {
  let d = s.replace(/\D/g, "");
  if (d.startsWith("0034") && d.length === 13) d = d.slice(4);
  else if (d.startsWith("34") && d.length === 11) d = d.slice(2);
  return d;
}

/** CSV con comillas escapadas, separadores y saltos de línea dentro de campos. */
export function leerCsv(texto: string): TablaImportacion {
  const fuente = texto.replace(/^\uFEFF/, "");
  let comillasCabecera = false, puntos = 0, comas = 0;
  for (let i = 0; i < fuente.length; i++) {
    const c = fuente[i];
    if (c === '"') { if (comillasCabecera && fuente[i + 1] === '"') i++; else comillasCabecera = !comillasCabecera; }
    else if (!comillasCabecera && (c === "\r" || c === "\n")) break;
    else if (!comillasCabecera && c === ";") puntos++;
    else if (!comillasCabecera && c === ",") comas++;
  }
  const sep = puntos >= comas ? ";" : ",";
  const filas: string[][] = []; let fila: string[] = []; let campo = ""; let comillas = false;
  for (let i = 0; i < fuente.length; i++) {
    const c = fuente[i];
    if (c === '"') {
      if (comillas && fuente[i + 1] === '"') { campo += '"'; i++; }
      else comillas = !comillas;
    } else if (c === sep && !comillas) { fila.push(campo); campo = ""; }
    else if ((c === "\n" || c === "\r") && !comillas) {
      if (c === "\r" && fuente[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else campo += c;
  }
  if (comillas) throw new Error("El CSV tiene unas comillas sin cerrar.");
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return { cabeceras: filas.shift() ?? [], filas: filas.filter((r) => r.some((v) => v.trim())) };
}

const alias: Record<CampoCliente, string[]> = {
  nombre: ["nombre", "cliente", "nombre cliente", "nombre y apellidos", "nombre completo"],
  apellidos: ["apellidos", "apelidos", "apellido", "primer apellido", "apellidos cliente"],
  // `telefono` se resuelve expresamente en detectarColumnas: no se puede
  // poner aquí porque una columna "Telefono" (fijo) y una "Movi" acababan
  // apuntando ambas al fijo según el orden de este objeto.
  telefono: ["movil", "movi", "tel movil", "tel movil cliente", "telefono movil", "telefono movil cliente", "telefono2"],
  telefono2: ["telefono", "telefono1", "tel fijo", "tel fijo cliente", "telefono fijo", "telefono fijo cliente", "telf", "telf.", "numero de telefono"],
  email: ["email", "e-mail", "correo", "correo electronico"],
  codigo: ["codigocliente", "codigo cliente", "codigo", "cod"],
  direccion: ["direccion", "dirección", "domicilio"],
  dni: ["dnicif", "dni", "nif", "cif", "dni/cif"],
  alta: ["f.alta", "fecha alta", "fecha de alta"],
  cumple: ["cumpleaños", "cumpleanos", "fecha nacimiento", "f.nacimiento"],
  ultimaVisita: ["ult.visita", "ultima visita", "última visita"],
};
export const claveCabecera = (s: string) => normal(s).replace(/[.:]/g, "").replace(/\s+/g, " ");
export function detectarColumnas(cabeceras: string[]): MapaColumnas {
  const mapa: MapaColumnas = {};
  const indice = (opciones: string[]) => cabeceras.findIndex((c) => opciones.some((alias) => claveCabecera(alias) === claveCabecera(c)));
  for (const campo of ["nombre", "apellidos", "email", "codigo", "direccion", "dni", "alta", "cumple", "ultimaVisita"] as const) {
    const i = indice(alias[campo]);
    if (i >= 0) mapa[campo] = i;
  }
  const movil = indice(alias.telefono);
  const fijo = indice(alias.telefono2);
  // El móvil manda como teléfono principal. Si también existe un fijo, se
  // conserva como alternativa en OTRA columna; nunca se pisan entre sí.
  if (movil >= 0) {
    mapa.telefono = movil;
    if (fijo >= 0 && fijo !== movil) mapa.telefono2 = fijo;
  } else if (fijo >= 0) {
    mapa.telefono = fijo;
  }
  return mapa;
}

function fechaUtc(year: number, month: number, day: number): string | undefined {
  const fecha = new Date(Date.UTC(year, month - 1, day, 12));
  if (fecha.getUTCFullYear() !== year || fecha.getUTCMonth() !== month - 1 || fecha.getUTCDate() !== day) return undefined;
  return fecha.toISOString().slice(0, 10);
}

/**
 * Convierte las fechas que exporta TPV 123 a la forma de las columnas `date`.
 * No delegamos los formatos europeos en `new Date`: en un navegador en-US
 * "05/11/1985" puede acabar siendo 11 de mayo en lugar de 5 de noviembre.
 */
export function normalizarFechaTpv(valor: string, esCumpleanos = false): string | undefined {
  const raw = valor.trim();
  if (!raw) return undefined;
  let fecha: string | undefined;
  const europea = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s].*)?$/);
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (europea) fecha = fechaUtc(Number(europea[3]), Number(europea[2]), Number(europea[1]));
  else if (iso) fecha = fechaUtc(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  else if (/^\d+(?:[.,]\d+)?$/.test(raw)) {
    // Excel cuenta desde el 30/12/1899 para conservar su histórico error de
    // bisiesto. El valor decimal es la hora: una columna `date` no la guarda.
    const serie = Number(raw.replace(",", "."));
    if (Number.isFinite(serie) && serie >= 0) {
      const d = new Date(Date.UTC(1899, 11, 30, 12) + Math.floor(serie) * 86_400_000);
      fecha = d.toISOString().slice(0, 10);
    }
  }
  if (!fecha) return undefined;
  // Un cumpleaños parcial no llega hasta aquí: no cabe en una columna `date`
  // sin inventarle un año. Si el TPV sí trae un año extraño (1885 o futuro),
  // se conserva tal cual: cambiarlo para que parezca razonable sería inventar.
  void esCumpleanos;
  return fecha;
}

/** DNI/CIF tal como se recibió, salvo espacios y minúsculas. */
export function normalizarDniCif(valor: string): string | undefined {
  const limpio = valor.trim().replace(/\s+/g, "").toLocaleUpperCase("es-ES");
  return !limpio || limpio === "0" || limpio === "-" ? undefined : limpio;
}

/** Forma orientativa, deliberadamente sin comprobar el dígito de control. */
export function tieneFormaDniCif(valor: string): boolean {
  const sinSeparadores = valor.replace(/[.-]/g, "");
  return /^\d{8}[A-Z]$/.test(sinSeparadores)
    || /^[XYZ]\d{7}[A-Z]$/.test(sinSeparadores)
    || /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(sinSeparadores);
}

/** Campos TPV que se pueden completar en una ficha sin reemplazar los suyos. */
export function completarDatosTpvCliente(cliente: Client, fila: FilaClienta): Partial<Client> {
  const completar = <K extends keyof Client>(key: K, value: Client[K] | undefined): Partial<Client> =>
    (cliente[key] === undefined || cliente[key] === "") && value ? { [key]: value } as Partial<Client> : {};
  return {
    ...completar("tpvCode", fila.codigo),
    ...completar("birthday", fila.birthday),
    ...completar("address", fila.address),
    ...completar("taxId", fila.taxId),
    ...completar("tpvAltaDate", fila.tpvAltaDate),
    ...completar("tpvLastVisit", fila.tpvLastVisit),
  };
}

export function vistaPreviaClientas(tabla: TablaImportacion, existentes: Client[], mapa: MapaColumnas = detectarColumnas(tabla.cabeceras)): VistaPrevia {
  const vistosTelefono = new Set(existentes.map((c) => normalizarTelefono(c.phone)).filter(Boolean));
  const vistosNombres = new Set(existentes.map((c) => claveNombre(c.name)));
  const vistosSinTelefono = new Set(existentes.filter((c) => !normalizarTelefono(c.phone)).map((c) => claveNombre(c.name)));
  const vistosCodigos = new Set(existentes.map((c) => c.tpvCode).filter((c): c is string => !!c));
  const filas: FilaClienta[] = [];
  const celda = (r: string[], campo: CampoCliente) => mapa[campo] === undefined ? "" : (r[mapa[campo]!] ?? "").trim();
  tabla.filas.forEach((r, index) => {
    if (!r.some((v) => v.trim())) return;
    const nombre = [celda(r, "nombre"), celda(r, "apellidos")].filter(Boolean).join(" ").replace(/\s+/g, " ");
    const moviles = [celda(r, "telefono"), celda(r, "telefono2")].filter(Boolean);
    const movilRaw = moviles.find((p) => /^[67]/.test(normalizarTelefono(p))) ?? moviles[0] ?? "";
    const telefono = normalizarTelefono(movilRaw);
    const avisos: string[] = [];
    const fecha = (campo: "alta" | "cumple" | "ultimaVisita", etiqueta: string, esCumpleanos = false) => {
      const raw = celda(r, campo);
      const normalizada = normalizarFechaTpv(raw, esCumpleanos);
      if (raw && !normalizada) avisos.push(`${etiqueta} no se ha podido leer`);
      return normalizada;
    };
    const taxId = normalizarDniCif(celda(r, "dni"));
    if (taxId && !tieneFormaDniCif(taxId)) avisos.push("DNI/CIF con formato desconocido");
    const address = celda(r, "direccion") || undefined;
    const tpvAltaDate = fecha("alta", "Fecha de alta");
    const birthday = fecha("cumple", "Cumpleaños", true);
    const tpvLastVisit = fecha("ultimaVisita", "Última visita");
    const registro: FilaClienta = {
      fila: index + 2,
      nombre,
      telefono,
      codigo: celda(r, "codigo") || undefined,
      email: celda(r, "email") || undefined,
      ...(address ? { address } : {}),
      ...(taxId ? { taxId } : {}),
      ...(tpvAltaDate ? { tpvAltaDate } : {}),
      ...(birthday ? { birthday } : {}),
      ...(tpvLastVisit ? { tpvLastVisit } : {}),
      ...(avisos.length ? { avisos } : {}),
      estado: "nueva",
    };
    if (!nombre || (moviles.length > 0 && (!telefono || telefono.length !== 9)) || (registro.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registro.email))) {
      registro.estado = "error";
      registro.motivo = !nombre ? "Falta el nombre" : moviles.length > 0 && (!telefono || telefono.length !== 9) ? "Teléfono no válido" : "Correo no válido";
    }
    else if (registro.codigo && vistosCodigos.has(registro.codigo)) {
      // Volver a importar el mismo export no duplica: el código de TPV 123 manda.
      registro.estado = "duplicada"; registro.motivo = "Ya está importada con ese código de TPV 123";
    }
    else if ((telefono && (vistosTelefono.has(telefono) || vistosSinTelefono.has(claveNombre(nombre)))) || (!telefono && vistosNombres.has(claveNombre(nombre)))) {
      registro.estado = "duplicada"; registro.motivo = "Ya existe una clienta con ese teléfono o nombre";
    } else {
      if (registro.codigo) vistosCodigos.add(registro.codigo);
      if (telefono) vistosTelefono.add(telefono);
      else vistosSinTelefono.add(claveNombre(nombre));
      vistosNombres.add(claveNombre(nombre));
    }
    filas.push(registro);
  });
  return {
    filas,
    nuevas: filas.filter((r) => r.estado === "nueva").length,
    duplicadas: filas.filter((r) => r.estado === "duplicada").length,
    errores: filas.filter((r) => r.estado === "error").length,
    conCumpleanos: filas.filter((r) => !!r.birthday).length,
    conDireccion: filas.filter((r) => !!r.address).length,
    conDniCif: filas.filter((r) => !!r.taxId).length,
    conFechaAlta: filas.filter((r) => !!r.tpvAltaDate).length,
    conUltimaVisita: filas.filter((r) => !!r.tpvLastVisit).length,
    avisosFecha: filas.reduce((n, r) => n + (r.avisos?.filter((a) => a !== "DNI/CIF con formato desconocido").length ?? 0), 0),
    avisosDniCif: filas.filter((r) => r.avisos?.includes("DNI/CIF con formato desconocido")).length,
  };
}

function xmlText(s: string): string {
  return s.replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => String.fromCodePoint(n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : parseInt(n, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function xmlCells(xml: string, shared: string[]): TablaImportacion {
  const filas: string[][] = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const valores: string[] = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = cell[1].match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      let col = 0; for (const ch of ref) col = col * 26 + ch.charCodeAt(0) - 64;
      const tipo = cell[1].match(/\bt="([^"]+)"/)?.[1];
      const body = cell[2] ?? "";
      const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
      valores[col - 1] = tipo === "s" ? shared[Number(raw)] ?? "" : tipo === "inlineStr" ? xmlText([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")) : xmlText(raw);
    }
    filas.push(valores);
  }
  return { cabeceras: filas.shift() ?? [], filas: filas.filter((r) => r.some((v) => v?.trim())) };
}
async function unzipBasico(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error("El archivo .xlsx no es válido.");
  const count = view.getUint16(fin + 10, true); let pos = view.getUint32(fin + 16, true);
  const result = new Map<string, Uint8Array>(); const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error("El archivo .xlsx está dañado.");
    const metodo = view.getUint16(pos + 10, true), size = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true), extra = view.getUint16(pos + 30, true), comment = view.getUint16(pos + 32, true);
    const offset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("El archivo .xlsx está dañado.");
    const begin = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const packed = bytes.subarray(begin, begin + size);
    if (metodo === 0) result.set(name, packed);
    else if (metodo === 8) {
      const stream = new Blob([Uint8Array.from(packed)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      result.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    } else throw new Error("El archivo .xlsx usa una compresión no compatible.");
    pos += 46 + nameLen + extra + comment;
  }
  return result;
}
export async function leerXlsx(bytes: Uint8Array): Promise<TablaImportacion> {
  const files = await unzipBasico(bytes); const decoder = new TextDecoder();
  const read = (name: string) => decoder.decode(files.get(name) ?? new Uint8Array());
  const strings = [...read("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)]
    .map((m) => xmlText([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const workbook = read("xl/workbook.xml");
  const relId = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const rels = read("xl/_rels/workbook.xml.rels");
  const target = relId && [...rels.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)]
    .find((m) => m[1].includes(`Id="${relId}"`))?.[1].match(/Target="([^"]+)"/)?.[1];
  const path = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
  const sheet = read(path);
  if (!sheet) throw new Error("No se encuentra la primera hoja del .xlsx.");
  return xmlCells(sheet, strings);
}
export async function leerTabla(file: File): Promise<TablaImportacion> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith(".xls")) throw new Error("Este .xls antiguo no se puede leer: ábrelo en Excel o LibreOffice y guárdalo como .xlsx o .csv.");
  if (ext.endsWith(".csv")) {
    const bytes = await file.arrayBuffer();
    let texto: string;
    try { texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { texto = new TextDecoder("windows-1252").decode(bytes); }
    return leerCsv(texto);
  }
  if (ext.endsWith(".xlsx")) return leerXlsx(new Uint8Array(await file.arrayBuffer()));
  throw new Error("Elige un archivo .csv o .xlsx.");
}

export const aliasVisita = {
  fecha: ["fecha", "fecha visita", "dia"], codigo: ["codigocliente", "codigo cliente", "codigo", "cod cliente"],
  cliente: ["cliente", "nombre", "nombre cliente", "clienta", "nombre y apellidos"],
  venta: ["venta"],
  concepto: ["concepto", "articulo", "descripcion", "servicio", "tratamiento", "producto"],
  importe: ["importe", "total", "precio"], profesional: ["empleado", "empleada", "empleado/a", "profesional", "trabajador"],
  notas: ["observaciones", "notas", "comentarios"],
} as const;
export interface OpcionesImportarVisitas {
  servicios?: { id: string; name: string }[];
  equipo?: { id: string; name: string }[];
  codigos?: Map<string, string>;
}
export function parseFecha(raw: string): Date {
  if (/^\d+(?:\.\d+)?$/.test(raw)) return new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000);
  const europea = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  // Mismo motivo que en `fechaImportada`: mediodía UTC, no local, para que la
  // fecha de la visita no dependa de la zona horaria del servidor.
  if (europea) return new Date(Date.UTC(Number(europea[3]), Number(europea[2]) - 1, Number(europea[1]), 12));
  return new Date(raw);
}
export function importeNumero(raw: string): number | undefined {
  const limpio = raw.replace(/[\s€]/g, "");
  if (!limpio) return 0;
  const n = Number(limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
export function encontrarNombre<T extends { name: string }>(texto: string, lista: T[]): T | undefined {
  const objetivo = claveNombre(texto);
  if (!objetivo) return undefined;
  const exacto = lista.find((x) => claveNombre(x.name) === objetivo);
  if (exacto) return exacto;
  const tokens = objetivo.split(" ").filter((x) => x.length > 1);
  return lista.map((x) => {
    const nombre = claveNombre(x.name).split(" ").filter((t) => t.length > 1);
    const coincidencias = tokens.filter((t) => nombre.some((n) => n.includes(t) || t.includes(n))).length;
    return { x, score: coincidencias / Math.max(1, Math.min(tokens.length, nombre.length)) };
  })
    .filter((c) => c.score >= 0.6).sort((a, b) => b.score - a.score)[0]?.x;
}
export function importarVisitas(tabla: TablaImportacion, clientas: Client[], opciones: OpcionesImportarVisitas = {}): { visitas: VisitaImportada[]; errores: number; noEnlazadas: number; lineas: number } {
  const cols = Object.fromEntries(Object.entries(aliasVisita).map(([k, a]) => [k, tabla.cabeceras.findIndex((h) => (a as readonly string[]).includes(claveCabecera(h)))])) as Record<keyof typeof aliasVisita, number>;
  const get = (r: string[], k: keyof typeof aliasVisita) => cols[k] < 0 ? "" : (r[cols[k]] ?? "").trim();
  const codigos = opciones.codigos ?? new Map<string, string>();
  const acumuladas = new Map<string, VisitaImportada & { productos: string[]; observaciones: string[] }>();
  let errores = 0, noEnlazadas = 0, lineas = 0;
  let codigoActual = "", nombreActual = "", fechaActual = "";
  tabla.filas.forEach((r, i) => {
    let codigo = get(r, "codigo"), nombre = get(r, "cliente"), rawFecha = get(r, "fecha");
    const nuevaClienta = (!!codigo && codigo !== codigoActual) || (!!nombre && claveNombre(nombre) !== claveNombre(nombreActual));
    if (nuevaClienta && !rawFecha) fechaActual = "";
    if (codigo) codigoActual = codigo;
    if (nombre) nombreActual = nombre;
    if (rawFecha) fechaActual = rawFecha;
    codigo ||= codigoActual; nombre ||= nombreActual; rawFecha ||= fechaActual;
    const concepto = get(r, "concepto") || get(r, "venta");
    const importeTexto = get(r, "importe");
    // Cabeceras de grupo en informes: conservan la clienta para sus filas siguientes.
    if (!concepto && !importeTexto) return;
    lineas++;
    const clienteId = (codigo && codigos.get(codigo)) || undefined;
    const cliente = (clienteId ? clientas.find((c) => c.id === clienteId) : undefined) ??
      (nombre ? encontrarNombre(nombre, clientas) : undefined);
    if (!cliente) { noEnlazadas++; return; }
    const fecha = parseFecha(rawFecha);
    const importe = importeNumero(importeTexto);
    if (!Number.isFinite(+fecha) || +fecha > Date.now() || importe === undefined) { errores++; return; }
    const clave = `${cliente.id}|${fecha.toISOString().slice(0, 10)}`;
    let visita = acumuladas.get(clave);
    if (!visita) {
      visita = { fila: i + 2, fecha: fecha.toISOString(), cliente, servicios: [], importe: 0, profesional: "", productos: [], observaciones: [] };
      acumuladas.set(clave, visita);
    }
    visita.importe += importe;
    const servicio = encontrarNombre(concepto, opciones.servicios ?? []);
    if (servicio && !visita.servicios.includes(servicio.id)) visita.servicios.push(servicio.id);
    else if (concepto) visita.productos.push(concepto);
    const empleadoRaw = get(r, "profesional");
    if (empleadoRaw) {
      const empleado = encontrarNombre(empleadoRaw, opciones.equipo ?? []);
      if (empleado) visita.profesional = empleado.id;
      else visita.observaciones.push(`Empleado: ${empleadoRaw}`);
    }
    const nota = get(r, "notas"); if (nota) {
      visita.observaciones.push(nota);
      if (/\b\d{1,2}[./]\d{1,2}\b|\bvol(?:umen(?:es)?)?\b/i.test(nota)) visita.colorFormula = nota;
    }
  });
  const visitas = [...acumuladas.values()].map(({ productos, observaciones, ...v }) => {
    const notas = [...new Set([...productos.map((p) => `Producto: ${p}`), ...observaciones])].join(" · ");
    return { ...v, notas: notas || undefined };
  });
  return { visitas, errores, noEnlazadas, lineas };
}
