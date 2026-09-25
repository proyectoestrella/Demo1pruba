import { describe, expect, test } from "bun:test";
import { cifraDe, familiasParecidas, normalizar, responder } from "./motor-maqueta";
import { clients, seedAppointments, seedWaitlist } from "../mock/seed";
import { employees, services } from "../mock/salon";
import type { Client } from "../mock/types";

const ctx = { appointments: seedAppointments, services, employees, waitlist: seedWaitlist, clients, salonName: "PeluChic" };

describe("motor de maqueta del asistente", () => {
  test("normaliza abreviaturas y tildes como la especificación", () => {
    expect(normalizar("¿Kien viene mñn?")).toBe("quien viene manana");
    expect(normalizar("Q tengo HOI")).toBe("que tengo hoy");
  });
  test("parecido léxico: la forma de María encuentra su familia", () => {
    expect(familiasParecidas("huecos sabado", 3).map((f) => f.id)).toContain("huecos-dia");
    expect(familiasParecidas("cuanto lleva noelia este mes", 3).map((f) => f.id)).toContain("dinero-profesional");
  });
  test("una pregunta conocida da respuesta con cifra; una desconocida, tres sugerencias", () => {
    const r = responder("cuantas citas tengo hoy", ctx);
    expect(r.tipo).toBe("respuesta");
    const n = responder("xyzzy plof", ctx);
    expect(n.tipo).toBe("no-se");
    if (n.tipo === "no-se") expect(n.sugerencias).toHaveLength(3);
  });
  test("charla, escalado y desambiguación", () => {
    expect(responder("hola", ctx).tipo).toBe("respuesta");
    const e = responder("no me funciona la web", ctx);
    expect(e.tipo).toBe("escalar");
    if (e.tipo === "escalar") expect(e.mensaje).toContain("PeluChic");
    const dobles: Client[] = [...clients, { ...clients[0], id: "otra", name: `${clients[0].name.split(" ")[0]} Otra` }];
    const d = responder(`ficha de ${clients[0].name.split(" ")[0]}`, { ...ctx, clients: dobles });
    expect(d.tipo).toBe("elegir");
  });
  test("la cifra destacada es la primera con su unidad", () => {
    expect(cifraDe("Hoy llevas 335 € cobrados de 675 €")).toBe("335 €");
    expect(cifraDe("La agenda está al 53 %")).toBe("53 %");
  });
});
