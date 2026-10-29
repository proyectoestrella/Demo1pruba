import { describe, expect, it } from "bun:test";
import { bloqueoAplicaEnHueco, bloqueosFuturos, quitarBloqueos } from "./bloqueos-agenda";
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

describe("lista de bloqueos", () => {
  const z = "Europe/Madrid";
  const b = (id: string, pro: string, dia: string, extra: object = {}) => ({ id, profesionalId: pro, inicio: isoDelSalon(dia, "14:00", z), fin: isoDelSalon(dia, "15:00", z), ...extra });
  const todos = [
    b("pasado", "ana", "2026-10-01"),
    b("futuro2", "ana", "2026-11-10"),
    b("futuro1", "luz", "2026-11-02"),
    b("semanal", "ana", "2026-10-02", { recurrente: { diaSemana: 5 } }),
    b("salon", "salon", "2026-12-01"),
  ];
  const ahora = isoDelSalon("2026-10-29", "10:00", z);
  it("solo deja los que quedan por delante, puntuales primero por fecha y semanales al final", () => {
    expect(bloqueosFuturos(todos, ahora).map((x) => x.id)).toEqual(["futuro1", "futuro2", "salon", "semanal"]);
  });
  it("filtra por profesional y por todo el salón", () => {
    expect(bloqueosFuturos(todos, ahora, "ana").map((x) => x.id)).toEqual(["futuro2", "semanal"]);
    expect(bloqueosFuturos(todos, ahora, "salon").map((x) => x.id)).toEqual(["salon"]);
  });
  it("quita varios a la vez sin tocar el resto, y tolera lista vacía", () => {
    expect(quitarBloqueos(todos, ["futuro1", "semanal"]).map((x) => x.id)).toEqual(["pasado", "futuro2", "salon"]);
    expect(quitarBloqueos(undefined, ["x"])).toEqual([]);
  });
});
