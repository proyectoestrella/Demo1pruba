import { describe, expect, it } from "bun:test";
import { recargoActivo } from "./recargo-activo";

describe("recargoActivo", () => {
  it("apaga la política si falta el importe o es cero", () => {
    expect(recargoActivo({})).toBe(false);
    expect(recargoActivo({ noShowFeeEur: null })).toBe(false);
    expect(recargoActivo({ noShowFeeEur: 0 })).toBe(false);
    expect(recargoActivo({ noShowFeeEur: -1 })).toBe(false);
  });

  it("la activa para cualquier importe positivo", () => {
    expect(recargoActivo({ noShowFeeEur: 7 })).toBe(true);
  });
});
