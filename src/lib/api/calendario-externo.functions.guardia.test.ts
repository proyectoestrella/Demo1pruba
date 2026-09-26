/**
 * Igual que `clients.functions.guardia.test.ts` / `salons.functions.guardia.test.ts`:
 * vigilancia sobre el TEXTO fuente para lo que un test con mocks no pilla
 * fácil — que nadie se cuele saltándose el sobre de sesión o el permiso.
 */
import { describe, expect, it } from "bun:test";

const FUENTE = await Bun.file(new URL("./calendario-externo.functions.ts", import.meta.url)).text();

function cuerpoDe(nombreFn: string): string {
  const inicio = FUENTE.indexOf(`export const ${nombreFn} =`);
  expect(inicio).toBeGreaterThan(-1);
  const siguiente = FUENTE.indexOf("export const ", inicio + 1);
  return FUENTE.slice(inicio, siguiente === -1 ? undefined : siguiente);
}

describe("todas las funciones llevan el sobre de sesión", () => {
  for (const fn of [
    "listarConexionesCalendario",
    "iniciarConexionGoogle",
    "conectarApple",
    "desconectarCalendario",
    "ajustarConexionCalendario",
    "listarOcupadoExterno",
  ]) {
    it(`${fn} lleva .middleware([conSesion])`, () => {
      expect(cuerpoDe(fn)).toContain(".middleware([conSesion])");
    });
  }
});

describe("nunca en una demo", () => {
  for (const fn of ["listarConexionesCalendario", "iniciarConexionGoogle", "conectarApple", "desconectarCalendario", "ajustarConexionCalendario"]) {
    it(`${fn} exige un miembro real (accesoRealMiembro)`, () => {
      expect(cuerpoDe(fn)).toContain("accesoRealMiembro(data.slug)");
    });
  }
});

describe("el permiso se exige sobre el employeeId de VERDAD, no el que manda el navegador", () => {
  it("desconectarCalendario mira la fila antes de decidir (empleadaDeLaConexion), no data.employeeId", () => {
    const cuerpo = cuerpoDe("desconectarCalendario");
    expect(cuerpo).toContain("empleadaDeLaConexion(data.slug, data.conexionId)");
    expect(cuerpo).toContain('exigirAcciones(acceso, ["calendario-externo.gestionar"], [empleada]');
    expect(cuerpo).not.toContain("data.employeeId");
  });

  it("ajustarConexionCalendario hace lo mismo", () => {
    const cuerpo = cuerpoDe("ajustarConexionCalendario");
    expect(cuerpo).toContain("empleadaDeLaConexion(data.slug, data.conexionId)");
    expect(cuerpo).toContain('exigirAcciones(acceso, ["calendario-externo.gestionar"], [empleada]');
  });

  it("crear una conexión SÍ usa el employeeId pedido (es una conexión nueva, no hay fila que mirar)", () => {
    expect(cuerpoDe("iniciarConexionGoogle")).toContain('exigirAcciones(acceso, ["calendario-externo.gestionar"], [data.employeeId ?? null])');
    expect(cuerpoDe("conectarApple")).toContain('exigirAcciones(acceso, ["calendario-externo.gestionar"], [data.employeeId ?? null])');
  });
});

describe("listarOcupadoExterno recorta por rol como las citas", () => {
  it("usa cita.ver-todas, no calendario-externo.gestionar", () => {
    const cuerpo = cuerpoDe("listarOcupadoExterno");
    expect(cuerpo).toContain('tienePermiso(acceso, "cita.ver-todas")');
    expect(cuerpo).not.toContain("exigirAcciones");
  });
});

describe("el flag por salón se comprueba al crear una conexión nueva", () => {
  it("iniciarConexionGoogle exige el flag DESPUÉS del permiso, antes de tocar Google", () => {
    const cuerpo = cuerpoDe("iniciarConexionGoogle");
    const iPermiso = cuerpo.indexOf("exigirAcciones(");
    const iFlag = cuerpo.indexOf("exigirFlagActivo(data.slug)");
    const iServer = cuerpo.indexOf("iniciarConexionGoogleServer(");
    expect(iPermiso).toBeGreaterThan(-1);
    expect(iFlag).toBeGreaterThan(iPermiso);
    expect(iServer).toBeGreaterThan(iFlag);
  });

  it("conectarApple hace lo mismo", () => {
    const cuerpo = cuerpoDe("conectarApple");
    expect(cuerpo.indexOf("exigirFlagActivo(data.slug)")).toBeGreaterThan(cuerpo.indexOf("exigirAcciones("));
  });

  it("desconectar y ajustar NO exigen el flag (si ya estaba conectado y se apaga el flag, se debe poder seguir desconectando)", () => {
    expect(cuerpoDe("desconectarCalendario")).not.toContain("exigirFlagActivo");
    expect(cuerpoDe("ajustarConexionCalendario")).not.toContain("exigirFlagActivo");
  });
});
