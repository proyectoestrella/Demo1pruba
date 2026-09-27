import { describe, expect, it } from "bun:test";
import { proveedorDeCorreo, remitenteDeCorreo } from "./email.server";

describe("remitenteDeCorreo (REMINDER_FROM_EMAIL)", () => {
  it("acepta «siShow <recordatorios@sishow.es>» tal cual", () => {
    expect(remitenteDeCorreo("siShow <recordatorios@sishow.es>")).toBe("siShow <recordatorios@sishow.es>");
    expect(remitenteDeCorreo("recordatorios@sishow.es")).toBe("recordatorios@sishow.es");
  });

  it("quita espacios y comillas que envuelven todo el valor, pero respeta un nombre entre comillas", () => {
    expect(remitenteDeCorreo('  "siShow <recordatorios@sishow.es>"  ')).toBe("siShow <recordatorios@sishow.es>");
    expect(remitenteDeCorreo("'siShow <recordatorios@sishow.es>'")).toBe("siShow <recordatorios@sishow.es>");
    expect(remitenteDeCorreo('"siShow" <recordatorios@sishow.es>')).toBe('"siShow" <recordatorios@sishow.es>');
    expect(remitenteDeCorreo("")).toBeUndefined();
    expect(remitenteDeCorreo('""')).toBeUndefined();
    expect(remitenteDeCorreo(undefined)).toBeUndefined();
  });
});

describe("proveedorDeCorreo con Resend", () => {
  it("manda el remitente de REMINDER_FROM_EMAIL exacto a la API de Resend", async () => {
    const antes = { k: process.env.RESEND_API_KEY, f: process.env.REMINDER_FROM_EMAIL };
    process.env.RESEND_API_KEY = "re_prueba";
    process.env.REMINDER_FROM_EMAIL = "siShow <recordatorios@sishow.es>";
    const peticiones: Array<{ url: string; body: Record<string, unknown>; auth: string }> = [];
    const fetchFalso = (async (url: string, init?: RequestInit) => {
      peticiones.push({
        url,
        body: JSON.parse(String(init?.body)),
        auth: (init?.headers as Record<string, string>).Authorization,
      });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const p = proveedorDeCorreo(fetchFalso);
      expect(p?.nombre).toBe("resend");
      await p!.enviar({ para: "clienta@example.com", asunto: "Mañana", texto: "t", html: "<p>t</p>" });
      expect(peticiones).toHaveLength(1);
      expect(peticiones[0].url).toBe("https://api.resend.com/emails");
      expect(peticiones[0].body.from).toBe("siShow <recordatorios@sishow.es>");
      expect(peticiones[0].body.to).toEqual(["clienta@example.com"]);
      expect(peticiones[0].auth).toBe("Bearer re_prueba");
    } finally {
      if (antes.k === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = antes.k;
      if (antes.f === undefined) delete process.env.REMINDER_FROM_EMAIL;
      else process.env.REMINDER_FROM_EMAIL = antes.f;
    }
  });

  it("sin clave o sin remitente no hay proveedor (el cron dice «sin-proveedor»)", () => {
    const antes = { k: process.env.RESEND_API_KEY, f: process.env.REMINDER_FROM_EMAIL };
    process.env.RESEND_API_KEY = "re_prueba";
    process.env.REMINDER_FROM_EMAIL = "  ";
    try {
      expect(proveedorDeCorreo()).toBeNull();
    } finally {
      if (antes.k === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = antes.k;
      if (antes.f === undefined) delete process.env.REMINDER_FROM_EMAIL;
      else process.env.REMINDER_FROM_EMAIL = antes.f;
    }
  });
});
