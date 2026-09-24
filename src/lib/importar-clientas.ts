import type { Client } from "./mock/types";

export type CampoCliente = "nombre" | "apellidos" | "telefono" | "email" | "notas";
export type MapaColumnas = Partial<Record<CampoCliente, number>>;
export interface TablaImportacion { cabeceras: string[]; filas: string[][] }
export interface FilaClienta { fila: number; nombre: string; telefono: string; email?: string; notas?: string; estado: "nueva" | "duplicada" | "error"; motivo?: string }
export interface VistaPrevia { filas: FilaClienta[]; nuevas: number; duplicadas: number; errores: number }
export interface VisitaImportada { fila: number; fecha: string; cliente: Client; servicio: string; importe: number; profesional: string; notas?: string; colorFormula?: string }

const normal = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
const claveNombre = (s: string) => normal(s).replace(/\s+/g, " ");
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
  apellidos: ["apellidos", "apellido", "primer apellido", "apellidos cliente"],
  telefono: ["telefono", "movil", "telf", "telf.", "telefono movil", "numero de telefono"],
  email: ["email", "e-mail", "correo", "correo electronico"],
  notas: ["observaciones", "notas", "comentarios"],
};
export function detectarColumnas(cabeceras: string[]): MapaColumnas {
  const mapa: MapaColumnas = {};
  for (const campo of Object.keys(alias) as CampoCliente[]) {
    const i = cabeceras.findIndex((c) => alias[campo].includes(normal(c).replace(/[.:]$/, "")));
    if (i >= 0) mapa[campo] = i;
  }
  return mapa;
}
export function vistaPreviaClientas(tabla: TablaImportacion, existentes: Client[], mapa: MapaColumnas = detectarColumnas(tabla.cabeceras)): VistaPrevia {
  const vistosTelefono = new Set(existentes.map((c) => normalizarTelefono(c.phone)).filter(Boolean));
  const vistosNombres = new Set(existentes.map((c) => claveNombre(c.name)));
  const vistosSinTelefono = new Set(existentes.filter((c) => !normalizarTelefono(c.phone)).map((c) => claveNombre(c.name)));
  const filas: FilaClienta[] = [];
  const celda = (r: string[], campo: CampoCliente) => mapa[campo] === undefined ? "" : (r[mapa[campo]!] ?? "").trim();
  tabla.filas.forEach((r, index) => {
    if (!r.some((v) => v.trim())) return;
    const nombre = [celda(r, "nombre"), celda(r, "apellidos")].filter(Boolean).join(" ").replace(/\s+/g, " ");
    const telefono = normalizarTelefono(celda(r, "telefono"));
    const rawPhone = celda(r, "telefono");
    const registro: FilaClienta = { fila: index + 2, nombre, telefono, email: celda(r, "email") || undefined, notas: celda(r, "notas") || undefined, estado: "nueva" };
    if (!nombre || (rawPhone && telefono.length !== 9) || (registro.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registro.email))) {
      registro.estado = "error";
      registro.motivo = !nombre ? "Falta el nombre" : rawPhone && telefono.length !== 9 ? "Teléfono no válido" : "Correo no válido";
    }
    else if ((telefono && (vistosTelefono.has(telefono) || vistosSinTelefono.has(claveNombre(nombre)))) || (!telefono && vistosNombres.has(claveNombre(nombre)))) {
      registro.estado = "duplicada"; registro.motivo = "Ya existe una clienta con ese teléfono o nombre";
    } else {
      if (telefono) vistosTelefono.add(telefono);
      else vistosSinTelefono.add(claveNombre(nombre));
      vistosNombres.add(claveNombre(nombre));
    }
    filas.push(registro);
  });
  return { filas, nuevas: filas.filter((r) => r.estado === "nueva").length, duplicadas: filas.filter((r) => r.estado === "duplicada").length, errores: filas.filter((r) => r.estado === "error").length };
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
  if (ext.endsWith(".xls")) throw new Error("Ábrelo y guárdalo como .xlsx o .csv");
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

const aliasVisita = {
  fecha: ["fecha", "fecha visita", "dia"], cliente: ["cliente", "nombre", "nombre cliente"],
  telefono: ["telefono", "movil", "telf"], servicio: ["servicio", "concepto", "tratamiento"],
  importe: ["importe", "total", "precio"], profesional: ["empleado", "empleada", "empleado/a", "profesional", "trabajador"],
  notas: ["observaciones", "notas", "comentarios"],
} as const;
export function importarVisitas(tabla: TablaImportacion, clientas: Client[]): { visitas: VisitaImportada[]; errores: number } {
  const cols = Object.fromEntries(Object.entries(aliasVisita).map(([k, a]) => [k, tabla.cabeceras.findIndex((h) => (a as readonly string[]).includes(normal(h).replace(/[.:]$/, "")))]));
  const get = (r: string[], k: keyof typeof aliasVisita) => cols[k] < 0 ? "" : (r[cols[k]] ?? "").trim();
  const visitas: VisitaImportada[] = []; let errores = 0;
  tabla.filas.forEach((r, i) => {
    const telefono = normalizarTelefono(get(r, "telefono")); const nombre = claveNombre(get(r, "cliente"));
    const cliente = clientas.find((c) => telefono ? normalizarTelefono(c.phone) === telefono : claveNombre(c.name) === nombre);
    const raw = get(r, "fecha");
    let fecha: Date;
    if (/^\d+(?:\.\d+)?$/.test(raw)) fecha = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000);
    else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(raw)) {
      const [d, m, y] = raw.split(/[/-]/).map(Number); fecha = new Date(y, m - 1, d, 12);
    } else fecha = new Date(raw);
    const servicio = get(r, "servicio"), notas = get(r, "notas");
    if (!cliente || !servicio || !Number.isFinite(+fecha) || +fecha > Date.now()) { errores++; return; }
    const importeTexto = get(r, "importe").replace(/[\s€]/g, "");
    const importe = Number(importeTexto.includes(",") ? importeTexto.replace(/\./g, "").replace(",", ".") : importeTexto);
    if (importeTexto && (!Number.isFinite(importe) || importe < 0)) { errores++; return; }
    visitas.push({ fila: i + 2, fecha: fecha.toISOString(), cliente, servicio, importe: Number.isFinite(importe) ? importe : 0,
      profesional: get(r, "profesional"), notas: notas || undefined,
      colorFormula: /\b\d{1,2}[./]\d{1,2}\b|\bvol(?:umen(?:es)?)?\b/i.test(notas) ? notas : undefined });
  });
  return { visitas, errores };
}
