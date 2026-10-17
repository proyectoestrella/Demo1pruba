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
  const europea = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[T\s].*)?$/);
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (europea) {
    // TPV 123 también exporta años abreviados. Seguimos el pivote habitual:
    // 00–69 pertenecen a 2000–2069 y 70–99 a 1970–1999; así no se inventa
    // una fecha distinta al reimportar historiales antiguos.
    const anoCrudo = Number(europea[3]);
    const ano = europea[3].length === 2 ? (anoCrudo >= 70 ? 1900 : 2000) + anoCrudo : anoCrudo;
    fecha = fechaUtc(ano, Number(europea[2]), Number(europea[1]));
  }
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

const FIN_CADENA = 0xfffffffe;
const LIBRE = 0xffffffff;

function errorXls(): never { throw new Error("El archivo .xls no es válido o está dañado."); }
function vistaXls(bytes: Uint8Array): DataView { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function rangoXls(bytes: Uint8Array, desde: number, longitud: number): void {
  if (!Number.isSafeInteger(desde) || !Number.isSafeInteger(longitud) || desde < 0 || longitud < 0 || desde + longitud > bytes.length) errorXls();
}
function entero64Xls(view: DataView, pos: number): number {
  const bajo = view.getUint32(pos, true), alto = view.getUint32(pos + 4, true);
  if (alto > 0x1fffff) errorXls();
  return alto * 0x1_0000_0000 + bajo;
}
function unirXls(partes: Uint8Array[]): Uint8Array {
  const longitud = partes.reduce((total, parte) => total + parte.length, 0);
  const resultado = new Uint8Array(longitud); let pos = 0;
  for (const parte of partes) { resultado.set(parte, pos); pos += parte.length; }
  return resultado;
}

/** Lee el stream Workbook de un Compound File Binary (OLE2). */
function streamOle2(bytes: Uint8Array): Uint8Array {
  try {
    rangoXls(bytes, 0, 512); const view = vistaXls(bytes);
    const firma = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (firma.some((n, i) => bytes[i] !== n)) errorXls();
    const version = view.getUint16(26, true), desplazamiento = view.getUint16(30, true), miniDesplazamiento = view.getUint16(32, true);
    if ((version !== 3 && version !== 4) || (desplazamiento !== 9 && desplazamiento !== 12) || miniDesplazamiento !== 6) errorXls();
    const sector = 1 << desplazamiento;
    if (bytes.length < sector || bytes.length % sector) errorXls();
    const sectores = bytes.length / sector - 1;
    const sectorBytes = (id: number) => {
      if (!Number.isInteger(id) || id < 0 || id >= sectores) errorXls();
      const inicio = sector + id * sector; rangoXls(bytes, inicio, sector);
      return bytes.subarray(inicio, inicio + sector);
    };
    const totalFat = view.getUint32(44, true), primerDirectorio = view.getUint32(48, true);
    const limiteMini = view.getUint32(56, true), primerMiniFat = view.getUint32(60, true), totalMiniFat = view.getUint32(64, true);
    if (totalFat > sectores || totalMiniFat > sectores || limiteMini !== 4096) errorXls();
    const difat: number[] = [];
    for (let i = 0; i < 109; i++) {
      const id = view.getUint32(76 + i * 4, true);
      if (id !== LIBRE) difat.push(id);
    }
    let siguienteDifat = view.getUint32(68, true), totalDifat = view.getUint32(72, true);
    if (totalDifat > sectores) errorXls();
    for (let i = 0; i < totalDifat; i++) {
      const datos = sectorBytes(siguienteDifat); const sectorView = vistaXls(datos);
      for (let p = 0; p < sector - 4; p += 4) {
        const id = sectorView.getUint32(p, true);
        if (id !== LIBRE) difat.push(id);
      }
      siguienteDifat = sectorView.getUint32(sector - 4, true);
    }
    if (difat.length < totalFat) errorXls();
    const fat: number[] = [];
    for (const id of difat.slice(0, totalFat)) {
      const datos = sectorBytes(id), sectorView = vistaXls(datos);
      for (let p = 0; p < sector; p += 4) fat.push(sectorView.getUint32(p, true));
    }
    const cadena = (primero: number, tabla: number[], maximo: number) => {
      if (primero === FIN_CADENA) return [];
      const resultado: number[] = [], vistos = new Set<number>(); let actual = primero;
      while (actual !== FIN_CADENA) {
        if (!Number.isInteger(actual) || actual < 0 || actual >= tabla.length || vistos.has(actual) || resultado.length >= maximo) errorXls();
        vistos.add(actual); resultado.push(actual); actual = tabla[actual]!;
      }
      return resultado;
    };
    const normal = (primero: number, tamano: number) => {
      if (!Number.isSafeInteger(tamano) || tamano < 0) errorXls();
      const ids = cadena(primero, fat, sectores + 1);
      if (tamano > ids.length * sector) errorXls();
      return unirXls(ids.map(sectorBytes)).subarray(0, tamano);
    };
    const directorio = unirXls(cadena(primerDirectorio, fat, sectores + 1).map(sectorBytes));
    let libro: { inicio: number; tamano: number } | undefined;
    let raiz: { inicio: number; tamano: number } | undefined;
    for (let pos = 0; pos + 128 <= directorio.length; pos += 128) {
      const directorioView = vistaXls(directorio); const nombreLen = directorioView.getUint16(pos + 64, true), tipo = directorio[pos + 66]!;
      if (nombreLen > 64 || nombreLen % 2) errorXls();
      const nombre = nombreLen < 2 ? "" : new TextDecoder("utf-16le").decode(directorio.subarray(pos, pos + nombreLen - 2));
      const entrada = { inicio: directorioView.getUint32(pos + 116, true), tamano: entero64Xls(directorioView, pos + 120) };
      if (tipo === 5) raiz = entrada;
      if (tipo === 2 && (nombre === "Workbook" || nombre === "Book")) libro = entrada;
    }
    if (!libro) errorXls();
    if (libro.tamano >= limiteMini) return normal(libro.inicio, libro.tamano);
    if (!raiz || totalMiniFat === 0) errorXls();
    const miniFat = unirXls(cadena(primerMiniFat, fat, sectores + 1).slice(0, totalMiniFat).map(sectorBytes));
    if (miniFat.length < totalMiniFat * sector) errorXls();
    const miniView = vistaXls(miniFat), miniTabla: number[] = [];
    for (let pos = 0; pos < miniFat.length; pos += 4) miniTabla.push(miniView.getUint32(pos, true));
    const miniStream = normal(raiz.inicio, raiz.tamano), minis = cadena(libro.inicio, miniTabla, miniTabla.length + 1);
    if (libro.tamano > minis.length * 64) errorXls();
    return unirXls(minis.map((id) => {
      const inicio = id * 64; rangoXls(miniStream, inicio, 64); return miniStream.subarray(inicio, inicio + 64);
    })).subarray(0, libro.tamano);
  } catch { return errorXls(); }
}

class LectorSegmentosBiff {
  private segmento = 0;
  private pos = 0;
  constructor(private readonly segmentos: Uint8Array[]) { if (!segmentos.length) errorXls(); }
  private disponible(): number { return this.segmentos[this.segmento]!.length - this.pos; }
  private siguiente(): boolean { if (this.segmento + 1 >= this.segmentos.length) return false; this.segmento++; this.pos = 0; return true; }
  bytes(longitud: number): Uint8Array {
    if (longitud < 0 || !Number.isSafeInteger(longitud)) errorXls();
    const partes: Uint8Array[] = [];
    while (longitud) {
      if (!this.disponible() && !this.siguiente()) errorXls();
      const tomar = Math.min(longitud, this.disponible());
      partes.push(this.segmentos[this.segmento]!.subarray(this.pos, this.pos + tomar)); this.pos += tomar; longitud -= tomar;
    }
    return unirXls(partes);
  }
  u8(): number { return this.bytes(1)[0]!; }
  u16(): number { return vistaXls(this.bytes(2)).getUint16(0, true); }
  u32(): number { return vistaXls(this.bytes(4)).getUint32(0, true); }
  texto(cantidad: number, opciones: number, rico: number, extension: number): string {
    let queda = cantidad, unicode = !!(opciones & 1), resultado = "";
    while (queda) {
      const porCaracter = unicode ? 2 : 1;
      const posibles = Math.floor(this.disponible() / porCaracter);
      if (!posibles) {
        if (!this.siguiente()) errorXls();
        unicode = !!(this.u8() & 1); continue;
      }
      const tomar = Math.min(queda, posibles), datos = this.bytes(tomar * porCaracter);
      if (unicode) resultado += new TextDecoder("utf-16le").decode(datos);
      else resultado += String.fromCharCode(...datos);
      queda -= tomar;
      if (queda && tomar === posibles) {
        if (!this.siguiente()) errorXls();
        unicode = !!(this.u8() & 1);
      }
    }
    this.bytes(rico * 4 + extension);
    return resultado;
  }
}
function cadenaBiff(lector: LectorSegmentosBiff): string {
  const cantidad = lector.u16(), opciones = lector.u8();
  const rico = opciones & 8 ? lector.u16() : 0, extension = opciones & 4 ? lector.u32() : 0;
  return lector.texto(cantidad, opciones, rico, extension);
}
function registrosBiff(bytes: Uint8Array, desde = 0): { tipo: number; datos: Uint8Array }[] {
  const registros: { tipo: number; datos: Uint8Array }[] = []; let pos = desde;
  while (pos < bytes.length) {
    rangoXls(bytes, pos, 4); const view = vistaXls(bytes), tipo = view.getUint16(pos, true), tamano = view.getUint16(pos + 2, true);
    rangoXls(bytes, pos + 4, tamano); registros.push({ tipo, datos: bytes.subarray(pos + 4, pos + 4 + tamano) }); pos += 4 + tamano;
  }
  return registros;
}
function numeroRk(datos: Uint8Array, pos: number): number {
  rangoXls(datos, pos, 4); const rk = vistaXls(datos).getUint32(pos, true);
  let valor: number;
  if (rk & 2) valor = (rk | 0) >> 2;
  else { const flotante = new Uint8Array(8); vistaXls(flotante).setUint32(4, rk & 0xfffffffc, true); valor = vistaXls(flotante).getFloat64(0, true); }
  return rk & 1 ? valor / 100 : valor;
}
function textoNumeroXls(n: number): string { return Number.isFinite(n) ? String(n) : ""; }
export function leerXls(bytes: Uint8Array): TablaImportacion {
  try {
    const libro = streamOle2(bytes), globales = registrosBiff(libro);
    if (globales[0]?.tipo !== 0x0809 || globales[0].datos.length < 2 || vistaXls(globales[0].datos).getUint16(0, true) !== 0x0600) errorXls();
    let hoja: number | undefined; const compartidas: string[] = [];
    for (let i = 0; i < globales.length; i++) {
      const registro = globales[i]!;
      if (registro.tipo === 0x0085 && hoja === undefined) { if (registro.datos.length < 4) errorXls(); hoja = vistaXls(registro.datos).getUint32(0, true); }
      if (registro.tipo === 0x00fc) {
        const segmentos = [registro.datos]; while (globales[i + 1]?.tipo === 0x003c) segmentos.push(globales[++i]!.datos);
        const lector = new LectorSegmentosBiff(segmentos); lector.u32(); const cantidad = lector.u32();
        for (let j = 0; j < cantidad; j++) compartidas.push(cadenaBiff(lector));
      }
      if (registro.tipo === 0x000a) break;
    }
    if (hoja === undefined || hoja >= libro.length) errorXls();
    const filas = new Map<number, Map<number, string>>();
    const poner = (fila: number, columna: number, valor: string) => {
      if (fila > 1_048_575 || columna > 16_383) errorXls();
      const celdas = filas.get(fila) ?? new Map<number, string>(); celdas.set(columna, valor); filas.set(fila, celdas);
    };
    let formulaPendiente: [number, number] | undefined;
    for (const registro of registrosBiff(libro, hoja)) {
      const datos = registro.datos, view = vistaXls(datos);
      if (registro.tipo === 0x00fd) {
        if (datos.length < 10) errorXls(); const indice = view.getUint32(6, true); if (indice >= compartidas.length) errorXls(); poner(view.getUint16(0, true), view.getUint16(2, true), compartidas[indice]!);
      } else if (registro.tipo === 0x0204) {
        if (datos.length < 9) errorXls(); poner(view.getUint16(0, true), view.getUint16(2, true), cadenaBiff(new LectorSegmentosBiff([datos.subarray(6)])));
      } else if (registro.tipo === 0x0203) {
        if (datos.length < 14) errorXls(); poner(view.getUint16(0, true), view.getUint16(2, true), textoNumeroXls(view.getFloat64(6, true)));
      } else if (registro.tipo === 0x027e) {
        if (datos.length < 10) errorXls(); poner(view.getUint16(0, true), view.getUint16(2, true), textoNumeroXls(numeroRk(datos, 6)));
      } else if (registro.tipo === 0x00bd) {
        if (datos.length < 14) errorXls(); const fila = view.getUint16(0, true), primera = view.getUint16(2, true);
        for (let pos = 6, columna = primera; pos + 6 <= datos.length - 2; pos += 6, columna++) poner(fila, columna, textoNumeroXls(numeroRk(datos, pos + 2)));
      } else if (registro.tipo === 0x0006) {
        if (datos.length < 20) errorXls(); const fila = view.getUint16(0, true), columna = view.getUint16(2, true);
        if (view.getUint16(6, true) !== 0xffff) { poner(fila, columna, textoNumeroXls(view.getFloat64(6, true))); formulaPendiente = undefined; }
        else if (datos[8] === 0) formulaPendiente = [fila, columna];
        else { poner(fila, columna, datos[8] === 1 ? (datos[9] ? "TRUE" : "FALSE") : ""); formulaPendiente = undefined; }
      } else if (registro.tipo === 0x0207 && formulaPendiente) {
        poner(formulaPendiente[0], formulaPendiente[1], cadenaBiff(new LectorSegmentosBiff([datos]))); formulaPendiente = undefined;
      }
      if (registro.tipo === 0x000a) break;
    }
    const ultimaFila = Math.max(-1, ...filas.keys()); const tabla = Array.from({ length: ultimaFila + 1 }, (_, fila) => {
      const celdas = filas.get(fila), ultimaColumna = celdas ? Math.max(-1, ...celdas.keys()) : -1;
      return Array.from({ length: ultimaColumna + 1 }, (_, columna) => celdas?.get(columna) ?? "");
    });
    return { cabeceras: tabla.shift() ?? [], filas: tabla.filter((fila) => fila.some((valor) => valor.trim())) };
  } catch { return errorXls(); }
}
export async function leerTabla(file: File): Promise<TablaImportacion> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith(".xls")) return leerXls(new Uint8Array(await file.arrayBuffer()));
  if (ext.endsWith(".csv")) {
    const bytes = await file.arrayBuffer();
    let texto: string;
    try { texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { texto = new TextDecoder("windows-1252").decode(bytes); }
    return leerCsv(texto);
  }
  if (ext.endsWith(".xlsx")) return leerXlsx(new Uint8Array(await file.arrayBuffer()));
  throw new Error("Elige un archivo .csv, .xls o .xlsx.");
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
