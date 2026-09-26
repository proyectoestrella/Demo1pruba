import { expect, test } from "bun:test";
import { leerCsv } from "./importar-clientas";
import { importarPagosTpv } from "./importar-pagos-tpv";
import type { Client, Employee } from "./mock/types";

const maria: Client = { id: "maria", name: "María Pérez", phone: "612345678", createdAt: "2020-01-01" };
const ana: Employee = { id: "ana", name: "Ana", specialty: "", yearsExperience: 1, photo: "", colorVar: "--x", schedule: [] };

test("cada línea es un pago; misma factura repetida no se agrupa en una visita", () => {
  const tabla = leerCsv(
    "Código Cliente,Cliente,Factura,Fecha,Venta,Concepto,Empleado,Precio\n" +
      "42,María Pérez,F1,10/03/2025,,Corte de puntas,Ana,20\n" +
      "42,María Pérez,F1,10/03/2025,,Color raíz,Ana,35\n" +
      "88,Desconocida,F2,11/03/2025,,Corte,Ana,20\n",
  );
  const r = importarPagosTpv(tabla, [maria], { codigos: new Map([["42", "maria"]]), equipo: [ana] });
  expect(r.lineas).toBe(3);
  expect(r.pagos).toHaveLength(3);
  expect(r.pagos.map((p) => p.refExterna)).toEqual(["F1", "F1#2", "F2"]);
  expect(r.pagos[0]).toMatchObject({ importeEur: 20, clienteId: "maria", clienteNombre: "María Pérez", cobradoPor: "ana", concepto: "servicio", nota: "Corte de puntas" });
  expect(r.pagos[1]).toMatchObject({ importeEur: 35, clienteId: "maria" });
  expect(r.pagos[2]).toMatchObject({ importeEur: 20, clienteNombre: "Desconocida", clienteId: undefined });
  expect([r.casadas, r.noCasadas]).toEqual([2, 1]);
});

test("sin columna Factura: usa el número de fila (estable en un reimport del mismo fichero)", () => {
  const csv = "Fecha,Cliente,Concepto,Precio\n15/02/2025,Marta,Tinte,45\n16/02/2025,Marta,Secado,10\n";
  const r1 = importarPagosTpv(leerCsv(csv), []);
  const r2 = importarPagosTpv(leerCsv(csv), []);
  expect(r1.pagos.map((p) => p.refExterna)).toEqual(r2.pagos.map((p) => p.refExterna));
  expect(r1.pagos.map((p) => p.refExterna)).toEqual(["sin-factura-2", "sin-factura-3"]);
});

test("casa por nombre normalizado cuando no hay código", () => {
  const tabla = leerCsv("Cliente,Factura,Fecha,Concepto,Precio\nMaria Perez,F9,01/04/2025,Corte,18\n");
  const r = importarPagosTpv(tabla, [maria]);
  expect(r.pagos[0].clienteId).toBe("maria");
  expect(r.casadas).toBe(1);
});

test("fila con importe o fecha inválidos cuenta como error y no genera pago", () => {
  const tabla = leerCsv("Cliente,Factura,Fecha,Concepto,Precio\nMaria Perez,F9,fecha-mala,Corte,18\n");
  const r = importarPagosTpv(tabla, [maria]);
  expect(r.errores).toBe(1);
  expect(r.pagos).toHaveLength(0);
});

test("informe agrupa el histórico de informe con cabecera de clienta y conceptos bajo ella (mismo formato que importarVisitas)", () => {
  const tabla = leerCsv("Código,Nombre,Fecha,Artículo,Factura,Precio\n42,María Pérez,,,,\n,,05/04/2025,Corte,FX,18\n,,05/04/2025,Champú,FX,12\n");
  const r = importarPagosTpv(tabla, [maria], { codigos: new Map([["42", "maria"]]) });
  expect(r.pagos).toHaveLength(2);
  expect(r.pagos.map((p) => p.refExterna)).toEqual(["FX", "FX#2"]);
  expect(r.pagos.every((p) => p.clienteId === "maria")).toBe(true);
});
