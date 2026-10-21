import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { crearDobleSupabase, tokenConSesion } from "./doble-supabase";
import { instalarDobleStart, llamar, mockTransitorio } from "./doble-start";
let cabecera = "";
let db = crearDobleSupabase({});
const sb = await mockTransitorio("../supabase.server", {
  getSupabaseServerClient: () => db as never,
});
const req = await mockTransitorio("@tanstack/react-start/server", {
  getRequestHeader: ((n: string) => (n === "authorization" ? cabecera : undefined)) as never,
  getRequestUrl: (() => new URL("https://peluchic.sishow.es/app")) as never,
});
beforeAll(() => {
  sb.activar();
  req.activar();
});
afterAll(() => {
  sb.desactivar();
  req.desactivar();
});
instalarDobleStart();
const S = await import("./salons.functions" + "?acceso-app");
const P = await import("./pagos.functions" + "?acceso-app");
const A = await import("./accesos.functions" + "?acceso-app");
beforeEach(() => {
  cabecera = `Bearer ${tokenConSesion("estilista")}`;
  db = crearDobleSupabase(
    {
      salons: [
        { slug: "peluchic", profile: { plan: "reservas", timeZone: "Europe/Madrid" } },
        { slug: "otro" },
      ],
      salon_members: [
        { user_id: "maria", salon_slug: "peluchic", rol: "gerente", estado: "activa" },
        {
          user_id: "estilista",
          salon_slug: "peluchic",
          rol: "estilista",
          estado: "activa",
          employee_id: "sara",
        },
        { user_id: "ajena", salon_slug: "otro", rol: "gerente", estado: "activa" },
      ],
      payments: [
        {
          id: "p1",
          salon_slug: "peluchic",
          cobrado_por: "sara",
          importe_eur: 25,
          fecha: "2026-10-21T10:00:00Z",
        },
        {
          id: "p2",
          salon_slug: "peluchic",
          cobrado_por: "otra",
          importe_eur: 75,
          fecha: "2026-10-21T10:00:00Z",
        },
      ],
    },
    { tokens: { maria: "maria", estilista: "estilista", ajena: "ajena", "maria-ipad": "maria" } },
  );
});
test("estilista: endpoints de ajustes, accesos y caja rechazan lectura/escritura directa", async () => {
  await expect(
    llamar(S.patchSalonProfile, { slug: "peluchic", patch: { plan: "todo-incluido" } }),
  ).rejects.toThrow();
  await expect(llamar(A.listarMiembros, { slug: "peluchic" })).rejects.toThrow();
  await expect(
    llamar(A.invitarAlSalon, { slug: "peluchic", email: "a@b.es", rol: "gerente" }),
  ).rejects.toThrow();
  await expect(llamar(P.listarCierresCaja, { slug: "peluchic" })).rejects.toThrow();
  expect(db.escrituras).toEqual([]);
});
test("estilista solo recibe sus ingresos aunque pida un intervalo completo", async () => {
  const r = await llamar<{ pagos: { id: string }[] }>(P.listarPagos, {
    slug: "peluchic",
    desde: "2026-10-01",
    hasta: "2026-10-31",
  });
  expect(r.pagos.map((p) => p.id)).toEqual(["p1"]);
});
test("miembro de otro salón no accede a accesos ni ingresos de PeluChic", async () => {
  cabecera = `Bearer ${tokenConSesion("ajena")}`;
  await expect(llamar(A.listarMiembros, { slug: "peluchic" })).rejects.toThrow();
  await expect(
    llamar(P.listarPagos, { slug: "peluchic", desde: "2026-10-01", hasta: "2026-10-31" }),
  ).rejects.toThrow();
  expect(db.consultas.some((c) => c.tabla === "payments")).toBe(false);
});
test("baja se aplica en la siguiente petición con el mismo token", async () => {
  expect(await llamar(S.accesoAlPanel, { slug: "peluchic" })).toMatchObject({ permitido: true });
  db.tablas.salon_members[1].estado = "baja";
  expect(await llamar(S.accesoAlPanel, { slug: "peluchic" })).toMatchObject({ permitido: false });
});
test("dos dispositivos conviven y cerrar sesiones invalida ambos sin esperar al JWT", async () => {
  for (const dispositivo of ["maria", "maria-ipad"]) {
    cabecera = `Bearer ${tokenConSesion(dispositivo)}`;
    expect(await llamar(S.accesoAlPanel, { slug: "peluchic" })).toMatchObject({ permitido: true });
  }
  await db.rpc("cerrar_sesiones_usuario", { usuario: "maria" });
  for (const dispositivo of ["maria", "maria-ipad"]) {
    cabecera = `Bearer ${tokenConSesion(dispositivo)}`;
    expect(await llamar(S.accesoAlPanel, { slug: "peluchic" })).toMatchObject({ permitido: false });
  }
});

test("el servidor deniega las rutas de ajustes y accesos a la estilista", async () => {
  for (const pagina of ["ajustes", "ajustes.accesos", "caja", "analitica"]) {
    expect(await llamar(S.accesoAlPanel, { slug: "peluchic", pagina })).toMatchObject({
      permitido: false,
    });
  }
  expect(await llamar(S.accesoAlPanel, { slug: "peluchic", pagina: "calendario" })).toMatchObject({
    permitido: true,
  });
});
