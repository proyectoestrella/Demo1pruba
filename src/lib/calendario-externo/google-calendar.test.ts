import { describe, expect, it } from "bun:test";
import {
  EventoGoogleNoExiste,
  SISHOW_PROP,
  actualizarEvento,
  borrarEvento,
  consultarOcupado,
  crearEvento,
  iniciarWatch,
  listarEventosIncremental,
  pararWatch,
} from "./google-calendar";

function fetchFalso(guion: Array<(url: string, init?: RequestInit) => { ok: boolean; status?: number; json?: unknown; text?: string }>) {
  let i = 0;
  const llamadas: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    const r = guion[Math.min(i++, guion.length - 1)](url, init);
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json ?? {}),
    } as Response;
  }) as typeof fetch;
  return { impl, llamadas };
}

const EVENTO = { citaId: "cita-1", resumen: "Corte · Ana", inicioISO: "2026-10-01T10:00:00.000Z", finISO: "2026-10-01T10:30:00.000Z" };

describe("crearEvento", () => {
  it("manda iCalUID estable y la marca sishowCitaId para no crear ecos", async () => {
    const { impl, llamadas } = fetchFalso([() => ({ ok: true, json: { id: "google-evt-1" } })]);
    const r = await crearEvento("acc", "primary", EVENTO, impl);
    expect(r).toEqual({ id: "google-evt-1" });
    const body = JSON.parse(llamadas[0].init!.body as string);
    expect(body.iCalUID).toBe("cita-1@sishow.app");
    expect(body.extendedProperties.private[SISHOW_PROP]).toBe("cita-1");
    expect(llamadas[0].url).toContain("/calendars/primary/events");
  });

  it("lanza si Google responde con error", async () => {
    const { impl } = fetchFalso([() => ({ ok: false, status: 500, text: "boom" })]);
    await expect(crearEvento("acc", "primary", EVENTO, impl)).rejects.toThrow(/500/);
  });
});

describe("actualizarEvento", () => {
  it("PATCH al id existente", async () => {
    const { impl, llamadas } = fetchFalso([() => ({ ok: true, json: { id: "google-evt-1" } })]);
    await actualizarEvento("acc", "primary", "google-evt-1", EVENTO, impl);
    expect(llamadas[0].init!.method).toBe("PATCH");
    expect(llamadas[0].url).toContain("events/google-evt-1");
  });

  it("un 404 se distingue como 'ya no existe', no como error genérico", async () => {
    const { impl } = fetchFalso([() => ({ ok: false, status: 404 })]);
    await expect(actualizarEvento("acc", "primary", "borrado-a-mano", EVENTO, impl)).rejects.toThrow(EventoGoogleNoExiste);
  });
});

describe("borrarEvento", () => {
  it("un 404 (ya borrado) no es un error", async () => {
    const { impl } = fetchFalso([() => ({ ok: false, status: 404 })]);
    await expect(borrarEvento("acc", "primary", "x", impl)).resolves.toBeUndefined();
  });

  it("propaga un error de verdad", async () => {
    const { impl } = fetchFalso([() => ({ ok: false, status: 500, text: "boom" })]);
    await expect(borrarEvento("acc", "primary", "x", impl)).rejects.toThrow(/500/);
  });
});

describe("listarEventosIncremental", () => {
  it("pagina hasta agotar nextPageToken y devuelve el nextSyncToken final", async () => {
    const { impl } = fetchFalso([
      () => ({ ok: true, json: { items: [{ id: "e1", status: "confirmed" }], nextPageToken: "p2" } }),
      () => ({ ok: true, json: { items: [{ id: "e2", status: "cancelled" }], nextSyncToken: "sync-99" } }),
    ]);
    const r = await listarEventosIncremental("acc", "primary", "sync-anterior", impl);
    expect(r.necesitaResync).toBe(false);
    if (!r.necesitaResync) {
      expect(r.items.map((e) => e.id)).toEqual(["e1", "e2"]);
      expect(r.nextSyncToken).toBe("sync-99");
    }
  });

  it("un 410 (token caducado) pide resync completo", async () => {
    const { impl } = fetchFalso([() => ({ ok: false, status: 410 })]);
    const r = await listarEventosIncremental("acc", "primary", "sync-viejo", impl);
    expect(r.necesitaResync).toBe(true);
  });

  it("sin syncToken pide desde el principio (resync completo)", async () => {
    const { impl, llamadas } = fetchFalso([() => ({ ok: true, json: { items: [] } })]);
    await listarEventosIncremental("acc", "primary", null, impl);
    const url = new URL(llamadas[0].url);
    expect(url.searchParams.has("syncToken")).toBe(false);
    expect(url.searchParams.has("timeMin")).toBe(true);
  });
});

describe("consultarOcupado", () => {
  it("devuelve solo intervalos ocupado/libre, no detalle", async () => {
    const { impl } = fetchFalso([
      () => ({ ok: true, json: { calendars: { primary: { busy: [{ start: "2026-10-01T09:00:00Z", end: "2026-10-01T09:30:00Z" }] } } } }),
    ]);
    const r = await consultarOcupado("acc", "primary", "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z", impl);
    expect(r).toEqual([{ inicio: "2026-10-01T09:00:00Z", fin: "2026-10-01T09:30:00Z" }]);
  });
});

describe("watch", () => {
  it("iniciarWatch pide un canal y guarda resourceId + expiración", async () => {
    const { impl } = fetchFalso([() => ({ ok: true, json: { resourceId: "res-1", expiration: "1999999999000" } })]);
    const r = await iniciarWatch("acc", "primary", { canalId: "canal-1", address: "https://sishow.app/api/calendario-externo/google/webhook" }, impl);
    expect(r).toEqual({ id: "canal-1", resourceId: "res-1", expirationMs: 1999999999000 });
  });

  it("pararWatch no falla si el canal ya no existe", async () => {
    const { impl } = fetchFalso([() => ({ ok: false, status: 404 })]);
    await expect(pararWatch("acc", { id: "c", resourceId: "r" }, impl)).resolves.toBeUndefined();
  });
});
