/**
 * Prueba la función de servidor REAL (`getCalendarSubscription` y
 * `regenerateCalendarSubscription`) con un Supabase de mentira: la cadena de
 * autorización de verdad (autorizacion.server → autorizacion → guardas) corre
 * entera; solo se sustituyen la base de datos y la cabecera de la petición.
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar } from "./doble-start";

let cabecera: string | null = null;
let doble = crearDobleSupabase({});
mock.module("../supabase.server", () => ({ getSupabaseServerClient: () => doble }));
mock.module("@tanstack/react-start/server", () => ({
  getRequestHeader: (n: string) => (n.toLowerCase() === "authorization" ? (cabecera ?? undefined) : undefined),
  getRequestUrl: () => new URL("https://sishow.test/x"),
}));
instalarDobleStart();
const { getCalendarSubscription, regenerateCalendarSubscription } = await import("./calendar.functions");

const TOKEN_A = "T".repeat(43);
const TOKEN_B = "U".repeat(43);

function mundo() {
  doble = crearDobleSupabase(
    {
      salons: [{ slug: "salon-a" }, { slug: "salon-b" }],
      salon_members: [
        { user_id: "ana", salon_slug: "salon-a", rol: "gerente", estado: "activa" },
        { user_id: "eva", salon_slug: "salon-a", rol: "estilista", estado: "activa" },
        { user_id: "bruno", salon_slug: "salon-b", rol: "gerente", estado: "activa" },
      ],
      calendar_subscriptions: [
        { salon_slug: "salon-a", token: TOKEN_A },
        { salon_slug: "salon-b", token: TOKEN_B },
      ],
    },
    { tokens: { "tk-ana": "ana", "tk-eva": "eva", "tk-bruno": "bruno" } },
  );
}
beforeEach(() => { cabecera = null; mundo(); });

describe("getCalendarSubscription", () => {
  it("sin sesión: denegado y no consulta el token", async () => {
    await expect(llamar(getCalendarSubscription, { slug: "salon-a" })).rejects.toThrow(/No tienes acceso/);
    expect(doble.consultas.some((c) => c.tabla === "calendar_subscriptions")).toBe(false);
  });
  it("token basura: denegado", async () => {
    cabecera = "Bearer inventado";
    await expect(llamar(getCalendarSubscription, { slug: "salon-a" })).rejects.toThrow(/No tienes acceso/);
  });
  it("usuario de OTRO salón: denegado y nunca ve el token ajeno", async () => {
    cabecera = "Bearer tk-bruno";
    await expect(llamar(getCalendarSubscription, { slug: "salon-a" })).rejects.toThrow(/No tienes acceso/);
  });
  it("rol insuficiente (estilista): sin permiso salon.editar", async () => {
    cabecera = "Bearer tk-eva";
    await expect(llamar(getCalendarSubscription, { slug: "salon-a" })).rejects.toThrow(/no permite hacer esto/);
  });
  it("entrada inválida: slug vacío o demasiado largo", async () => {
    cabecera = "Bearer tk-ana";
    await expect(llamar(getCalendarSubscription, { slug: "" })).rejects.toThrow();
    await expect(llamar(getCalendarSubscription, { slug: "x".repeat(121) })).rejects.toThrow();
  });
  it("la gerente de su salón recibe SU token y la consulta va filtrada por su slug", async () => {
    cabecera = "Bearer tk-ana";
    expect(await llamar(getCalendarSubscription, { slug: "salon-a" })).toEqual({ token: TOKEN_A });
    const c = doble.consultas.find((q) => q.tabla === "calendar_subscriptions")!;
    expect(c.filtros).toEqual([["salon_slug", "salon-a"]]);
  });
  it("un error de la base no filtra datos de otro salón", async () => {
    doble = crearDobleSupabase(
      { salons: [{ slug: "salon-a" }], salon_members: [{ user_id: "ana", salon_slug: "salon-a", rol: "gerente", estado: "activa" }], calendar_subscriptions: [{ salon_slug: "salon-b", token: TOKEN_B }] },
      { tokens: { "tk-ana": "ana" }, errorEn: { calendar_subscriptions: "boom" } },
    );
    cabecera = "Bearer tk-ana";
    const e = await llamar(getCalendarSubscription, { slug: "salon-a" }).catch((x) => x as Error);
    expect(String((e as Error).message)).not.toContain(TOKEN_B);
  });
});

describe("regenerateCalendarSubscription", () => {
  it("sin sesión, otro salón o rol insuficiente: no escribe nada", async () => {
    for (const c of [null, "Bearer tk-bruno", "Bearer tk-eva"]) {
      cabecera = c;
      await expect(llamar(regenerateCalendarSubscription, { slug: "salon-a" })).rejects.toThrow();
    }
    expect(doble.escrituras).toHaveLength(0);
  });
  it("la gerente regenera un token nuevo de 43 caracteres solo para su salón", async () => {
    cabecera = "Bearer tk-ana";
    const r = await llamar<{ token: string }>(regenerateCalendarSubscription, { slug: "salon-a" });
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(doble.escrituras).toHaveLength(1);
    expect((doble.escrituras[0].datos as { salon_slug: string }).salon_slug).toBe("salon-a");
  });
});
