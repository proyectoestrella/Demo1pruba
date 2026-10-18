/**
 * A4 y M4 de la auditoría independiente (18-oct-2026): la reserva pública
 * (syncAppointment sin sesión) con la función real y un Supabase de mentira.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";
import { salon, employees } from "../mock/salon";
import { datosReservaPublicaDesdeCarta } from "../reserva-publica";

let doble = crearDobleSupabase({});
const m1 = await mockTransitorio("../supabase.server", { getSupabaseServerClient: () => doble as never });
const m2 = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: (() => undefined) as never,
  getRequestUrl: (() => new URL("https://sishow.test/x")) as never,
});
beforeAll(() => { m1.activar(); m2.activar(); });
afterAll(() => { m1.desactivar(); m2.desactivar(); });
instalarDobleStart();
const S = await import("./salons.functions?doble");

const perfil = { ...salon };
const servicio = (await import("../mock/salon")).servicesForType("barberia", perfil.menu)[0];
const datos = datosReservaPublicaDesdeCarta(perfil as never, [servicio.id])!;

/** Próximo martes a las 11:00 Madrid, aprox. (UTC+1/+2: se prueba 10:00Z). */
function proximoDia(dow: number, horaUTC = 10) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + 3);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(horaUTC, 0, 0, 0);
  return d.toISOString();
}
const reserva = (extra: Record<string, unknown> = {}) => ({
  slug: "real", localId: `loc-${Math.random()}`, clientName: "Atacante", clientPhone: "600111222", clientEmail: "atacante@malo.test",
  serviceIds: [servicio.id], employeeId: employees[0].id, startISO: proximoDia(2), durationMin: datos.durationMin, priceEur: datos.priceEur,
  status: "pending", privacyNoticeAccepted: true, ...extra,
});

beforeEach(() => {
  doble = crearDobleSupabase({
    salons: [{ slug: "real", profile: perfil }],
    clients: [{ id: "c1", salon_slug: "real", name: "Marta Pérez", phone: "600 111 222", phone_key: "600111222", email: "marta@real.test" }],
  });
});

describe("A4: la reserva pública no pisa los datos de una clienta existente", () => {
  it("reservar con el teléfono de Marta no cambia su nombre ni su correo", async () => {
    const r = await llamar<{ synced: boolean; reason?: string }>(S.syncAppointment, reserva());
    expect(r.reason).toBeUndefined();
    expect(r.synced).toBe(true);
    const marta = doble.tablas.clients.find((c) => c.id === "c1")!;
    expect(marta.name).toBe("Marta Pérez");
    expect(marta.email).toBe("marta@real.test");
  });
});

describe("A4: una clienta nueva sí se crea con los datos que da", () => {
  it("teléfono desconocido: ficha nueva con su nombre", async () => {
    const r = await llamar<{ synced: boolean }>(S.syncAppointment, reserva({ clientPhone: "699888777", clientName: "Nueva", clientEmail: "n@x.test" }));
    expect(r.synced).toBe(true);
    expect(doble.tablas.clients.find((c) => c.phone_key === "699888777")).toMatchObject({ name: "Nueva", email: "n@x.test" });
  });
});

describe("M5: la reserva pública queda marcada como origen web", () => {
  it("guarda origen_reserva:web para que la base aplique la exclusión solo a la web", async () => {
    await llamar(S.syncAppointment, reserva({ clientPhone: "699888777", clientName: "Nueva" }));
    const cita = doble.escrituras.find((e) => e.tabla === "appointments" && e.op === "upsert");
    expect(cita?.datos).toMatchObject({ origen_reserva: "web" });
  });
});

describe("M4: topes de entrada, horizonte y ritmo en la reserva pública", () => {
  it("rechaza textos desmesurados", async () => {
    await expect(llamar(S.syncAppointment, reserva({ clientName: "N".repeat(101) }))).rejects.toThrow();
    await expect(llamar(S.syncAppointment, reserva({ clientPhone: "6".repeat(31) }))).rejects.toThrow();
    await expect(llamar(S.syncAppointment, reserva({ note: "x".repeat(1001) }))).rejects.toThrow();
    await expect(llamar(S.syncAppointment, reserva({ localId: "l".repeat(101) }))).rejects.toThrow();
  });
  it("no acepta una reserva a más de un año vista", async () => {
    const lejos = new Date(Date.parse(proximoDia(2)) + 2 * 365 * 86_400_000);
    while (lejos.getUTCDay() !== 2) lejos.setUTCDate(lejos.getUTCDate() + 1);
    const r = await llamar<{ synced: boolean; reason?: string }>(S.syncAppointment, reserva({ startISO: lejos.toISOString() }));
    expect(r.synced).toBe(false);
    expect(r.reason).toBe("RESERVA_LEJANA");
  });
  it("el mismo teléfono no puede abrir más de 5 reservas en un día", async () => {
    const base = Date.parse(proximoDia(2));
    const resultados: Array<{ synced: boolean; reason?: string }> = [];
    for (let i = 0; i < 7; i++)
      resultados.push(await llamar(S.syncAppointment, reserva({ clientPhone: "644555666", startISO: new Date(base + i * 7 * 86_400_000).toISOString() })));
    expect(resultados.filter((r) => r.synced).length).toBe(5);
    expect(resultados[5].reason).toBe("RESERVA_DEMASIADAS");
  });
  it("un salón no recibe más de 60 reservas públicas por hora", async () => {
    const ahora = new Date().toISOString();
    doble.tablas.appointments = Array.from({ length: 60 }, (_, i) => ({ id: `a${i}`, salon_slug: "real", local_id: `x${i}`, status: "pending", created_at: ahora, start_at: "2099-01-01T10:00:00Z", duration_min: 30, employee_id: "otro" }));
    const r = await llamar<{ synced: boolean; reason?: string }>(S.syncAppointment, reserva({ clientPhone: "655000111" }));
    expect(r.reason).toBe("RESERVA_DEMASIADAS");
  });
});

describe("M5: doble reserva simultánea", () => {
  const HUECO = proximoDia(2);
  const solape = (created_at: string, local_id: string) => ({
    id: local_id, salon_slug: "real", local_id, employee_id: employees[0].id, start_at: HUECO, duration_min: 30, status: "pending", created_at,
  });

  it("perdioLaCarrera: pierde la reserva creada después; gana la primera", async () => {
    const { perdioLaCarrera } = S as unknown as { perdioLaCarrera: (...a: unknown[]) => Promise<boolean> };
    expect(typeof perdioLaCarrera).toBe("function");
    doble.tablas.appointments = [solape("2026-10-18T10:00:00.000Z", "A"), solape("2026-10-18T10:00:00.050Z", "B")];
    expect(await perdioLaCarrera(doble, "real", "B", employees[0].id, HUECO, 30)).toBe(true);
    expect(await perdioLaCarrera(doble, "real", "A", employees[0].id, HUECO, 30)).toBe(false);
  });

  it("la reserva pública llama a la comprobación posterior a la escritura y deshace la suya si pierde", async () => {
    const fuente = await Bun.file(new URL("./salons.functions.ts", import.meta.url)).text();
    const i = fuente.indexOf("await escribirCita(supabase, fila);");
    const resto = fuente.slice(i, i + 900);
    expect(resto).toContain("perdioLaCarrera(");
    expect(resto).toContain(".delete()");
  });
});
