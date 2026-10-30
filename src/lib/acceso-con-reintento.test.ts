import { describe, expect, test } from "bun:test";
import { AccesoNoVerificable, accesoConReintento, esRevocacion } from "./acceso-con-reintento";

const OK = { real: true, permitido: true };
const SIN_SESION = { real: true, permitido: false, motivo: "sin_sesion" };
const NO_VERIF = { real: true, permitido: false, motivo: "no_verificable" };
const REVOCADO = { real: true, permitido: false, motivo: "revocado" };

function montar(respuestas: Array<Record<string, unknown> | Error>) {
  let llamadas = 0;
  let refrescos = 0;
  return {
    preguntar: async () => {
      const r = respuestas[Math.min(llamadas++, respuestas.length - 1)];
      if (r instanceof Error) throw r;
      return r as typeof OK & { motivo?: string };
    },
    refrescar: async () => { refrescos++; return true; },
    cuenta: () => ({ llamadas, refrescos }),
  };
}

describe("accesoConReintento", () => {
  test("token caducado: refresca, reintenta una vez y entra (no hay cierre)", async () => {
    const m = montar([SIN_SESION, OK]);
    const r = await accesoConReintento(m.preguntar, m.refrescar);
    expect(r.permitido).toBe(true);
    expect(m.cuenta()).toEqual({ llamadas: 2, refrescos: 1 });
  });
  test("error de red / 5xx en la primera: refresca y reintenta", async () => {
    const m = montar([new Error("fetch failed"), OK]);
    expect((await accesoConReintento(m.preguntar, m.refrescar)).permitido).toBe(true);
    expect(m.cuenta().refrescos).toBe(1);
  });
  test("si sigue sin poder verificarse lanza AccesoNoVerificable (y no es revocación)", async () => {
    const m = montar([NO_VERIF, NO_VERIF]);
    await expect(accesoConReintento(m.preguntar, m.refrescar)).rejects.toBeInstanceOf(AccesoNoVerificable);
    expect(m.cuenta().llamadas).toBe(2);
  });
  test("red caída en las dos: no devuelve una negativa, lanza", async () => {
    const m = montar([new Error("x"), new Error("y")]);
    await expect(accesoConReintento(m.preguntar, m.refrescar)).rejects.toBeInstanceOf(AccesoNoVerificable);
  });
  test("el refresco que falla no impide el reintento", async () => {
    const m = montar([SIN_SESION, OK]);
    const r = await accesoConReintento(m.preguntar, async () => { throw new Error("offline"); });
    expect(r.permitido).toBe(true);
  });
  test("revocación explícita: se devuelve al momento, sin reintentos", async () => {
    const m = montar([REVOCADO]);
    const r = await accesoConReintento(m.preguntar, m.refrescar);
    expect(esRevocacion(r)).toBe(true);
    expect(m.cuenta()).toEqual({ llamadas: 1, refrescos: 0 });
  });
  test("solo 'revocado' cuenta como revocación", () => {
    expect(esRevocacion(REVOCADO)).toBe(true);
    expect(esRevocacion(SIN_SESION)).toBe(false);
    expect(esRevocacion(NO_VERIF)).toBe(false);
    expect(esRevocacion({ real: true, permitido: false })).toBe(false); // servidor viejo sin motivo
    expect(esRevocacion(OK)).toBe(false);
  });

  test("sin sesión local y sin_sesion tras reintentar: devuelve la negativa (va a /login)", async () => {
    const m = montar([SIN_SESION, SIN_SESION]);
    const r = await accesoConReintento(m.preguntar, m.refrescar, () => false);
    expect(r.permitido).toBe(false);
    expect(esRevocacion(r)).toBe(false);
  });
  test("con sesión local y sin_sesion persistente: no devuelve negativa, lanza (no borra)", async () => {
    const m = montar([SIN_SESION, SIN_SESION]);
    await expect(accesoConReintento(m.preguntar, m.refrescar, () => true)).rejects.toBeInstanceOf(AccesoNoVerificable);
    expect(m.cuenta().refrescos).toBe(1);
  });
  test("sin sesión local pero el servidor no responde (no_verificable): sigue lanzando", async () => {
    const m = montar([NO_VERIF, NO_VERIF]);
    await expect(accesoConReintento(m.preguntar, m.refrescar, () => false)).rejects.toBeInstanceOf(AccesoNoVerificable);
  });
});
