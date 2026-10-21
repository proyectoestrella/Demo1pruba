/**
 * Alcance del historial de cambios en el SERVIDOR (funciones reales con doble
 * de Supabase): cada persona ve y deshace lo suyo; la gerente, lo de todas.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase, tokenConSesion } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

let doble = crearDobleSupabase({});
let cabecera: string | null = null;
const dbMock = await mockTransitorio("@/lib/supabase.server", { getSupabaseServerClient: () => doble as never });
const cabecerasMock = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: ((nombre: string) => (nombre.toLowerCase() === "authorization" ? cabecera ?? undefined : undefined)) as never,
});
beforeAll(() => { dbMock.activar(); cabecerasMock.activar(); });
afterAll(() => { dbMock.desactivar(); cabecerasMock.desactivar(); });
instalarDobleStart();
const cambios = await import("./cambios.functions?alcance");

const ahora = () => new Date().toISOString();
const fila = (id: string, autor: string, extra: Record<string, unknown> = {}) => ({
  id, salon_slug: "s", tipo: "cita.cancelar", entidad: "cita", id_entidad: "cita-1",
  antes: { status: "confirmed" }, despues: { status: "cancelled" }, resumen: "Cancelada la cita de Lucía",
  autor, autor_nombre: autor, fecha: ahora(), deshecho_en: null, deshace_a: null, aviso_enviado: false,
  dispositivo_id: "d-" + autor, dispositivo_nombre: "iPhone · Safari", employee_id: null, ...extra,
});

const como = (alias: string) => { cabecera = `Bearer ${tokenConSesion(`tk-${alias}`)}`; };

beforeEach(() => {
  doble = crearDobleSupabase(
    {
      salons: [{ slug: "s", profile: {} }],
      salon_members: [
        { user_id: "gerente", salon_slug: "s", rol: "gerente", estado: "activa" },
        { user_id: "noelia", salon_slug: "s", rol: "estilista", estado: "activa", employee_id: "noelia" },
        { user_id: "sara", salon_slug: "s", rol: "estilista", estado: "activa", employee_id: "sara" },
      ],
      cambios: [fila("cambio-de-noelia", "noelia"), fila("cambio-de-sara", "sara")],
    },
    { tokens: { "tk-gerente": "gerente", "tk-noelia": "noelia", "tk-sara": "sara" } },
  );
});

describe("listarCambios: cada persona ve lo suyo, la gerente todo", () => {
  it("una estilista solo recibe sus cambios, aunque pida los de otra", async () => {
    como("noelia");
    const mio = await llamar<{ cambios: Array<{ id: string; dispositivoNombre: string }> }>(cambios.listarCambios, { slug: "s" });
    expect(mio.cambios.map((c) => c.id)).toEqual(["cambio-de-noelia"]);
    expect(mio.cambios[0].dispositivoNombre).toBe("iPhone · Safari");
    const ajeno = await llamar<{ cambios: Array<{ id: string }> }>(cambios.listarCambios, { slug: "s", autor: "sara" });
    expect(ajeno.cambios.map((c) => c.id)).toEqual(["cambio-de-noelia"]);
  });
  it("la gerente ve los de todas", async () => {
    como("gerente");
    const r = await llamar<{ cambios: Array<{ id: string }> }>(cambios.listarCambios, { slug: "s" });
    expect(r.cambios.map((c) => c.id).sort()).toEqual(["cambio-de-noelia", "cambio-de-sara"]);
  });
});

describe("autorizarDeshacer", () => {
  it("la estilista puede deshacer lo suyo y NO lo de otra", async () => {
    como("noelia");
    expect(await llamar(cambios.autorizarDeshacer, { slug: "s", cambioId: "cambio-de-noelia" })).toMatchObject({ ok: true });
    expect(await llamar(cambios.autorizarDeshacer, { slug: "s", cambioId: "cambio-de-sara" })).toEqual({ ok: false, motivo: "PERMISO" });
  });
  it("la gerente puede deshacer lo de cualquiera", async () => {
    como("gerente");
    expect(await llamar(cambios.autorizarDeshacer, { slug: "s", cambioId: "cambio-de-sara" })).toMatchObject({ ok: true });
  });
  it("lo que ya está deshecho no se vuelve a deshacer", async () => {
    como("noelia");
    doble.tablas.cambios[0].deshecho_en = ahora();
    expect(await llamar(cambios.autorizarDeshacer, { slug: "s", cambioId: "cambio-de-noelia" })).toEqual({ ok: false, motivo: "DESHECHO" });
  });
});

describe("guardarCambio de un deshacer", () => {
  const deshacer = (a: string) => ({
    id: "deshacer-0001", tipo: "cita.cancelar", entidad: "cita", idEntidad: "cita-1", antes: { status: "cancelled" }, despues: { status: "confirmed" },
    resumen: "Deshecho: cancelada", fecha: ahora(), deshaceA: a, dispositivoId: "d-noelia", dispositivoNombre: "Windows · Chrome",
  });
  it("una estilista no puede registrar que deshace lo de otra", async () => {
    como("noelia");
    const r = await llamar<{ guardado: boolean; motivo?: string }>(cambios.guardarCambio, { slug: "s", cambio: deshacer("cambio-de-sara") });
    expect(r).toEqual({ guardado: false, motivo: "permiso" });
    expect(doble.tablas.cambios).toHaveLength(2);
    expect(doble.tablas.cambios.find((c) => c.id === "cambio-de-sara")!.deshecho_en).toBeNull();
  });
  it("lo suyo sí: queda guardado con aparato y marca el original como deshecho", async () => {
    como("noelia");
    const r = await llamar<{ guardado: boolean }>(cambios.guardarCambio, { slug: "s", cambio: deshacer("cambio-de-noelia") });
    expect(r.guardado).toBe(true);
    const nuevo = doble.tablas.cambios.find((c) => c.id === "deshacer-0001")!;
    expect(nuevo.dispositivo_nombre).toBe("Windows · Chrome");
    expect(nuevo.autor).toBe("noelia");
    expect(doble.tablas.cambios.find((c) => c.id === "cambio-de-noelia")!.deshecho_en).not.toBeNull();
  });
  it("sin las columnas nuevas (SQL sin aplicar) sigue guardando", async () => {
    como("noelia");
    const original = doble.from;
    let primera = true;
    let fallos = 0;
    doble.from = (t: string) => {
      const q = original(t);
      if (t === "cambios") {
        const insert = q.insert;
        q.insert = (d: Record<string, unknown>) => {
          if (primera && "dispositivo_id" in d) { primera = false; fallos++; return { then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'column "dispositivo_id" does not exist' } }).then(ok) }; }
          return insert(d);
        };
      }
      return q;
    };
    const r = await llamar<{ guardado: boolean }>(cambios.guardarCambio, { slug: "s", cambio: deshacer("cambio-de-noelia") });
    expect(r.guardado).toBe(true);
    expect(fallos).toBe(1);
    expect(doble.tablas.cambios.some((c) => c.id === "deshacer-0001")).toBe(true);
  });
});

describe("autorizarDeshacer relee la entidad en el servidor", () => {
  beforeEach(() => {
    doble.tablas.appointments = [{ id: "uuid-1", salon_slug: "s", local_id: "cita-1", client_id: null, client_name: "Lucía", service_id: "corte", employee_id: "noelia", start_at: "2026-11-03T08:00:00.000Z", duration_min: 30, price_eur: 20, status: "cancelled", note: null }];
    doble.tablas.clients = [{ id: "5f0a3d2e-1111-4222-8333-444455556666", salon_slug: "s", name: "Ana", phone: "600111222", phone_key: "600111222", email: null, notes: "n", created_at: ahora() }];
  });
  it("devuelve la cita tal como está en el servidor (aunque este navegador no la tenga cargada)", async () => {
    como("noelia");
    const r = await llamar<{ ok: boolean; servidor?: { existe: boolean; valor: { status: string; id: string } } }>(cambios.autorizarDeshacer, { slug: "s", cambioId: "cambio-de-noelia" });
    expect(r.ok).toBe(true);
    expect(r.servidor?.existe).toBe(true);
    expect(r.servidor?.valor).toMatchObject({ id: "cita-1", status: "cancelled" });
  });
  it("una cita borrada en el servidor sale como inexistente", async () => {
    como("noelia");
    doble.tablas.appointments = [];
    const r = await llamar<{ servidor?: { existe: boolean } }>(cambios.autorizarDeshacer, { slug: "s", cambioId: "cambio-de-noelia" });
    expect(r.servidor?.existe).toBe(false);
  });
  it("una ficha se localiza por su id de servidor", async () => {
    como("gerente");
    doble.tablas.cambios.push(fila("cambio-ficha", "gerente", { tipo: "clienta.editar", entidad: "clienta", id_entidad: "5f0a3d2e-1111-4222-8333-444455556666", antes: { notes: "a" }, despues: { notes: "n" } }));
    const r = await llamar<{ servidor?: { existe: boolean; valor: { name: string; notes: string } } }>(cambios.autorizarDeshacer, { slug: "s", cambioId: "cambio-ficha" });
    expect(r.servidor?.valor).toMatchObject({ name: "Ana", notes: "n" });
  });
  it("sin tabla de apoyo no se rompe: simplemente no hay comprobación del servidor", async () => {
    como("noelia");
    delete doble.tablas.appointments;
    const r = await llamar<{ ok: boolean }>(cambios.autorizarDeshacer, { slug: "s", cambioId: "cambio-de-noelia" });
    expect(r.ok).toBe(true);
  });
});
