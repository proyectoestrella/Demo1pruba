/**
 * Mismo criterio que salons.functions.guardia.test.ts: se lee el fichero
 * como texto porque una función de servidor de TanStack no se puede llamar
 * sin levantar el servidor entero. Si esto se pone rojo, NO se cambia la
 * lista para que pase: se mira qué función se ha quedado sin guarda.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const FUENTE = await Bun.file(new URL("./pagos.functions.ts", import.meta.url)).text();
const SALONS = readFileSync(new URL("./salons.functions.ts", import.meta.url), "utf8");

/** Acción exigida por cada función, en el orden en que aparece en el fichero. */
const GUARDAS: Record<string, string> = {
  listarPagos: '"dinero.ver-global"', // + dinero.ver-propio, comprobado aparte
  registrarPago: '"dinero.crear"',
  borrarPago: '"dinero.crear"',
  cerrarCaja: '"dinero.cerrar"',
  listarCierresCaja: '"dinero.cerrar"',
  generarCsvGestoria: '"dinero.exportar"',
  importarPagosTpvServidor: '"dinero.importar"',
};

function cuerpoDe(nombre: string): string {
  const inicio = FUENTE.indexOf(`export const ${nombre} = createServerFn`);
  expect(inicio, `no existe la función de servidor ${nombre}`).toBeGreaterThan(-1);
  const resto = FUENTE.slice(inicio);
  const fin = resto.indexOf("\nexport const ", 1);
  return fin === -1 ? resto : resto.slice(0, fin);
}

const TODAS = [...FUENTE.matchAll(/export const (\w+) = createServerFn/g)].map((m) => m[1]);

describe("guarda puesta en cada función de servidor de Caja", () => {
  it("el fichero tiene exactamente las funciones que esta prueba vigila", () => {
    expect(TODAS.sort()).toEqual(Object.keys(GUARDAS).sort());
  });

  it("todas exigen sesión y comprueban acceso al salón antes de tocar Supabase", () => {
    for (const nombre of TODAS) {
      const c = cuerpoDe(nombre);
      expect(c, `${nombre} no lleva .middleware([conSesion])`).toContain(".middleware([conSesion])");
      expect(c, `${nombre} no llama a exigirAcceso`).toContain("await exigirAcceso(data.slug)");
      const iAcceso = c.indexOf("await exigirAcceso(data.slug)");
      const iSupabase = c.indexOf("getSupabaseServerClient()");
      if (iSupabase >= 0) expect(iAcceso, `${nombre} abre Supabase antes de comprobar acceso`).toBeLessThan(iSupabase);
    }
  });

  for (const [nombre, accion] of Object.entries(GUARDAS)) {
    it(`${nombre} exige ${accion}`, () => {
      expect(cuerpoDe(nombre)).toContain(accion);
    });
  }

  it("listarPagos: sin dinero.ver-global ni dinero.ver-propio, corta; con solo ver-propio, recorta por cobradoPor", () => {
    const c = cuerpoDe("listarPagos");
    expect(c).toContain('tienePermiso(quien, "dinero.ver-propio")');
    expect(c).toContain("if (!puedeTodo && !puedePropio) throw new PermisoDenegado");
    expect(c).toContain("p.cobradoPor === miEmployeeId");
  });

  it("la señal aplicada crea su pago en syncAppointmentPatch (salons.functions.ts), no aquí", () => {
    expect(SALONS).toContain("sincronizarPagoDeSenal(supabase, data.slug, data.localId, data.patch)");
    expect(SALONS).toContain("refSenalAplicada(localId)");
  });
});
