import { expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { detectarColumnas, importarVisitas, leerCsv, leerTabla, leerXlsx, normalizarTelefono, vistaPreviaClientas } from "./importar-clientas";
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

test("visitas enlazadas y fórmula de color en observaciones", () => {
  const tabla = leerCsv("Fecha,Cliente,Concepto,Importe,Empleada,Observaciones\n15/02/2025,Marta Martín,Tinte,45,Lucía,7/1 con 20 vol\n16/02/2025,Desconocida,Corte,20,Lucía,\n");
  const r = importarVisitas(tabla, [existente], { servicios: [{ id: "tinte", name: "Tinte" }], equipo: [{ id: "lucia", name: "Lucía" }] });
  expect(r.visitas).toHaveLength(1);
  expect(r.noEnlazadas).toBe(1);
  expect(r.visitas[0].colorFormula).toBe("7/1 con 20 vol");
  expect(r.visitas[0].notas).toBe("7/1 con 20 vol");
});

test("importa clientas desde etiquetas de pantalla TPV 123 y minimiza sus datos", () => {
  const tabla = leerCsv("Código;Nombre;Apellidos;DNI/CIF;Email;Tel. Móvil;Tel. Fijo;Dirección;C.P.;Población;Provincia;Fecha Alta;Última Visita;Cumpleaños\n42;María;Pérez;123;mp@example.es;911 222 333;612 345 678;Calle 1;28001;Madrid;Madrid;15/02/2024;10/03/2025;01/01/1990\n");
  const previa = vistaPreviaClientas(tabla, []);
  expect(previa.filas[0]).toMatchObject({ nombre: "María Pérez", telefono: "612345678", otroTelefono: "911222333", codigo: "42", email: "mp@example.es", fechaAlta: expect.any(String), notas: "Otro teléfono: 911222333" });
});

test("importa clientas desde nombres de base de datos de TPV 123", () => {
  const tabla = leerCsv("codigocliente,nombre,apellidos,nif,email,telefono2,telefono1,Direccion,cp,poblacion,provincia,ingreso,ultimavisita,clientestexto3,nacimiento\n7,Lucía,Sanz,123,ls@example.es,699111222,915551111,Calle,08001,Barcelona,Barcelona,45123,45130,,32000\n");
  const previa = vistaPreviaClientas(tabla, []);
  expect(previa.filas[0]).toMatchObject({ nombre: "Lucía Sanz", telefono: "699111222", otroTelefono: "915551111", codigo: "7", email: "ls@example.es" });
  expect(new Date(previa.filas[0].fechaAlta!).toISOString().slice(0, 10)).toBe("2023-07-16");
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

test("permite asignar la columna del nombre y explica el formato .xls antiguo", async () => {
  const tabla = leerCsv("Persona,Tel.\nCristina,611 222 333\n");
  expect(vistaPreviaClientas(tabla, [], { nombre: 0, telefono: 1 }).nuevas).toBe(1);
  await expect(leerTabla(new File(["datos"], "clientes.xls"))).rejects.toThrow("Ábrelo y guárdalo como .xlsx o .csv");
});

test("detecta el mismo nombre si alguna ficha no tiene teléfono", () => {
  const tabla = leerCsv("Nombre;Teléfono\nElena Ríos;600111222\nElena Ríos;\n");
  const r = vistaPreviaClientas(tabla, []);
  expect([r.nuevas, r.duplicadas]).toEqual([1, 1]);
});

test("guarda el código de TPV 123 y el cumpleaños, y no duplica al reimportar por código", () => {
  const tabla = leerCsv("codigocliente;nombre;apellidos;telefono2;ingreso;nacimiento\r\n0042;Marta;Martín;612345678;01/02/2020;04/05/1990\r\n0043;Lucía;Pérez;699888777;15/03/2021;\r\n");
  const mapa = detectarColumnas(tabla.cabeceras);
  expect(mapa.nacimiento).toBe(5);
  const yaImportada: Client = { id: "c-1", name: "Marta Martín", phone: "600000000", createdAt: "2020-02-01T00:00:00.000Z", tpvCode: "0042" };
  const previa = vistaPreviaClientas(tabla, [yaImportada], mapa);
  expect(previa.filas[0]).toMatchObject({ codigo: "0042", estado: "duplicada", motivo: "Ya está importada con ese código de TPV 123" });
  expect(previa.filas[1]).toMatchObject({ codigo: "0043", nacimiento: undefined, estado: "nueva" });
  const sinPrevias = vistaPreviaClientas(tabla, [], mapa);
  expect(sinPrevias.filas[0]).toMatchObject({ codigo: "0042", nacimiento: "1990-05-04", fechaAlta: "2020-02-01T11:00:00.000Z", estado: "nueva" });
});
