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
const m1 = await mockTransitorio("../supabase.server", {
  getSupabaseServerClient: () => doble as never,
});
const m2 = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: (() => undefined) as never,
  getRequestUrl: (() => new URL("https://sishow.test/x")) as never,
});
beforeAll(() => {
  m1.activar();
  m2.activar();
});
afterAll(() => {
  m1.desactivar();
  m2.desactivar();
});
instalarDobleStart();
const S = await import("./salons.functions?doble");

const perfil = { ...salon };
const servicio = (await import("../mock/salon")).servicesForType("barberia", perfil.menu)[0];
const datos = datosReservaPublicaDesdeCarta(perfil as never, [servicio.id])!;

/** Próximo martes a las 11:00 Madrid, aprox. (UTC+1/+2: se prueba 10:00Z). */
function proximoDia(dow: number, horaUTC = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(horaUTC, 0, 0, 0);
  return d.toISOString();
}
const reserva = (extra: Record<string, unknown> = {}) => ({
  slug: "real",
  localId: `loc-${Math.random()}`,
  clientName: "Atacante",
  clientPhone: "600111222",
  clientEmail: "atacante@malo.test",
  serviceIds: [servicio.id],
  employeeId: employees[0].id,
  startISO: proximoDia(2),
  durationMin: datos.durationMin,
  priceEur: datos.priceEur,
  status: "pending",
  privacyNoticeAccepted: true,
  ...extra,
});

beforeEach(() => {
  doble = crearDobleSupabase({
    salons: [{ slug: "real", profile: perfil }],
    clients: [
      {
        id: "c1",
        salon_slug: "real",
        name: "Marta Pérez",
        phone: "600 111 222",
        phone_key: "600111222",
        email: "marta@real.test",
      },
    ],
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

describe("Teléfono: el servidor valida y guarda en E.164", () => {
  for (const malo of ["1245", "12345678", "abcdefghi"]) {
    it(`rechaza «${malo}» sin guardar nada`, async () => {
      const r = await llamar<{ synced: boolean; reason?: string }>(
        S.syncAppointment,
        reserva({ clientPhone: malo, clientName: "X" }),
      );
      expect(r).toEqual({ synced: false, reason: "TELEFONO_INVALIDO" });
      expect(doble.escrituras.filter((e) => e.tabla === "appointments")).toHaveLength(0);
    });
  }
  it("una clienta nueva queda con el teléfono en E.164 y su phone_key de 9 cifras", async () => {
    const r = await llamar<{ synced: boolean }>(
      S.syncAppointment,
      reserva({ clientPhone: "+34 699 88 87 77", clientName: "Nueva" }),
    );
    expect(r.synced).toBe(true);
    expect(doble.tablas.clients.find((c) => c.phone_key === "699888777")).toMatchObject({
      phone: "+34699888777",
    });
  });
  it("una ficha antigua («600 111 222») sigue casando al reservar con +34", async () => {
    const r = await llamar<{ synced: boolean }>(
      S.syncAppointment,
      reserva({ clientPhone: "+34600111222", clientName: "Marta P." }),
    );
    expect(r.synced).toBe(true);
    expect(doble.tablas.clients.filter((c) => c.phone_key === "600111222")).toHaveLength(1);
    const cita = doble.escrituras.find((e) => e.tabla === "appointments" && e.op === "upsert");
    expect(cita?.datos).toMatchObject({ client_id: "c1" });
  });
});

describe("A4: una clienta nueva sí se crea con los datos que da", () => {
  it("teléfono desconocido: ficha nueva con su nombre", async () => {
    const r = await llamar<{ synced: boolean }>(
      S.syncAppointment,
      reserva({ clientPhone: "699888777", clientName: "Nueva", clientEmail: "n@x.test" }),
    );
    expect(r.synced).toBe(true);
    expect(doble.tablas.clients.find((c) => c.phone_key === "699888777")).toMatchObject({
      name: "Nueva",
      email: "n@x.test",
    });
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
    await expect(
      llamar(S.syncAppointment, reserva({ clientName: "N".repeat(101) })),
    ).rejects.toThrow();
    await expect(
      llamar(S.syncAppointment, reserva({ clientPhone: "6".repeat(31) })),
    ).rejects.toThrow();
    await expect(llamar(S.syncAppointment, reserva({ note: "x".repeat(1001) }))).rejects.toThrow();
    await expect(
      llamar(S.syncAppointment, reserva({ localId: "l".repeat(101) })),
    ).rejects.toThrow();
  });
  it("no acepta una reserva a más de un año vista", async () => {
    const lejos = new Date(Date.parse(proximoDia(2)) + 2 * 365 * 86_400_000);
    while (lejos.getUTCDay() !== 2) lejos.setUTCDate(lejos.getUTCDate() + 1);
    const r = await llamar<{ synced: boolean; reason?: string }>(
      S.syncAppointment,
      reserva({ startISO: lejos.toISOString() }),
    );
    expect(r.synced).toBe(false);
    expect(r.reason).toBe("RESERVA_LEJANA");
  });
  it("el mismo teléfono no puede abrir más de 5 reservas en un día", async () => {
    const base = Date.parse(proximoDia(2));
    const resultados: Array<{ synced: boolean; reason?: string }> = [];
    for (let i = 0; i < 7; i++)
      resultados.push(
        await llamar(
          S.syncAppointment,
          reserva({
            clientPhone: "644555666",
            startISO: new Date(base + i * 7 * 86_400_000).toISOString(),
          }),
        ),
      );
    expect(resultados.filter((r) => r.synced).length).toBe(5);
    expect(resultados[5].reason).toBe("RESERVA_DEMASIADAS");
  });
  it("un salón no recibe más de 60 reservas públicas por hora", async () => {
    const ahora = new Date().toISOString();
    doble.tablas.appointments = Array.from({ length: 60 }, (_, i) => ({
      id: `a${i}`,
      salon_slug: "real",
      local_id: `x${i}`,
      status: "pending",
      created_at: ahora,
      start_at: "2099-01-01T10:00:00Z",
      duration_min: 30,
      employee_id: "otro",
    }));
    const r = await llamar<{ synced: boolean; reason?: string }>(
      S.syncAppointment,
      reserva({ clientPhone: "655000111" }),
    );
    expect(r.reason).toBe("RESERVA_DEMASIADAS");
  });
});

describe("Teléfono compartido en familia (25-oct noche)", () => {
  it("con el teléfono de Marta pero otro nombre se crea la ficha de quien viene, sin tocar la de Marta", async () => {
    const r = await llamar<{ synced: boolean }>(S.syncAppointment, reserva({ clientName: "Olga Pérez", clientPhone: "600111222", clientEmail: undefined }));
    expect(r.synced).toBe(true);
    const marta = doble.tablas.clients.find((c) => c.id === "c1");
    expect(marta).toMatchObject({ name: "Marta Pérez", phone_key: "600111222" });
    const olga = doble.tablas.clients.find((c) => c.name === "Olga Pérez");
    expect(olga).toMatchObject({ phone_key: null });
    const cita = doble.escrituras.find((e) => e.tabla === "appointments" && e.op === "upsert");
    expect(cita?.datos).toMatchObject({ client_id: olga!.id });
  });
  it("una segunda reserva de Olga reutiliza su ficha familiar", async () => {
    await llamar(S.syncAppointment, reserva({ clientName: "Olga Pérez", clientPhone: "600111222", clientEmail: undefined }));
    await llamar(S.syncAppointment, reserva({ clientName: "olga", clientPhone: "600111222", clientEmail: undefined, startISO: proximoDia(3) }));
    expect(doble.tablas.clients.filter((c) => /olga/i.test(String(c.name)))).toHaveLength(1);
  });
});

describe("«Su tiempo» en la web (26-oct)", () => {
  it("la clienta conocida por su teléfono guarda la cita con su duración (extra general)", async () => {
    doble = crearDobleSupabase({
      salons: [{ slug: "real", profile: { ...perfil, duracionClientas: { c1: { "*": 20 } } } }],
      clients: [{ id: "c1", salon_slug: "real", name: "Marta Pérez", phone: "600 111 222", phone_key: "600111222" }],
    });
    const r = await llamar<{ synced: boolean }>(S.syncAppointment, reserva({ clientName: "Marta Pérez", clientPhone: "600111222", clientEmail: undefined }));
    expect(r.synced).toBe(true);
    const cita = doble.escrituras.find((e) => e.tabla === "appointments" && e.op === "upsert");
    expect(cita?.datos).toMatchObject({ duration_min: datos.durationMin + 20 });
  });
  it("si con su duración ya no cabe, hueco ocupado", async () => {
    const inicio = proximoDia(2);
    doble = crearDobleSupabase({
      salons: [{ slug: "real", profile: { ...perfil, duracionClientas: { c1: { "*": 20 } } } }],
      clients: [{ id: "c1", salon_slug: "real", name: "Marta Pérez", phone: "600 111 222", phone_key: "600111222" }],
      appointments: [{ id: "o", salon_slug: "real", local_id: "o", employee_id: employees[0].id, start_at: new Date(Date.parse(inicio) + datos.durationMin * 60_000 + 5 * 60_000).toISOString(), duration_min: 30, status: "confirmed", created_at: "2026-10-01T00:00:00Z" }],
    });
    const r = await llamar<{ synced: boolean; reason?: string }>(S.syncAppointment, reserva({ clientName: "Marta Pérez", clientPhone: "600111222", clientEmail: undefined, startISO: inicio }));
    expect(r).toEqual({ synced: false, reason: "RESERVA_HUECO_OCUPADO" });
  });
});

describe("«Cualquiera disponible» con «Su tiempo» (26-oct tarde)", () => {
  it("si con su duración no cabe con la elegida por el navegador, el servidor asigna otra libre", async () => {
    const inicio = proximoDia(2);
    doble = crearDobleSupabase({
      salons: [{ slug: "real", profile: { ...perfil, duracionClientas: { c1: { "*": 20 } } } }],
      clients: [{ id: "c1", salon_slug: "real", name: "Marta Pérez", phone: "600 111 222", phone_key: "600111222" }],
      appointments: [{ id: "o", salon_slug: "real", local_id: "o", employee_id: employees[0].id, start_at: new Date(Date.parse(inicio) + datos.durationMin * 60_000 + 5 * 60_000).toISOString(), duration_min: 30, status: "confirmed", created_at: "2026-10-01T00:00:00Z" }],
    });
    const sin = await llamar<{ synced: boolean; reason?: string }>(S.syncAppointment, reserva({ clientName: "Marta Pérez", clientPhone: "600111222", clientEmail: undefined, startISO: inicio }));
    expect(sin).toEqual({ synced: false, reason: "RESERVA_HUECO_OCUPADO" });
    const con = await llamar<{ synced: boolean; employeeId?: string }>(S.syncAppointment, reserva({ clientName: "Marta Pérez", clientPhone: "600111222", clientEmail: undefined, startISO: inicio, cualquiera: true }));
    expect(con.synced).toBe(true);
    expect(con.employeeId).toBeDefined();
    expect(con.employeeId).not.toBe(employees[0].id);
    const cita = doble.escrituras.filter((e) => e.tabla === "appointments" && e.op === "upsert").at(-1);
    expect(cita?.datos).toMatchObject({ employee_id: con.employeeId, duration_min: datos.durationMin + 20 });
  });
});

describe("M5: doble reserva simultánea", () => {
  const HUECO = proximoDia(2);
  const solape = (created_at: string, local_id: string) => ({
    id: local_id,
    salon_slug: "real",
    local_id,
    employee_id: employees[0].id,
    start_at: HUECO,
    duration_min: 30,
    status: "pending",
    created_at,
  });

  it("perdioLaCarrera: pierde la reserva creada después; gana la primera", async () => {
    const { perdioLaCarrera } = S as unknown as {
      perdioLaCarrera: (...a: unknown[]) => Promise<boolean>;
    };
    expect(typeof perdioLaCarrera).toBe("function");
    doble.tablas.appointments = [
      solape("2026-10-18T10:00:00.000Z", "A"),
      solape("2026-10-18T10:00:00.050Z", "B"),
    ];
    expect(await perdioLaCarrera(doble, "real", "B", employees[0].id, HUECO, 30)).toBe(true);
    expect(await perdioLaCarrera(doble, "real", "A", employees[0].id, HUECO, 30)).toBe(false);
  });

  it("dos clientas reservan el mismo hueco a la vez: solo una se queda la cita (25-oct)", async () => {
    const [r1, r2] = await Promise.all([
      llamar<{ synced: boolean; reason?: string }>(S.syncAppointment, reserva({ clientName: "Ana Uno", clientPhone: "600000001", clientEmail: undefined })),
      llamar<{ synced: boolean; reason?: string }>(S.syncAppointment, reserva({ clientName: "Bea Dos", clientPhone: "600000002", clientEmail: undefined })),
    ]);
    const quedan = (doble.tablas.appointments ?? []).filter((c) => c.start_at === proximoDia(2) && c.employee_id === employees[0].id);
    expect(quedan).toHaveLength(1);
    expect([r1.synced, r2.synced].filter(Boolean)).toHaveLength(1);
    expect([r1.reason, r2.reason]).toContain("RESERVA_HUECO_OCUPADO");
  });

  it("la reserva pública llama a la comprobación posterior a la escritura y deshace la suya si pierde", async () => {
    const fuente = await Bun.file(new URL("./salons.functions.ts", import.meta.url)).text();
    const i = fuente.indexOf("await escribirCita(supabase, fila);");
    const resto = fuente.slice(i, i + 1_800);
    expect(resto).toContain("perdioLaCarrera(");
    expect(resto).toContain(".delete()");
  });
});

describe("reserva pública durante la exposición", () => {
  const perfilColor = {
    ...perfil,
    name: "PeluChic",
    tagline: "Peluquería",
    menu: ["Color de cobertura Organico~60~40~~~color-organico", "Corte~15~15~~~corte"],
  };
  const datosCorte = datosReservaPublicaDesdeCarta(perfilColor as never, ["corte"])!;
  const inicioColor = proximoDia(2);
  const colorGuardado = {
    id: "color-previo",
    salon_slug: "real",
    local_id: "color-previo",
    employee_id: employees[0].id,
    service_id: "color-organico",
    start_at: inicioColor,
    duration_min: 60,
    price_eur: 40,
    status: "confirmed",
    created_at: "2026-10-18T10:00:00.000Z",
  };

  it("la web NO acepta otra cita en la exposición (la exclusión SQL de producción la rechazaría)", async () => {
    doble = crearDobleSupabase({
      salons: [{ slug: "real", profile: perfilColor }],
      appointments: [colorGuardado],
      clients: [],
    });
    const r = await llamar<{ synced: boolean; reason?: string }>(
      S.syncAppointment,
      reserva({
        serviceIds: ["corte"],
        startISO: new Date(Date.parse(inicioColor) + 15 * 60_000).toISOString(),
        durationMin: datosCorte.durationMin,
        priceEur: datosCorte.priceEur,
        clientPhone: "699888777",
      }),
    );
    expect(r).toEqual({ synced: false, reason: "RESERVA_HUECO_OCUPADO" });
  });

  it("fuera de la exposición devuelve RESERVA_HUECO_OCUPADO", async () => {
    doble = crearDobleSupabase({
      salons: [{ slug: "real", profile: perfilColor }],
      appointments: [colorGuardado],
      clients: [],
    });
    const r = await llamar<{ synced: boolean; reason?: string }>(
      S.syncAppointment,
      reserva({
        serviceIds: ["corte"],
        startISO: inicioColor,
        durationMin: datosCorte.durationMin,
        priceEur: datosCorte.priceEur,
        clientPhone: "699888777",
      }),
    );
    expect(r).toEqual({ synced: false, reason: "RESERVA_HUECO_OCUPADO" });
  });

  it("convierte la exclusión SQL antigua en hueco ocupado, no en un 500", async () => {
    doble = crearDobleSupabase(
      { salons: [{ slug: "real", profile: perfilColor }], clients: [] },
      {
        errorEscrituraEn: {
          appointments: {
            code: "23P01",
            message:
              'conflicting key value violates exclusion constraint "appointments_web_sin_solape_excl"',
          },
        },
      },
    );
    const r = await llamar<{ synced: boolean; reason?: string }>(
      S.syncAppointment,
      reserva({
        serviceIds: ["corte"],
        durationMin: datosCorte.durationMin,
        priceEur: datosCorte.priceEur,
        clientPhone: "699888777",
      }),
    );
    expect(r).toEqual({ synced: false, reason: "RESERVA_HUECO_OCUPADO" });
  });
});

describe("Nombre obligatorio en la reserva pública", () => {
  for (const clientName of [undefined, "", "  \t\n", "A", " A "]) {
    it(`rechaza ${JSON.stringify(clientName)} sin escrituras`, async () => {
      const resultado = await llamar(S.syncAppointment, reserva({ clientName }));
      expect(resultado).toEqual({ synced: false, reason: "NOMBRE_INVALIDO" });
      expect(doble.escrituras).toHaveLength(0);
    });
  }
  it("acepta dos caracteres y recorta el nombre antes de guardar ficha y cita", async () => {
    const resultado = await llamar<{ synced: boolean }>(
      S.syncAppointment,
      reserva({ clientName: "  Al  ", clientPhone: "699888777" }),
    );
    expect(resultado.synced).toBe(true);
    expect(doble.tablas.clients.find((c) => c.phone_key === "699888777")?.name).toBe("Al");
    const cita = doble.escrituras.find((e) => e.tabla === "appointments" && e.op === "upsert");
    expect(cita?.datos).toMatchObject({ client_name: "Al" });
  });
});

