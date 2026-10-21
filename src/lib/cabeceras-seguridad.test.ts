import { describe, expect, it } from "bun:test";
import { conCabecerasSeguridad } from "./cabeceras-seguridad";

describe("cabeceras de seguridad", () => {
  it("protege HTML y API sin perder sus cabeceras", () => {
    const r = conCabecerasSeguridad(new Response("ok", { status: 201, headers: { "Cache-Control": "no-store" } }));
    expect(r.status).toBe(201);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(r.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });
});

