import { describe, expect, it } from "bun:test";
import { comoEventoExternoListado } from "./google-calendar";
import { diffBloqueosExternos } from "./servicio-sincronizacion";
import { aplicarDiffBloqueos } from "./calendario-externo.server";

const SECRETO = "Oncólogo Dr. Pérez - sala 3";

function dbFalsa() {
  const llamadas: Array<{ op: string; fila: unknown }> = [];
  const db = {
    from: () => ({
      upsert: async (fila: unknown) => (llamadas.push({ op: "upsert", fila }), { error: null }),
      update: (fila: unknown) => {
        llamadas.push({ op: "update", fila });
        const q: any = { eq: () => q, then: (r: (v: unknown) => void) => r({ error: null }) };
        return q;
      },
      delete: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }),
    }),
  };
  return { db: db as never, llamadas };
}

describe("privacidad de eventos ajenos (aviso 122)", () => {
  it("Google: el título ajeno no sale del adaptador", () => {
    const r = comoEventoExternoListado({ id: "e1", status: "confirmed", summary: SECRETO, start: { dateTime: "2026-10-01T09:00:00Z" }, end: { dateTime: "2026-10-01T09:30:00Z" } });
    expect(JSON.stringify(r)).not.toContain("Oncólogo");
    expect(r.resumen).toBeNull();
  });
  it("aunque un adaptador pasara título, el diff y el guardado no lo escriben", async () => {
    const ev = [{ eventoExternoId: "x", intervalo: { start: "2026-10-01T09:00:00Z", end: "2026-10-01T09:30:00Z" }, resumen: SECRETO, citaIdPropio: null }];
    const crear = diffBloqueosExternos(ev, [], "s", null, true);
    const previo = { conexionId: "c", salonSlug: "s", employeeId: null, eventoExternoId: "x", startAt: "2026-10-01T08:00:00Z", endAt: "2026-10-01T08:30:00Z", resumen: null };
    const actualizar = diffBloqueosExternos(ev, [previo], "s", null, true);
    const { db, llamadas } = dbFalsa();
    await aplicarDiffBloqueos(db, "c", { aCrear: crear.aCrear, aActualizar: actualizar.aActualizar, aBorrar: [] });
    expect(llamadas.map((l) => l.op).sort()).toEqual(["update", "upsert"]);
    expect(JSON.stringify(llamadas)).not.toContain("Oncólogo");
    for (const l of llamadas) expect(Object.keys(l.fila as object)).not.toContain("resumen");
  });
});
