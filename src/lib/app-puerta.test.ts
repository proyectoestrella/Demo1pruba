import { describe, expect, mock, test } from "bun:test";
import { AccesoNoVerificable } from "./acceso-con-reintento";

let resultado: () => Promise<unknown> = async () => ({ real: true, permitido: true, miembro: null });
mock.module("@/lib/acceso-actual-panel", () => ({
  accesoPanel: { obtener: () => resultado() },
  permitidoEnRuta: () => true,
  salirPorRevocacion: () => {},
}));

const { puertaDelPanel } = await import("./app-puerta");

describe("puertaDelPanel (beforeLoad de /app)", () => {
  test("AccesoNoVerificable: no redirige ni lanza; decide la guardia (que reintenta)", async () => {
    resultado = async () => { throw new AccesoNoVerificable(); };
    await expect(puertaDelPanel({ search: { s: "peluchic" }, pathname: "/app" })).resolves.toBeUndefined();
  });
  test("negativa firme (sin sesión local): intenta redirigir a /login (redirect = Response 307)", async () => {
    resultado = async () => ({ real: true, permitido: false, miembro: null, motivo: "sin_sesion" });
    const vistos: unknown[] = [];
    const original = console.error;
    console.error = (...a: unknown[]) => { vistos.push(...a); };
    try { await puertaDelPanel({ search: { s: "peluchic" }, pathname: "/app" }).catch(() => {}); } finally { console.error = original; }
    expect(vistos.some((v) => v instanceof Response && v.status === 307)).toBe(true);
  });
});
