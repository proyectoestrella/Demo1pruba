import { describe, expect, it } from "bun:test";
import { codificarEstado, correoDeLaCuenta, decodificarEstado, intercambiarCodigo, refrescarToken, urlDeAutorizacion } from "./google-oauth";

const SECRETO = "un-secreto-de-pruebas";
const CONFIG = { clientId: "cliente-123", clientSecret: "shh", redirectUri: "https://sishow.app/api/calendario-externo/google/callback" };

function fetchFalso(respuestas: Array<{ ok: boolean; status?: number; json?: unknown; text?: string }>) {
  let i = 0;
  const llamadas: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    const r = respuestas[i++] ?? respuestas[respuestas.length - 1];
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json ?? {}),
    } as Response;
  }) as typeof fetch;
  return { impl, llamadas };
}

describe("estado firmado del OAuth", () => {
  it("codifica y decodifica lo mismo", () => {
    const estado = codificarEstado({ salonSlug: "the-best-shave", employeeId: "noelia", userId: "u1" }, SECRETO);
    const de = decodificarEstado(estado, SECRETO);
    expect(de?.salonSlug).toBe("the-best-shave");
    expect(de?.employeeId).toBe("noelia");
    expect(de?.userId).toBe("u1");
  });

  it("rechaza un estado firmado con otro secreto", () => {
    const estado = codificarEstado({ salonSlug: "s", employeeId: null, userId: "u1" }, SECRETO);
    expect(decodificarEstado(estado, "otro-secreto")).toBeNull();
  });

  it("rechaza un estado manipulado (payload distinto de la firma)", () => {
    const estado = codificarEstado({ salonSlug: "s", employeeId: null, userId: "u1" }, SECRETO);
    const [json, firma] = estado.split(".");
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
    payload.salonSlug = "otro-salon";
    const jsonManipulado = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    expect(decodificarEstado(`${jsonManipulado}.${firma}`, SECRETO)).toBeNull();
  });

  it("caduca pasados los 10 minutos", () => {
    const ahora = Date.now();
    const estado = codificarEstado({ salonSlug: "s", employeeId: null, userId: "u1" }, SECRETO, ahora);
    expect(decodificarEstado(estado, SECRETO, ahora + 11 * 60_000)).toBeNull();
    expect(decodificarEstado(estado, SECRETO, ahora + 9 * 60_000)).not.toBeNull();
  });

  it("un texto que no es un estado no lanza, devuelve null", () => {
    expect(decodificarEstado("esto-no-es-un-estado-valido", SECRETO)).toBeNull();
  });
});

describe("urlDeAutorizacion", () => {
  it("lleva los scopes mínimos y el state", () => {
    const url = new URL(urlDeAutorizacion(CONFIG, "el-state"));
    expect(url.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(url.searchParams.get("state")).toBe("el-state");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("scope")).toContain("calendar.freebusy");
    expect(url.searchParams.get("scope")).not.toContain("calendar.readonly");
  });
});

describe("intercambio y refresco de tokens", () => {
  it("intercambia el code por access+refresh token", async () => {
    const { impl } = fetchFalso([{ ok: true, json: { access_token: "acc1", refresh_token: "ref1", expires_in: 3600 } }]);
    const tokens = await intercambiarCodigo(CONFIG, "el-code", impl);
    expect(tokens).toEqual({ accessToken: "acc1", refreshToken: "ref1", expiresIn: 3600 });
  });

  it("lanza si Google responde con error", async () => {
    const { impl } = fetchFalso([{ ok: false, status: 400, text: "invalid_grant" }]);
    await expect(intercambiarCodigo(CONFIG, "code-malo", impl)).rejects.toThrow(/400/);
  });

  it("refresca sin pedir un refresh_token nuevo", async () => {
    const { impl } = fetchFalso([{ ok: true, json: { access_token: "acc2", expires_in: 3600 } }]);
    const r = await refrescarToken(CONFIG, "ref1", impl);
    expect(r).toEqual({ accessToken: "acc2", expiresIn: 3600 });
  });

  it("propaga el error de un refresh_token revocado", async () => {
    const { impl } = fetchFalso([{ ok: false, status: 400, text: "invalid_grant: token revocado" }]);
    await expect(refrescarToken(CONFIG, "ref-revocado", impl)).rejects.toThrow();
  });
});

describe("correoDeLaCuenta", () => {
  it("devuelve el email", async () => {
    const { impl } = fetchFalso([{ ok: true, json: { email: "noelia@gmail.com" } }]);
    expect(await correoDeLaCuenta("acc1", impl)).toBe("noelia@gmail.com");
  });

  it("null si falla, nunca lanza (es solo cosmético)", async () => {
    const { impl } = fetchFalso([{ ok: false, status: 401 }]);
    expect(await correoDeLaCuenta("acc-caducado", impl)).toBeNull();
  });
});
