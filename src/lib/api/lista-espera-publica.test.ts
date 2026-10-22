/**
 * La clienta se apunta sola a la lista de espera desde la web de reservas:
 * función de servidor real con un Supabase de mentira (sin red).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";
import { salon } from "../mock/salon";
import { servicesForType } from "../mock/salon";

let doble = crearDobleSupabase({});
const m1 = await mockTransitorio("../supabase.server", { getSupabaseServerClient: () => doble as never });
const m2 = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: (() => undefined) as never,
  getRequestUrl: (() => new URL("https://sishow.test/x")) as never,
});
beforeAll(() => { m1.activar(); m2.activar(); });
afterAll(() => { m1.desactivar(); m2.desactivar(); });
instalarDobleStart();
const S = await import("./salons.functions?espera");

const perfil = { ...salon };
const servicio = servicesForType("barberia", perfil.menu)[0];
const alta = (extra: Record<string, unknown> = {}) => ({
  slug: "real", clientName: "Clienta Web", phone: "+34 699 88 87 77", serviceId: servicio.id,
  preferredEmployeeId: "any", preferredRange: "Sábado por la mañana", privacyNoticeAccepted: true, ...extra,
});

beforeEach(() => {
  doble = crearDobleSupabase({ salons: [{ slug: "real", profile: perfil }], waitlist: [] });
});

describe("apuntarseListaEsperaPublica", () => {
  it("guarda la entrada con id del servidor y el teléfono en E.164", async () => {
    const r = await llamar<{ synced: boolean; reason?: string }>(S.apuntarseListaEsperaPublica, alta());
    expect(r.synced).toBe(true);
    expect(doble.tablas.waitlist).toHaveLength(1);
    expect(doble.tablas.waitlist[0]).toMatchObject({ salon_slug: "real", phone: "+34699888777", service_id: servicio.id, preferred_range: "Sábado por la mañana" });
    expect(String(doble.tablas.waitlist[0].local_id)).toStartWith("web-");
  });
  it("sin aviso de privacidad, con teléfono malo o con nombre corto no guarda nada", async () => {
    expect(await llamar(S.apuntarseListaEsperaPublica, alta({ privacyNoticeAccepted: false }))).toEqual({ synced: false, reason: "RESERVA_PRIVACIDAD_NO_CONFIRMADA" });
    expect(await llamar(S.apuntarseListaEsperaPublica, alta({ phone: "1245" }))).toEqual({ synced: false, reason: "TELEFONO_INVALIDO" });
    expect(await llamar(S.apuntarseListaEsperaPublica, alta({ clientName: "A" }))).toEqual({ synced: false, reason: "NOMBRE_INVALIDO" });
    expect(doble.tablas.waitlist).toHaveLength(0);
  });
  it("un servicio que no está en la carta no entra", async () => {
    expect(await llamar(S.apuntarseListaEsperaPublica, alta({ serviceId: "inventado" }))).toEqual({ synced: false, reason: "ESPERA_SERVICIO_NO_DISPONIBLE" });
    expect(doble.tablas.waitlist).toHaveLength(0);
  });
  it("repetir con el mismo teléfono y servicio no duplica", async () => {
    await llamar(S.apuntarseListaEsperaPublica, alta());
    const r = await llamar<{ synced: boolean; yaApuntada?: boolean }>(S.apuntarseListaEsperaPublica, alta({ phone: "699888777" }));
    expect(r).toEqual({ synced: true, yaApuntada: true });
    expect(doble.tablas.waitlist).toHaveLength(1);
  });
  it("con la lista llena no admite más", async () => {
    doble = crearDobleSupabase({
      salons: [{ slug: "real", profile: perfil }],
      waitlist: Array.from({ length: 150 }, (_, i) => ({ salon_slug: "real", local_id: `x${i}`, phone: `+3460000${String(i).padStart(4, "0")}`, service_id: servicio.id })),
    });
    expect(await llamar(S.apuntarseListaEsperaPublica, alta())).toEqual({ synced: false, reason: "ESPERA_LLENA" });
  });
  it("un slug sin fila en salons (demo) no guarda nada", async () => {
    expect(await llamar(S.apuntarseListaEsperaPublica, alta({ slug: "demo-x" }))).toEqual({ synced: false });
    expect(doble.tablas.waitlist).toHaveLength(0);
  });
});
