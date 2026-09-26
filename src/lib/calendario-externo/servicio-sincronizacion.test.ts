import { describe, expect, it } from "bun:test";
import { diffBloqueosExternos, sincronizarCitaSaliente, tocaSincronizar, type AdaptadorCalendario, type DepsMapeo, type EventoExternoListado } from "./servicio-sincronizacion";
import type { BloqueoExterno, CitaParaCalendario, MapeoEvento } from "./tipos";

const CITA: CitaParaCalendario = {
  id: "cita-1", clientName: "Ana", service: "Corte", employeeId: "noelia",
  start: "2026-10-01T10:00:00.000Z", duration: 30, status: "confirmed",
};

function depsMapeoEnMemoria(iniciales: MapeoEvento[] = []) {
  const filas = new Map(iniciales.map((m) => [`${m.conexionId}:${m.citaId}`, m]));
  const deps: DepsMapeo = {
    async obtenerMapeo(conexionId, citaId) {
      return filas.get(`${conexionId}:${citaId}`) ?? null;
    },
    async guardarMapeo(m) {
      filas.set(`${m.conexionId}:${m.citaId}`, { ...m, id: "m1" });
    },
    async borrarMapeo(conexionId, citaId) {
      filas.delete(`${conexionId}:${citaId}`);
    },
  };
  return { deps, filas };
}

describe("sincronizarCitaSaliente", () => {
  it("con escribirCitas apagado no hace nada y reporta éxito", async () => {
    const { deps } = depsMapeoEnMemoria();
    const adaptador: AdaptadorCalendario = {
      crear: async () => { throw new Error("no debería llamarse"); },
      actualizar: async () => { throw new Error("no debería llamarse"); },
      borrar: async () => { throw new Error("no debería llamarse"); },
    };
    const r = await sincronizarCitaSaliente(CITA, "upsert", { id: "c1", escribirCitas: false }, adaptador, deps);
    expect(r).toEqual({ ok: true });
  });

  it("crea el evento la primera vez y guarda el mapeo", async () => {
    const { deps, filas } = depsMapeoEnMemoria();
    const adaptador: AdaptadorCalendario = {
      crear: async () => ({ eventoExternoId: "ext-1", etag: "e1" }),
      actualizar: async () => { throw new Error("no debería llamarse"); },
      borrar: async () => { throw new Error("no debería llamarse"); },
    };
    const r = await sincronizarCitaSaliente(CITA, "upsert", { id: "c1", escribirCitas: true }, adaptador, deps);
    expect(r).toEqual({ ok: true });
    expect(filas.get("c1:cita-1")).toMatchObject({ eventoExternoId: "ext-1", etag: "e1" });
  });

  it("con mapeo previo, actualiza en vez de crear", async () => {
    const { deps } = depsMapeoEnMemoria([{ id: "m0", conexionId: "c1", citaId: "cita-1", eventoExternoId: "ext-1", etag: "e1", icalUid: "cita-1@sishow.app" }]);
    let actualizado = false;
    const adaptador: AdaptadorCalendario = {
      crear: async () => { throw new Error("no debería llamarse"); },
      actualizar: async (id, etag) => { actualizado = true; expect(id).toBe("ext-1"); expect(etag).toBe("e1"); return { eventoExternoId: "ext-1", etag: "e2" }; },
      borrar: async () => { throw new Error("no debería llamarse"); },
    };
    const r = await sincronizarCitaSaliente(CITA, "upsert", { id: "c1", escribirCitas: true }, adaptador, deps);
    expect(r).toEqual({ ok: true });
    expect(actualizado).toBe(true);
  });

  it("si el proveedor dice 'no-existe' al actualizar, recrea el evento", async () => {
    const { deps, filas } = depsMapeoEnMemoria([{ id: "m0", conexionId: "c1", citaId: "cita-1", eventoExternoId: "ext-viejo", etag: "e1", icalUid: "x" }]);
    const adaptador: AdaptadorCalendario = {
      crear: async () => ({ eventoExternoId: "ext-nuevo", etag: null }),
      actualizar: async () => "no-existe",
      borrar: async () => { throw new Error("no debería llamarse"); },
    };
    const r = await sincronizarCitaSaliente(CITA, "upsert", { id: "c1", escribirCitas: true }, adaptador, deps);
    expect(r).toEqual({ ok: true });
    expect(filas.get("c1:cita-1")?.eventoExternoId).toBe("ext-nuevo");
  });

  it("borra el evento y el mapeo cuando la cita se cancela", async () => {
    const { deps, filas } = depsMapeoEnMemoria([{ id: "m0", conexionId: "c1", citaId: "cita-1", eventoExternoId: "ext-1", etag: "e1", icalUid: "x" }]);
    let borrado = false;
    const adaptador: AdaptadorCalendario = {
      crear: async () => { throw new Error("no debería llamarse"); },
      actualizar: async () => { throw new Error("no debería llamarse"); },
      borrar: async () => { borrado = true; },
    };
    const r = await sincronizarCitaSaliente(CITA, "borrar", { id: "c1", escribirCitas: true }, adaptador, deps);
    expect(r).toEqual({ ok: true });
    expect(borrado).toBe(true);
    expect(filas.has("c1:cita-1")).toBe(false);
  });

  it("borrar sin mapeo previo (nunca se llegó a escribir) no falla", async () => {
    const { deps } = depsMapeoEnMemoria();
    const adaptador: AdaptadorCalendario = {
      crear: async () => { throw new Error("x"); },
      actualizar: async () => { throw new Error("x"); },
      borrar: async () => { throw new Error("no debería llamarse"); },
    };
    const r = await sincronizarCitaSaliente(CITA, "borrar", { id: "c1", escribirCitas: true }, adaptador, deps);
    expect(r).toEqual({ ok: true });
  });

  it("un fallo del proveedor se reporta, no lanza", async () => {
    const { deps } = depsMapeoEnMemoria();
    const adaptador: AdaptadorCalendario = {
      crear: async () => { throw new Error("Google Calendar: 500"); },
      actualizar: async () => { throw new Error("x"); },
      borrar: async () => { throw new Error("x"); },
    };
    const r = await sincronizarCitaSaliente(CITA, "upsert", { id: "c1", escribirCitas: true }, adaptador, deps);
    expect(r).toEqual({ ok: false, error: "Google Calendar: 500" });
  });
});

const PREVIO = (over: Partial<BloqueoExterno> = {}): BloqueoExterno => ({
  conexionId: "c1", salonSlug: "the-best-shave", employeeId: "noelia",
  eventoExternoId: "ext-1", startAt: "2026-10-01T09:00:00Z", endAt: "2026-10-01T09:30:00Z", resumen: "Dentista",
  ...over,
});

describe("diffBloqueosExternos", () => {
  it("un evento nuevo (no eco, no visto antes) se crea", () => {
    const eventos: EventoExternoListado[] = [{ eventoExternoId: "ext-2", intervalo: { start: "2026-10-01T11:00:00Z", end: "2026-10-01T11:30:00Z" }, resumen: "Médico", citaIdPropio: null }];
    const r = diffBloqueosExternos(eventos, [], "s", "noelia", true);
    expect(r.aCrear).toEqual([{ salonSlug: "s", employeeId: "noelia", eventoExternoId: "ext-2", startAt: "2026-10-01T11:00:00Z", endAt: "2026-10-01T11:30:00Z", resumen: "Médico" }]);
  });

  it("un eco propio (citaIdPropio) nunca se crea como bloqueo", () => {
    const eventos: EventoExternoListado[] = [{ eventoExternoId: "ext-eco", intervalo: { start: "2026-10-01T10:00:00Z", end: "2026-10-01T10:30:00Z" }, resumen: "Corte · Ana", citaIdPropio: "cita-1" }];
    const r = diffBloqueosExternos(eventos, [], "s", "noelia", true);
    expect(r.aCrear).toEqual([]);
  });

  it("un evento con las mismas fechas y resumen no genera cambios", () => {
    const previo = PREVIO();
    const eventos: EventoExternoListado[] = [{ eventoExternoId: previo.eventoExternoId, intervalo: { start: previo.startAt, end: previo.endAt }, resumen: previo.resumen, citaIdPropio: null }];
    const r = diffBloqueosExternos(eventos, [previo], "s", "noelia", true);
    expect(r.aCrear).toEqual([]);
    expect(r.aActualizar).toEqual([]);
    expect(r.aBorrar).toEqual([]);
  });

  it("un evento con la hora movida se actualiza", () => {
    const previo = PREVIO();
    const eventos: EventoExternoListado[] = [{ eventoExternoId: previo.eventoExternoId, intervalo: { start: "2026-10-01T10:00:00Z", end: "2026-10-01T10:30:00Z" }, resumen: previo.resumen, citaIdPropio: null }];
    const r = diffBloqueosExternos(eventos, [previo], "s", "noelia", true);
    expect(r.aActualizar).toEqual([{ eventoExternoId: previo.eventoExternoId, startAt: "2026-10-01T10:00:00Z", endAt: "2026-10-01T10:30:00Z", resumen: previo.resumen }]);
  });

  it("cancelado explícitamente (intervalo null) se borra", () => {
    const previo = PREVIO();
    const eventos: EventoExternoListado[] = [{ eventoExternoId: previo.eventoExternoId, intervalo: null, resumen: null, citaIdPropio: null }];
    const r = diffBloqueosExternos(eventos, [previo], "s", "noelia", true);
    expect(r.aBorrar).toEqual([previo.eventoExternoId]);
  });

  it("un bloqueo previo que ya no aparece en absoluto (Apple) se borra", () => {
    const previo = PREVIO();
    const r = diffBloqueosExternos([], [previo], "s", "noelia", true);
    expect(r.aBorrar).toEqual([previo.eventoExternoId]);
  });

  it("con bloquearHuecos apagado, se borra todo y no se crea nada", () => {
    const previo = PREVIO();
    const eventos: EventoExternoListado[] = [{ eventoExternoId: "ext-nuevo", intervalo: { start: "x", end: "y" }, resumen: null, citaIdPropio: null }];
    const r = diffBloqueosExternos(eventos, [previo], "s", "noelia", false);
    expect(r.aCrear).toEqual([]);
    expect(r.aActualizar).toEqual([]);
    expect(r.aBorrar).toEqual([previo.eventoExternoId]);
  });
});

describe("tocaSincronizar (panel)", () => {
  const ahora = new Date("2026-09-27T10:00:00Z");
  it("sin sincronización previa o con fecha rota, toca", () => {
    expect(tocaSincronizar(null, ahora)).toBe(true);
    expect(tocaSincronizar("no-es-fecha", ahora)).toBe(true);
  });
  it("a los 5 minutos toca; antes, no", () => {
    expect(tocaSincronizar("2026-09-27T09:55:00Z", ahora)).toBe(true);
    expect(tocaSincronizar("2026-09-27T09:56:00Z", ahora)).toBe(false);
  });
});
