import { describe, expect, it } from "bun:test";
import { altaSubdominio, leerArgumentos } from "./alta-subdominio";

type Llamada = { metodo: string; url: string; cuerpo?: unknown; auth?: string };

/** Vercel de mentira: responde según «método + ruta sin query». */
function vercelFalso(respuestas: Record<string, { status: number; body: unknown } | Array<{ status: number; body: unknown }>>) {
  const llamadas: Llamada[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const metodo = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    llamadas.push({
      metodo,
      url,
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      auth: headers.authorization,
    });
    const clave = `${metodo} ${u.pathname}`;
    let r = respuestas[clave];
    if (Array.isArray(r)) r = r.shift() ?? { status: 500, body: {} };
    if (!r) return new Response(JSON.stringify({ error: { code: "not_found", message: clave } }), { status: 404 });
    return new Response(JSON.stringify(r.body), { status: r.status });
  };
  return { fetch, llamadas };
}

const DOM = "/v9/projects/prueba28juliokt/domains/peluchic.sishow.es";
const CONF = "/v6/domains/peluchic.sishow.es/config";
const confBien = { status: 200, body: { misconfigured: false, configuredBy: "CNAME", recommendedCNAME: [{ rank: 1, value: "abc.vercel-dns-017.com." }] } };
const confMal = { status: 200, body: { misconfigured: true, configuredBy: null, recommendedCNAME: [{ rank: 1, value: "abc.vercel-dns-017.com." }] } };

describe("leerArgumentos", () => {
  it("slug y --aplicar en cualquier orden; simulación por defecto", () => {
    expect(leerArgumentos(["peluchic"])).toEqual({ slug: "peluchic", aplicar: false });
    expect(leerArgumentos(["--aplicar", "peluchic"])).toEqual({ slug: "peluchic", aplicar: true });
    expect(leerArgumentos([])).toEqual({ slug: null, aplicar: false });
  });
});

describe("altaSubdominio", () => {
  it("rechaza slugs que no sirven como subdominio, sin llamar a nadie", async () => {
    const v = vercelFalso({});
    for (const slug of ["www", "api", "pelu chic", "-peluchic", "pelu.chic"]) {
      const r = await altaSubdominio({ slug, aplicar: true, token: "t", fetch: v.fetch, log: () => {} });
      expect(r.codigo).toBe(1);
    }
    expect(v.llamadas).toHaveLength(0);
  });

  it("sin token, la simulación solo enseña el plan y no llama a la API", async () => {
    const v = vercelFalso({});
    const lineas: string[] = [];
    const r = await altaSubdominio({ slug: "PeluChic", aplicar: false, fetch: v.fetch, log: (l) => lineas.push(l), dominio: "sishow.es" });
    expect(r.codigo).toBe(0);
    expect(r.dominio).toBe("peluchic.sishow.es");
    expect(v.llamadas).toHaveLength(0);
    expect(lineas.join("\n")).toContain('POST https://api.vercel.com/v10/projects/prueba28juliokt/domains?slug=estrellavercel-s-projects  {"name":"peluchic.sishow.es"}');
  });

  it("con --aplicar y sin token falla sin llamar", async () => {
    const v = vercelFalso({});
    const r = await altaSubdominio({ slug: "peluchic", aplicar: true, fetch: v.fetch, log: () => {}, dominio: "sishow.es" });
    expect(r.codigo).toBe(1);
    expect(v.llamadas).toHaveLength(0);
  });

  it("la simulación con token solo hace GET (nunca POST)", async () => {
    const v = vercelFalso({ [`GET ${CONF}`]: confMal });
    const r = await altaSubdominio({ slug: "peluchic", aplicar: false, token: "tok", fetch: v.fetch, log: () => {}, dominio: "sishow.es" });
    expect(r.codigo).toBe(0);
    expect(r.existia).toBe(false);
    expect(r.anadido).toBe(false);
    expect(v.llamadas.every((l) => l.metodo === "GET")).toBe(true);
    expect(v.llamadas.map((l) => new URL(l.url).pathname)).toEqual([DOM, CONF]);
    // equipo por slug y token en la cabecera, nunca en la URL
    for (const l of v.llamadas) {
      expect(new URL(l.url).searchParams.get("slug")).toBe("estrellavercel-s-projects");
      expect(l.url).not.toContain("tok");
      expect(l.auth).toBe("Bearer tok");
    }
  });

  it("--aplicar añade el dominio, lo da por verificado y comprueba el DNS", async () => {
    const v = vercelFalso({
      [`POST /v10/projects/prueba28juliokt/domains`]: { status: 200, body: { name: "peluchic.sishow.es", verified: true } },
      [`GET ${CONF}`]: confBien,
    });
    const lineas: string[] = [];
    const r = await altaSubdominio({ slug: "peluchic", aplicar: true, token: "tok", fetch: v.fetch, log: (l) => lineas.push(l), dominio: "sishow.es" });
    expect(r).toMatchObject({ codigo: 0, existia: false, anadido: true, verificado: true, dnsBien: true });
    const post = v.llamadas.find((l) => l.metodo === "POST");
    expect(post?.cuerpo).toEqual({ name: "peluchic.sishow.es" });
    expect(lineas.at(-1)).toBe("✓ Listo: https://peluchic.sishow.es");
  });

  it("si ya estaba y verificado, no lo vuelve a añadir (idempotente)", async () => {
    const v = vercelFalso({
      [`GET ${DOM}`]: { status: 200, body: { name: "peluchic.sishow.es", verified: true } },
      [`GET ${CONF}`]: confBien,
    });
    const r = await altaSubdominio({ slug: "peluchic", aplicar: true, token: "tok", fetch: v.fetch, log: () => {}, dominio: "sishow.es" });
    expect(r).toMatchObject({ codigo: 0, existia: true, anadido: false, verificado: true });
    expect(v.llamadas.some((l) => l.metodo === "POST")).toBe(false);
  });

  it("si Vercel lo deja sin verificar, intenta verificar y sale con 2 si sigue pendiente", async () => {
    const v = vercelFalso({
      [`POST /v10/projects/prueba28juliokt/domains`]: {
        status: 200,
        body: { name: "peluchic.sishow.es", verified: false, verification: [{ type: "TXT", domain: "_vercel.sishow.es", value: "vc-domain-verify=x", reason: "pending_domain_verification" }] },
      },
      [`POST ${DOM}/verify`]: { status: 400, body: { error: { code: "missing_txt_record", message: "no TXT" } } },
      [`GET ${CONF}`]: confMal,
    });
    const lineas: string[] = [];
    const r = await altaSubdominio({ slug: "peluchic", aplicar: true, token: "tok", fetch: v.fetch, log: (l) => lineas.push(l), dominio: "sishow.es" });
    expect(r).toMatchObject({ codigo: 2, anadido: true, verificado: false, dnsBien: false });
    expect(lineas.join("\n")).toContain("TXT en _vercel.sishow.es = vc-domain-verify=x");
    expect(lineas.join("\n")).toContain("CNAME peluchic → abc.vercel-dns-017.com.");
  });

  it("si Vercel rechaza el alta (p. ej. 409, dominio en otro proyecto) sale con 1", async () => {
    const v = vercelFalso({
      [`POST /v10/projects/prueba28juliokt/domains`]: { status: 409, body: { error: { code: "domain_already_in_use", message: "otro proyecto" } } },
    });
    const lineas: string[] = [];
    const r = await altaSubdominio({ slug: "peluchic", aplicar: true, token: "tok", fetch: v.fetch, log: (l) => lineas.push(l), dominio: "sishow.es" });
    expect(r.codigo).toBe(1);
    expect(lineas.join("\n")).toContain("domain_already_in_use");
  });

  it("un token inválido (401 al consultar) es error, sin intentar escribir", async () => {
    const v = vercelFalso({ [`GET ${DOM}`]: { status: 401, body: { error: { code: "forbidden", message: "token" } } } });
    const r = await altaSubdominio({ slug: "peluchic", aplicar: true, token: "malo", fetch: v.fetch, log: () => {}, dominio: "sishow.es" });
    expect(r.codigo).toBe(1);
    expect(v.llamadas).toHaveLength(1);
  });
});
