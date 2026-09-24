import { describe, expect, it } from "bun:test";
import { buscarClientas } from "./buscar-clientas";
import type { Appointment, Client } from "./mock/types";

const cliente = (id: string, name: string, extra: Partial<Client> = {}): Client => ({ id, name, phone: "+34 600 123 456", createdAt: "2025-01-01", ...extra });
const cita = (clientId: string, colorFormula: string, technicalNotes = ""): Appointment => ({
  id: clientId, clientId, clientName: "", serviceIds: ["color"], employeeId: "mario",
  start: "2026-09-01T10:00:00Z", duration: 60, priceEur: 40, status: "completed", colorFormula, technicalNotes,
});
const clientes = [
  cliente("marta", "Marta García", { notes: "Prefiere miércoles", email: "marta@example.com" }),
  cliente("martin", "Martín López"),
  cliente("ines", "Inés Ruiz", { phone: "+34 611 987 654" }),
];
const citas = [cita("marta", "7.1 + 20 vol"), cita("martin", "6.0", "matiz violeta")];

describe("buscarClientas", () => {
  it("encuentra Marta y Martín al buscar marta, con el nombre exacto primero", () => {
    expect(buscarClientas("marta", { clientes, citas }).map((c) => c.id)).toEqual(["marta", "martin"]);
  });
  it("ignora tildes, orden de palabras y formato del teléfono", () => {
    expect(buscarClientas("ruiz ines", { clientes, citas }).map((c) => c.id)).toEqual(["ines"]);
    expect(buscarClientas("987654", { clientes, citas }).map((c) => c.id)).toEqual(["ines"]);
    expect(buscarClientas("+34 611 987", { clientes, citas }).map((c) => c.id)).toEqual(["ines"]);
  });
  it("busca en fórmulas, notas técnicas, correo y observaciones", () => {
    expect(buscarClientas("20 vol", { clientes, citas }).map((c) => c.id)).toEqual(["marta"]);
    expect(buscarClientas("7.1", { clientes, citas }).map((c) => c.id)).toEqual(["marta"]);
    expect(buscarClientas("violeta", { clientes, citas }).map((c) => c.id)).toEqual(["martin"]);
    expect(buscarClientas("miércoles", { clientes, citas }).map((c) => c.id)).toEqual(["marta"]);
    expect(buscarClientas("example.com", { clientes, citas }).map((c) => c.id)).toEqual(["marta"]);
  });
});
