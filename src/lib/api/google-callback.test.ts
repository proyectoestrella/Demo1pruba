import { describe, expect, it } from "bun:test";
import { Route } from "@/routes/api.calendario-externo.google.callback";
import { SCOPES_GOOGLE, codificarEstado, urlDeAutorizacion } from "@/lib/calendario-externo/google-oauth";

/**
 * Lote 17: la vuelta del consentimiento de Google tiene que dejar a la
 * persona en el MISMO dominio del callback (sishow.es o vercel.app), porque
 * la sesión del panel vive por origen. La ruta responde con una `Location`
 * relativa; el navegador la resuelve contra la URL del callback.
 */
type Get = (ctx: { request: Request }) => Promise<Response>;
const handlers = (Route.options as unknown as { server: { handlers: { GET: Get } } }).server.handlers;

async function vuelta(url: string): Promise<URL> {
  const r = await handlers.GET({ request: new Request(url) });
  expect(r.status).toBe(302);
  const loc = r.headers.get("location") ?? "";
  expect(loc.startsWith("/app/settings?")).toBe(true);
  return new URL(loc, url);
}

describe("callback de Google: URL de vuelta", () => {
  for (const origen of ["https://sishow.es", "https://prueba28juliokt.vercel.app"]) {
    it(`en ${origen} vuelve a ${origen}/app/settings`, async () => {
      const cancelado = await vuelta(`${origen}/api/calendario-externo/google/callback?error=access_denied`);
      expect(cancelado.origin).toBe(origen);
      expect(cancelado.pathname).toBe("/app/settings");
      expect(cancelado.searchParams.get("calendario")).toBe("error");

      const incompleto = await vuelta(`${origen}/api/calendario-externo/google/callback?code=abc`);
      expect(incompleto.origin).toBe(origen);
      expect(incompleto.searchParams.get("motivo")).toContain("Falta código o estado");
    });
  }

  it("un state que no valida no llega a Google y vuelve con el motivo", async () => {
    const antes = { ...process.env };
    Object.assign(process.env, {
      GOOGLE_CALENDAR_CLIENT_ID: "id-prueba",
      GOOGLE_CALENDAR_CLIENT_SECRET: "secreto-prueba",
      GOOGLE_CALENDAR_REDIRECT_URI: "https://sishow.es/api/calendario-externo/google/callback",
      CALENDARIO_CLAVE_CIFRADO: "clave-de-prueba-para-firmar-el-state",
    });
    try {
      const u = await vuelta("https://sishow.es/api/calendario-externo/google/callback?code=abc&state=falso.firma");
      expect(u.origin).toBe("https://sishow.es");
      expect(u.searchParams.get("calendario")).toBe("error");
      expect(u.searchParams.get("motivo")).toContain("caducado o no es válido");
    } finally {
      for (const k of ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_REDIRECT_URI", "CALENDARIO_CLAVE_CIFRADO"]) {
        if (antes[k] === undefined) delete process.env[k];
        else process.env[k] = antes[k];
      }
    }
  });
});

describe("URL de autorización con el dominio sishow.es", () => {
  it("lleva la redirect_uri exacta y los tres scopes", () => {
    const redirectUri = "https://sishow.es/api/calendario-externo/google/callback";
    const state = codificarEstado({ salonSlug: "pruebas-sishow", employeeId: "e1", userId: "u1" }, "clave");
    const u = new URL(urlDeAutorizacion({ clientId: "id", clientSecret: "s", redirectUri }, state));
    expect(u.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(u.searchParams.get("scope")?.split(" ")).toEqual([
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.freebusy",
      "https://www.googleapis.com/auth/userinfo.email",
    ]);
    expect([...SCOPES_GOOGLE]).toHaveLength(3);
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
  });
});
