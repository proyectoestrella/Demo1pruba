import { describe, expect, it } from "bun:test";
import { mensajeCorreccion } from "./deshacer-maqueta";

describe("mensaje de corrección al deshacer algo ya avisado (barrido 2026-09-26)", () => {
  it("una cita con la fecha ilegible no manda «Invalid Date» a la clienta", () => {
    for (const tipo of ["cita.confirmar", "cita.cancelar", "cita.mover"] as const) {
      const m = mensajeCorreccion({ tipo }, "Ana", { start: "fecha-rota" });
      expect(m).not.toContain("Invalid");
      expect(m).toContain("Hola Ana");
    }
  });

  it("con fecha buena la sigue diciendo", () => {
    expect(mensajeCorreccion({ tipo: "cita.cancelar" }, "Ana", { start: "2026-09-29T15:00:00.000Z" })).toContain(" del ");
  });

  it("sin cita tampoco revienta", () => {
    expect(mensajeCorreccion({ tipo: "senal.pedir" }, "Ana", null)).toContain("señal");
  });
});
