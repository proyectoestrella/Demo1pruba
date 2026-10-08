import { describe, expect, it } from "bun:test";
import { bloqueoAplicaEnHueco } from "./bloqueos-agenda";
import { isoDelSalon } from "./zona-horaria";

describe("bloqueos manuales", () => {
  it("un bloqueo semanal de viernes 14:00–15:00 quita ese hueco", () => {
    const inicio = isoDelSalon("2026-10-09", "14:00");
    const bloqueo = { id: "comida", profesionalId: "ana", inicio, fin: isoDelSalon("2026-10-09", "15:00"), recurrente: { diaSemana: 5 } } as const;
    expect(bloqueoAplicaEnHueco(bloqueo, "ana", isoDelSalon("2026-10-16", "14:30"), 30, "Europe/Madrid")).toBe(true);
    expect(bloqueoAplicaEnHueco(bloqueo, "ana", isoDelSalon("2026-10-16", "15:00"), 30, "Europe/Madrid")).toBe(false);
    expect(bloqueoAplicaEnHueco(bloqueo, "ana", isoDelSalon("2026-10-15", "14:30"), 30, "Europe/Madrid")).toBe(false);
  });
});
