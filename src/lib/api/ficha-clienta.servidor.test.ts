/**
 * Editar a mano y borrar una ficha en el SERVIDOR (lo que hace persistente el
 * deshacer de fichas): permisos, localización por id o teléfono, y que deshacer
 * un alta propia no exija ser gerente.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { crearDobleSupabase, tokenConSesion } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";

let doble = crearDobleSupabase({});
let cabecera: string | null = null;
const dbMock = await mockTransitorio("@/lib/supabase.server", { getSupabaseServerClient: () => doble as never });
const cabecerasMock = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: ((n: string) => (n.toLowerCase() === "authorization" ? cabecera ?? undefined : undefined)) as never,
});
beforeAll(() => { dbMock.activar(); cabecerasMock.activar(); });
afterAll(() => { dbMock.desactivar(); cabecerasMock.desactivar(); });
instalarDobleStart();
const salons = await import("./salons.functions?ficha");

const como = (alias: string) => { cabecera = `Bearer ${tokenConSesion(`tk-${alias}`)}`; };
const ID = "5f0a3d2e-1111-4222-8333-444455556666";
const ficha = { id: ID, salon_slug: "s", name: "Ana", phone: "+34600111222", phone_key: "600111222", email: "a@x.es", notes: "n", created_at: new Date().toISOString() };

beforeEach(() => {
  doble = crearDobleSupabase(
    {
      salons: [{ slug: "s", profile: {} }],
      salon_members: [
        { user_id: "gerente", salon_slug: "s", rol: "gerente", estado: "activa" },
        { user_id: "noelia", salon_slug: "s", rol: "estilista", estado: "activa", employee_id: "noelia" },
      ],
      clients: [{ ...ficha }],
      cambios: [{ id: "alta-de-noelia", salon_slug: "s", tipo: "clienta.crear", entidad: "clienta", id_entidad: ID, autor: "noelia" }],
    },
    { tokens: { "tk-gerente": "gerente", "tk-noelia": "noelia" } },
  );
});

describe("editarFichaClienta", () => {
  it("sobrescribe nombre, correo y cumpleaños, y borra con null", async () => {
    como("gerente");
    const r = await llamar<{ synced: boolean }>(salons.editarFichaClienta, { slug: "s", clientId: ID, phone: "600111222", campos: { name: "Ana Nueva", email: null, birthday: "1990-05-01" } });
    expect(r.synced).toBe(true);
    expect(doble.tablas.clients[0]).toMatchObject({ name: "Ana Nueva", email: null, birthday: "1990-05-01" });
  });
  it("sin id de servidor la localiza por el teléfono de antes", async () => {
    como("gerente");
    await llamar(salons.editarFichaClienta, { slug: "s", clientId: "c-new-1", phone: "600111222", campos: { phone: "611000111" } });
    expect(doble.tablas.clients[0].phone_key).toBe("611000111");
  });
  it("si la ficha no está en el servidor lo dice (el navegador la da de alta)", async () => {
    como("gerente");
    const r = await llamar<{ synced: boolean; reason?: string }>(salons.editarFichaClienta, { slug: "s", clientId: "c-new-2", phone: "699999999", campos: { name: "X" } });
    expect(r).toMatchObject({ synced: false, reason: "sin-ficha" });
  });
});

describe("borrarFichaClienta", () => {
  it("la gerente borra", async () => {
    como("gerente");
    await llamar(salons.borrarFichaClienta, { slug: "s", clientId: ID, phone: "600111222" });
    expect(doble.tablas.clients).toHaveLength(0);
  });
  it("una estilista no borra una ficha cualquiera", async () => {
    como("noelia");
    await expect(llamar(salons.borrarFichaClienta, { slug: "s", clientId: ID, phone: "600111222" })).rejects.toThrow();
    expect(doble.tablas.clients).toHaveLength(1);
  });
  it("pero sí deshace su propia alta (con el id de ese cambio)", async () => {
    como("noelia");
    await llamar(salons.borrarFichaClienta, { slug: "s", clientId: ID, phone: "600111222", cambioId: "alta-de-noelia" });
    expect(doble.tablas.clients).toHaveLength(0);
  });
  it("el cambio de otra persona no vale", async () => {
    como("noelia");
    doble.tablas.cambios[0].autor = "gerente";
    await expect(llamar(salons.borrarFichaClienta, { slug: "s", clientId: ID, phone: "600111222", cambioId: "alta-de-noelia" })).rejects.toThrow();
    expect(doble.tablas.clients).toHaveLength(1);
  });
});
