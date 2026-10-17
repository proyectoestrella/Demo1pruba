import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { completarDatosTpvCliente, detectarColumnas, importarVisitas, leerCsv, leerTabla, leerXls, leerXlsx, normalizarDniCif, normalizarFechaTpv, normalizarTelefono, vistaPreviaClientas } from "./importar-clientas";
import type { Client } from "./mock/types";

const existente: Client = { id: "c1", name: "Marta Martín", phone: "612345678", createdAt: "2020-01-01" };

test("CSV con BOM, comillas, saltos de línea, alias y duplicados", () => {
  const tabla = leerCsv('\uFEFFNombre;Apellidos;Móvil;E-mail;Observaciones;DNI\r\nMarta;Martín;+34 612 345 678;;"línea 1\nlínea 2";123\r\nMarisol;Pérez;0034 699 888 777;m@example.es;"tono 6.3, 20 vol";456\r\nMarisol;Pérez;699888777;;;456\r\n;;;x;;\r\n');
  expect(tabla.filas[0][4]).toBe("línea 1\nlínea 2");
  const previa = vistaPreviaClientas(tabla, [existente], detectarColumnas(tabla.cabeceras));
  expect([previa.nuevas, previa.duplicadas, previa.errores]).toEqual([1, 2, 1]);
  expect(previa.filas[1].telefono).toBe("699888777");
  expect(normalizarTelefono("+34 612 345 678")).toBe("612345678");
});

// Genera un ZIP mínimo con entradas DEFLATE, como las de un .xlsx habitual.
function xlsx(entries: Record<string, string>): Uint8Array {
  const files: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const n = Buffer.from(name), packed = deflateRawSync(Buffer.from(content));
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(Buffer.byteLength(content), 22); local.writeUInt16LE(n.length, 26);
    files.push(local, n, packed);
    const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(Buffer.byteLength(content), 24);
    dir.writeUInt16LE(n.length, 28); dir.writeUInt32LE(offset, 42);
    central.push(dir, n); offset += local.length + n.length + packed.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(Buffer.concat(central).length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, ...central, end]);
}

function biff(tipo: number, datos: Buffer): Buffer {
  const cabecera = Buffer.alloc(4); cabecera.writeUInt16LE(tipo, 0); cabecera.writeUInt16LE(datos.length, 2);
  return Buffer.concat([cabecera, datos]);
}
function cadenaBiff(texto: string): Buffer {
  const datos = Buffer.from(texto, "utf16le"), cabecera = Buffer.alloc(3);
  cabecera.writeUInt16LE(texto.length, 0); cabecera[2] = 1;
  return Buffer.concat([cabecera, datos]);
}
function etiquetaSst(fila: number, columna: number, indice: number): Buffer {
  const datos = Buffer.alloc(10); datos.writeUInt16LE(fila, 0); datos.writeUInt16LE(columna, 2); datos.writeUInt32LE(indice, 6);
  return biff(0x00fd, datos);
}
function ole2ConWorkbook(workbook: Buffer): Uint8Array {
  const miniSectores = Math.ceil(workbook.length / 64), raizTamano = miniSectores * 64;
  const header = Buffer.alloc(512, 0); Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header);
  header.writeUInt16LE(0x003e, 24); header.writeUInt16LE(3, 26); header.writeUInt16LE(0xfffe, 28); header.writeUInt16LE(9, 30); header.writeUInt16LE(6, 32);
  header.writeUInt32LE(1, 44); header.writeUInt32LE(0, 48); header.writeUInt32LE(4096, 56); header.writeUInt32LE(1, 60); header.writeUInt32LE(1, 64); header.writeUInt32LE(0xfffffffe, 68);
  for (let i = 0; i < 109; i++) header.writeUInt32LE(i === 0 ? 4 : 0xffffffff, 76 + i * 4);
  const directorio = Buffer.alloc(512, 0), entrada = (pos: number, nombre: string, tipo: number, inicio: number, tamano: number) => {
    const texto = Buffer.from(`${nombre}\0`, "utf16le"); texto.copy(directorio, pos); directorio.writeUInt16LE(texto.length, pos + 64); directorio[pos + 66] = tipo;
    directorio.writeUInt32LE(inicio, pos + 116); directorio.writeUInt32LE(tamano, pos + 120);
  };
  entrada(0, "Root Entry", 5, 2, raizTamano); entrada(128, "Workbook", 2, 0, workbook.length);
  const miniFat = Buffer.alloc(512, 0xff); for (let i = 0; i < miniSectores; i++) miniFat.writeUInt32LE(i + 1 < miniSectores ? i + 1 : 0xfffffffe, i * 4);
  const miniStream = Buffer.alloc(Math.ceil(raizTamano / 512) * 512, 0); workbook.copy(miniStream);
  const fat = Buffer.alloc(512, 0xff); fat.writeUInt32LE(0xfffffffe, 0); fat.writeUInt32LE(0xfffffffe, 4);
  for (let i = 0; i < miniStream.length / 512; i++) fat.writeUInt32LE(i + 3 < miniStream.length / 512 + 2 ? i + 3 : 0xfffffffe, (i + 2) * 4);
  fat.writeUInt32LE(0xfffffffd, (miniStream.length / 512 + 2) * 4);
  return Buffer.concat([header, directorio, miniFat, miniStream, fat]);
}
// Fixture OLE2/BIFF8 sintético: cubre SST partido con CONTINUE, LABEL,
// NUMBER, RK, MULRK y una fórmula con resultado numérico almacenado.
function xlsTpv123(): Uint8Array {
  const cabeceras = ["COD", "Nombre", "Apellidos", "dnicif", "direccion", "F.Alta", "Cumpleaños", "Ult.Visita", "Telefono", "movi", "E-mail", "Dato 1", "Dato 2"];
  const compartidas = ["Observación extensa con ñ y tildes Áéíóú para cruzar CONTINUE", ...cabeceras, "PC-XLS-01", "Peña", "12345678Z", "angela@example.test"];
  const sstCompleto = Buffer.concat([Buffer.from([compartidas.length, 0, 0, 0, compartidas.length, 0, 0, 0]), ...compartidas.map(cadenaBiff)]);
  const corte = 19, sst = [biff(0x00fc, sstCompleto.subarray(0, corte)), biff(0x003c, Buffer.concat([Buffer.from([1]), sstCompleto.subarray(corte)]))];
  const bof = biff(0x0809, Buffer.from([0, 6, 5, 0, 0xbb, 0x0d, 0xcc, 0x07]));
  const nombreHoja = Buffer.from("Clientas", "latin1"), hoja = Buffer.alloc(8 + nombreHoja.length); hoja[6] = nombreHoja.length; hoja[7] = 0; nombreHoja.copy(hoja, 8);
  const globales = [bof, biff(0x0085, hoja), ...sst, biff(0x000a, Buffer.alloc(0))];
  const inicioHoja = globales.reduce((total, registro) => total + registro.length, 0); globales[1]!.writeUInt32LE(inicioHoja, 4);
  const celdas = cabeceras.map((_, columna) => etiquetaSst(0, columna, columna + 1));
  celdas.push(etiquetaSst(1, 0, 14));
  const nombre = Buffer.alloc(6); nombre.writeUInt16LE(1, 0); nombre.writeUInt16LE(1, 2); celdas.push(biff(0x0204, Buffer.concat([nombre, cadenaBiff("Ángela")])))
  celdas.push(etiquetaSst(1, 2, 15), etiquetaSst(1, 3, 16));
  const alta = Buffer.alloc(14); alta.writeUInt16LE(1, 0); alta.writeUInt16LE(5, 2); alta.writeDoubleLE(43876, 6); celdas.push(biff(0x0203, alta));
  const cumple = Buffer.alloc(10); cumple.writeUInt16LE(1, 0); cumple.writeUInt16LE(6, 2); cumple.writeUInt32LE((31356 << 2 | 2) >>> 0, 6); celdas.push(biff(0x027e, cumple));
  const visita = Buffer.alloc(20); visita.writeUInt16LE(1, 0); visita.writeUInt16LE(7, 2); visita.writeDoubleLE(46082, 6); celdas.push(biff(0x0006, visita));
  for (const [columna, valor] of [[8, 910000001], [9, 612000001]] as const) { const telefono = Buffer.alloc(14); telefono.writeUInt16LE(1, 0); telefono.writeUInt16LE(columna, 2); telefono.writeDoubleLE(valor, 6); celdas.push(biff(0x0203, telefono)); }
  const datos = Buffer.alloc(20); datos.writeUInt16LE(1, 0); datos.writeUInt16LE(11, 2); datos.writeUInt32LE(42 << 2 | 2, 8); datos.writeUInt32LE(123 << 2 | 2, 14); datos.writeUInt16LE(12, 18); celdas.push(biff(0x00bd, datos));
  celdas.push(etiquetaSst(1, 10, 17));
  const sheet = [biff(0x0809, Buffer.from([0, 6, 0x10, 0, 0xbb, 0x0d, 0xcc, 0x07])), ...celdas, biff(0x000a, Buffer.alloc(0))];
  return ole2ConWorkbook(Buffer.concat([...globales, ...sheet]));
}

test("lee la primera hoja xlsx con cadenas compartidas y DEFLATE", async () => {
  const bytes = xlsx({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Clientes" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": '<sst><si><t>Nombre</t></si><si><t>Teléfono</t></si><si><t>Elena Gómez</t></si></sst>',
    "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="inlineStr"><is><t>+34 600 111 222</t></is></c></row></sheetData></worksheet>',
  });
  const tabla = await leerXlsx(bytes);
  const previa = vistaPreviaClientas(tabla, []);
  expect(previa.nuevas).toBe(1);
  expect(previa.filas[0].nombre).toBe("Elena Gómez");
  expect(previa.filas[0].telefono).toBe("600111222");
});

test("lee el .xls BIFF8 de TPV 123 igual que su .xlsx, incluso fechas y vacíos", async () => {
  const cabeceras = ["COD", "Nombre", "Apellidos", "dnicif", "direccion", "F.Alta", "Cumpleaños", "Ult.Visita", "Telefono", "movi", "E-mail", "Dato 1", "Dato 2"];
  const fila = ["PC-XLS-01", "Ángela", "Peña", "12345678Z", "", "43876", "31356", "46082", "910000001", "612000001", "angela@example.test", "42", "123"];
  const celda = (columna: number, valor: string, filaNumero: number) => `<c r="${String.fromCharCode(65 + columna)}${filaNumero}"${/^[\d.]+$/.test(valor) ? "" : ' t="inlineStr"'}>${/^[\d.]+$/.test(valor) ? `<v>${valor}</v>` : `<is><t>${valor}</t></is>`}</c>`;
  const xlsxEquivalente = xlsx({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Clientes" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1">${cabeceras.map((valor, columna) => celda(columna, valor, 1)).join("")}</row><row r="2">${fila.map((valor, columna) => celda(columna, valor, 2)).join("")}</row></sheetData></worksheet>`,
  });
  const tablaXls = leerXls(xlsTpv123()), tablaXlsx = await leerXlsx(xlsxEquivalente);
  expect(tablaXls).toEqual(tablaXlsx);
  expect(vistaPreviaClientas(tablaXls, [])).toEqual(vistaPreviaClientas(tablaXlsx, []));
  expect(tablaXls.filas[0]?.[4]).toBe("");
  expect(vistaPreviaClientas(tablaXls, []).filas[0]).toMatchObject({ nombre: "Ángela Peña", telefono: "612000001", tpvAltaDate: "2020-02-15", birthday: "1985-11-05", tpvLastVisit: "2026-03-01" });
});

test("rechaza un .xls corrupto con un error claro", async () => {
  await expect(leerTabla(new File([new Uint8Array([0, 1, 2, 3])], "clientes.xls"))).rejects.toThrow("El archivo .xls no es válido o está dañado.");
  await expect(leerTabla(new File(["x"], "clientes.txt"))).rejects.toThrow("Elige un archivo .csv, .xls o .xlsx.");
});

test("visitas enlazadas y fórmula de color en observaciones", () => {
  const tabla = leerCsv("Fecha,Cliente,Concepto,Importe,Empleada,Observaciones\n15/02/2025,Marta Martín,Tinte,45,Lucía,7/1 con 20 vol\n16/02/2025,Desconocida,Corte,20,Lucía,\n");
  const r = importarVisitas(tabla, [existente], { servicios: [{ id: "tinte", name: "Tinte" }], equipo: [{ id: "lucia", name: "Lucía" }] });
  expect(r.visitas).toHaveLength(1);
  expect(r.noEnlazadas).toBe(1);
  expect(r.visitas[0].colorFormula).toBe("7/1 con 20 vol");
  expect(r.visitas[0].notas).toBe("7/1 con 20 vol");
});

test("importa los datos útiles desde etiquetas de pantalla TPV 123", () => {
  const tabla = leerCsv("Código;Nombre;Apellidos;DNI/CIF;Email;Tel. Móvil;Tel. Fijo;Dirección;C.P.;Población;Provincia;Fecha Alta;Última Visita;Cumpleaños\n42;María;Pérez;123;mp@example.es;911 222 333;612 345 678;Calle 1;28001;Madrid;Madrid;15/02/2024;10/03/2025;01/01/1990\n");
  const previa = vistaPreviaClientas(tabla, []);
  expect(previa.filas[0]).toMatchObject({
    fila: 2, nombre: "María Pérez", telefono: "612345678", codigo: "42", email: "mp@example.es", estado: "nueva",
    taxId: "123", address: "Calle 1", tpvAltaDate: "2024-02-15", tpvLastVisit: "2025-03-10", birthday: "1990-01-01",
  });
  expect(previa.avisosDniCif).toBe(1);
});

test("importa clientas desde nombres de base de datos de TPV 123", () => {
  const tabla = leerCsv("codigocliente,nombre,apellidos,nif,email,telefono2,telefono1,Direccion,cp,poblacion,provincia,ingreso,ultimavisita,clientestexto3,nacimiento\n7,Lucía,Sanz,123,ls@example.es,699111222,915551111,Calle,08001,Barcelona,Barcelona,45123,45130,,32000\n");
  const previa = vistaPreviaClientas(tabla, []);
  expect(previa.filas[0]).toMatchObject({ fila: 2, nombre: "Lucía Sanz", telefono: "699111222", codigo: "7", email: "ls@example.es", address: "Calle", taxId: "123", estado: "nueva" });
  expect(previa.avisosDniCif).toBe(1);
});

test("reconoce las cabeceras exactas de PeluChic y conserva los datos aprobados", () => {
  const tabla = leerCsv("COD;Nombre;Apellidos;dnicif;direccion;F.Alta;Cumpleaños;Ult.Visita;movi;E-mail;recomendado\nPC-7;Lucía;Prueba;X;Calle inventada;01/01/2025;02/02/1990;03/03/2026;+34 612.345.678;lucia@example.test;Sí\n");
  const previa = vistaPreviaClientas(tabla, []);
  expect(previa.filas[0]).toMatchObject({
    fila: 2, nombre: "Lucía Prueba", telefono: "612345678", codigo: "PC-7", email: "lucia@example.test", estado: "nueva",
    taxId: "X", address: "Calle inventada", tpvAltaDate: "2025-01-01", birthday: "1990-02-02", tpvLastVisit: "2026-03-03",
  });
  expect(previa.filas[0]?.avisos).toContain("DNI/CIF con formato desconocido");
});

test("tolera apelidos y conserva un fijo sin confundirlo con el móvil", () => {
  const tabla = leerCsv("cod;Nombre;apelidos;movi;telefono\n8;Eva;Prueba;912 345 678;600 111 222\n");
  expect(vistaPreviaClientas(tabla, []).filas[0]).toMatchObject({ nombre: "Eva Prueba", telefono: "600111222", codigo: "8" });
});

test("móvil y fijo ocupan columnas distintas, con prioridad del móvil", () => {
  expect(detectarColumnas(["Nombre", "Apelidos", "Telefono", "Movi"])).toMatchObject({
    nombre: 0,
    apellidos: 1,
    telefono: 3,
    telefono2: 2,
  });

  // Las once cabeceras exportadas por TPV 123 de PeluChic: el móvil no puede
  // fundirse con el fijo ni depender del orden en que se recorren los alias.
  expect(detectarColumnas(["COD", "Nombre", "Apellidos", "dnicif", "direccion", "F.Alta", "Cumpleaños", "Ult.Visita", "Telefono", "movi", "E-mail"])).toEqual({
    codigo: 0,
    nombre: 1,
    apellidos: 2,
    dni: 3,
    direccion: 4,
    alta: 5,
    cumple: 6,
    ultimaVisita: 7,
    telefono: 9,
    telefono2: 8,
    email: 10,
  });
});

test("agrupa el histórico plano por clienta y fecha, enlaza por código y aproxima servicios y equipo", () => {
  const tabla = leerCsv("Código Cliente,Cliente,Factura,Fecha,Venta,Concepto,Empleado,Precio\n42,María Pérez,F1,10/03/2025,,Corte de puntas,Ana,20\n42,María Pérez,F1,10/03/2025,,Color raíz,Ana,35\n88,Desconocida,F2,11/03/2025,,Corte,Ana,20\n");
  const maria = { ...existente, id: "maria", name: "María Pérez" };
  const r = importarVisitas(tabla, [maria], { codigos: new Map([["42", "maria"]]), servicios: [{ id: "corte", name: "Corte de puntas" }], equipo: [{ id: "ana", name: "Ana" }] });
  expect(r.visitas).toHaveLength(1);
  expect(r.visitas[0]).toMatchObject({ servicios: ["corte"], importe: 55, profesional: "ana", notas: "Producto: Color raíz" });
  expect([r.noEnlazadas, r.lineas]).toEqual([1, 3]);
});

test("agrupa el histórico de informe con cabecera de clienta y conceptos bajo ella", () => {
  const tabla = leerCsv("Código,Nombre,Fecha,Artículo,Precio\n42,María Pérez,,,\n,,05/04/2025,Corte,18\n,,05/04/2025,Champú,12\n");
  const maria = { ...existente, id: "maria", name: "María Pérez" };
  const r = importarVisitas(tabla, [maria], { codigos: new Map([["42", "maria"]]), servicios: [{ id: "corte", name: "Corte" }] });
  expect(r.visitas).toHaveLength(1);
  expect(r.visitas[0]).toMatchObject({ servicios: ["corte"], importe: 30, notas: "Producto: Champú" });
});

test("permite asignar la columna del nombre y avisa si el .xls está dañado", async () => {
  const tabla = leerCsv("Persona,Tel.\nCristina,611 222 333\n");
  expect(vistaPreviaClientas(tabla, [], { nombre: 0, telefono: 1 }).nuevas).toBe(1);
  await expect(leerTabla(new File(["datos"], "clientes.xls"))).rejects.toThrow("El archivo .xls no es válido o está dañado.");
});

test("detecta el mismo nombre si alguna ficha no tiene teléfono", () => {
  const tabla = leerCsv("Nombre;Teléfono\nElena Ríos;600111222\nElena Ríos;\n");
  const r = vistaPreviaClientas(tabla, []);
  expect([r.nuevas, r.duplicadas]).toEqual([1, 1]);
});

test("guarda solo el código de TPV 123 y no duplica al reimportar", () => {
  const tabla = leerCsv("codigocliente;nombre;apellidos;telefono2;ingreso;nacimiento\r\n0042;Marta;Martín;612345678;01/02/2020;04/05/1990\r\n0043;Lucía;Pérez;699888777;15/03/2021;\r\n");
  const mapa = detectarColumnas(tabla.cabeceras);
  expect(mapa).toEqual({ codigo: 0, nombre: 1, apellidos: 2, telefono: 3 });
  const yaImportada: Client = { id: "c-1", name: "Marta Martín", phone: "600000000", createdAt: "2020-02-01T00:00:00.000Z", tpvCode: "0042" };
  const previa = vistaPreviaClientas(tabla, [yaImportada], mapa);
  expect(previa.filas[0]).toMatchObject({ codigo: "0042", estado: "duplicada", motivo: "Ya está importada con ese código de TPV 123" });
  expect(previa.filas[1]).toMatchObject({ codigo: "0043", estado: "nueva" });
});

test("normaliza fechas de TPV 123 y deja vacías las que no se pueden guardar", () => {
  expect(normalizarFechaTpv("05/11/1985", true)).toBe("1985-11-05");
  expect(normalizarFechaTpv("05-11-1985", true)).toBe("1985-11-05");
  expect(normalizarFechaTpv("1985-11-05 13:40", true)).toBe("1985-11-05");
  expect(normalizarFechaTpv("45123")).toBe("2023-07-16");
  expect(normalizarFechaTpv("05/11", true)).toBeUndefined();
  expect(normalizarFechaTpv("05/11/1885", true)).toBe("1885-11-05");
  expect(normalizarFechaTpv("05/11/2099", true)).toBe("2099-11-05");
  expect(normalizarFechaTpv("no es una fecha")).toBeUndefined();
});

test("DNI/CIF vacío no se guarda y un formato desconocido solo avisa", () => {
  expect(normalizarDniCif("")).toBeUndefined();
  expect(normalizarDniCif("  - ")).toBeUndefined();
  expect(normalizarDniCif(" x123 4567l ")).toBe("X1234567L");
  const previa = vistaPreviaClientas(leerCsv("Nombre;Móvil;DNI/CIF\nNora;600111222;abc\nNoa;600111223;-\n"), []);
  expect(previa.filas[0]).toMatchObject({ taxId: "ABC", estado: "nueva" });
  expect(previa.filas[1]?.taxId).toBeUndefined();
  expect(previa.avisosDniCif).toBe(1);
});

test("una reimportación completa solo los datos TPV que faltan", () => {
  const existenteConDatos: Client = {
    id: "c-datos", name: "Marta Martín", phone: "600111222", createdAt: "2020-01-01", tpvCode: "PC-1",
    address: "Calle ya guardada", taxId: "12345678Z", birthday: "1980-01-01",
  };
  const fila = vistaPreviaClientas(leerCsv("COD;Nombre;movi;direccion;dnicif;F.Alta;Cumpleaños;Ult.Visita\nPC-1;Marta Martín;600111222;Calle nueva;87654321X;01/02/2020;02/03/1990;04/05/2025\n"), [existenteConDatos]).filas[0]!;
  expect(fila.estado).toBe("duplicada");
  expect(completarDatosTpvCliente(existenteConDatos, fila)).toEqual({ tpvAltaDate: "2020-02-01", tpvLastVisit: "2025-05-04" });
});

test("el CSV ficticio completo de PeluChic pasa por la vista previa", () => {
  const csv = readFileSync(join(import.meta.dir, "__fixtures__", "peluchic-clientas-tpv123.csv"), "utf8");
  const previa = vistaPreviaClientas(leerCsv(csv), []);
  expect([previa.nuevas, previa.errores]).toEqual([4, 0]);
  expect([previa.conCumpleanos, previa.conDireccion, previa.conDniCif, previa.conFechaAlta, previa.conUltimaVisita]).toEqual([3, 4, 3, 3, 3]);
  expect(previa.avisosFecha).toBe(3);
});

test("la vista previa hace dry-run y no muta las clientas existentes", () => {
  const existentes = Object.freeze([{ id: "c-sintetica", name: "Eva QA", phone: "600111222", createdAt: "2025-01-01" }]) as unknown as Client[];
  const csvSintetico = leerCsv("codigocliente;nombre;apellidos;telefono2;telefono1;email;observaciones\nTPV-10;Eva;QA;600 111 222;911 222 333;eva@example.test;fórmula inventada\nTPV-11;Sara;QA;699 333 444;;sara.example;dato inválido\nTPV-12;Lola;QA;622 555 666;;lola@example.test;nota sintética\n");
  const antes = JSON.stringify(existentes);
  const previa = vistaPreviaClientas(csvSintetico, existentes);
  expect([previa.nuevas, previa.duplicadas, previa.errores]).toEqual([1, 1, 1]);
  expect(previa.filas[0]).toMatchObject({ estado: "duplicada" });
  expect(previa.filas[1]).toMatchObject({ estado: "error", motivo: "Correo no válido" });
  expect(previa.filas[2]).toMatchObject({ estado: "nueva", telefono: "622555666" });
  expect(previa.filas.flatMap((f) => Object.keys(f))).not.toContain("notas");
  expect(JSON.stringify(existentes)).toBe(antes);
});
