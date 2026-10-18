import { beforeEach, describe, expect, test } from "bun:test";
import {
  DIAS_SIN_DESTACAR,
  descartarFuncionPlan,
  descartadaRecientemente,
  destacarFuncionPlan,
  puedeOfrecerFuncion,
} from "./plan-descubrimiento";
import {
  FUNCION_DE_RUTA,
  FUNCIONES_POR_PLAN,
  funcionesNoIncluidas,
  insigniaDeRuta,
  muestraConmutadorDePlan,
  resumenPlanSuperior,
  tienePlan,
} from "./plan";
import { enlaceCorreo } from "./sishow-web";
import { entrarEnVistaDemo, esVistaCliente, resolverVistaDemo, useVistaDemo } from "./vista-demo";

function memoria() {
  const datos = new Map<string, string>();
  return {
    getItem: (c: string) => datos.get(c) ?? null,
    setItem: (c: string, v: string) => void datos.set(c, v),
  } as Storage;
}

const demo = { realSalonSlug: null, slug: "peluchic", resolucion: { slug: "peluchic", status: "demo" } };

describe("vista de cliente y vista de prospecto", () => {
  test("PeluChic abre por defecto como cliente y sin selector de plan", () => {
    const vista = resolverVistaDemo({ slug: "peluchic" });
    expect(vista).toBe("cliente");
    expect(muestraConmutadorDePlan({ ...demo, vista })).toBe(false);
  });

  test("la vista de prospecto enseña el conmutador", () => {
    const vista = resolverVistaDemo({ slug: "peluchic", prospecto: "1" });
    expect(vista).toBe("prospecto");
    expect(muestraConmutadorDePlan({ ...demo, vista })).toBe(true);
  });

  test("el parámetro manda sobre lo recordado, y lo recordado sobre el defecto", () => {
    expect(resolverVistaDemo({ slug: "peluchic", cliente: "1", guardada: "prospecto" })).toBe("cliente");
    expect(resolverVistaDemo({ slug: "peluchic", guardada: "prospecto" })).toBe("prospecto");
  });

  test("las demos de otros salones conservan el selector aunque pidan cliente", () => {
    const vista = resolverVistaDemo({ slug: "otro-salon", cliente: "1" });
    expect(vista).toBe("prospecto");
    expect(esVistaCliente("otro-salon", "cliente")).toBe(false);
    expect(muestraConmutadorDePlan({ realSalonSlug: null, slug: "otro-salon", resolucion: { slug: "otro-salon", status: "demo" }, vista })).toBe(true);
  });

  test("entrar recuerda la vista en la sesión", () => {
    const sesion = memoria();
    (globalThis as { sessionStorage?: Storage }).sessionStorage = sesion;
    expect(entrarEnVistaDemo("peluchic", { prospecto: "1" })).toBe("prospecto");
    expect(entrarEnVistaDemo("peluchic")).toBe("prospecto");
    expect(useVistaDemo.getState().vista).toBe("prospecto");
    expect(entrarEnVistaDemo("peluchic", { cliente: "1" })).toBe("cliente");
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  });
});

describe("insignias y funciones visibles por plan", () => {
  test("Estándar solo lleva insignia en lo que no tiene, nunca en lo ya incluido", () => {
    expect(insigniaDeRuta("/app/insights", "reservas-asistente")).toBeNull();
    expect(insigniaDeRuta("/app/marketing", "reservas-asistente")).toBe("Embajador");
    expect(insigniaDeRuta("/app/marketing", "todo-incluido")).toBeNull();
    expect(insigniaDeRuta("/app/clients", "reservas")).toBeNull();
    for (const funcion of Object.values(FUNCION_DE_RUTA)) expect(typeof FUNCIONES_POR_PLAN[funcion]).toBe("string");
  });

  test("nunca se ofrece una función de un plan inferior o ya contratado", () => {
    for (const f of funcionesNoIncluidas("reservas-asistente")) expect(FUNCIONES_POR_PLAN[f]).toBe("todo-incluido");
    for (const f of resumenPlanSuperior("reservas-asistente")) expect(tienePlan("reservas-asistente", f)).toBe(false);
    expect(resumenPlanSuperior("reservas-asistente").length).toBeLessThanOrEqual(4);
    expect(resumenPlanSuperior("todo-incluido")).toEqual([]);
  });
});

describe("«Ahora no» dura 30 días", () => {
  let sesion: Storage;
  let duradero: Storage;
  const dia = 24 * 60 * 60 * 1000;
  beforeEach(() => {
    sesion = memoria();
    duradero = memoria();
  });

  test("tras rechazarla no se vuelve a destacar dentro del plazo, aunque sea otra sesión", () => {
    descartarFuncionPlan("campanas-ampliadas", sesion, duradero, 1_000);
    const otraSesion = memoria();
    expect(DIAS_SIN_DESTACAR).toBe(30);
    expect(descartadaRecientemente("campanas-ampliadas", duradero, 1_000 + 29 * dia)).toBe(true);
    expect(destacarFuncionPlan("campanas-ampliadas", otraSesion, duradero, 1_000 + 29 * dia)).toBe(false);
  });

  test("pasado el plazo vuelve a poder destacarse, y las demás no se ven afectadas", () => {
    descartarFuncionPlan("campanas-ampliadas", sesion, duradero, 1_000);
    expect(destacarFuncionPlan("campanas-ampliadas", memoria(), duradero, 1_000 + 31 * dia)).toBe(true);
    expect(destacarFuncionPlan("roles-ampliados", memoria(), duradero, 1_000 + dia)).toBe(true);
  });

  test("sin almacenamiento duradero no revienta", () => {
    expect(() => descartarFuncionPlan("asistente", sesion, null)).not.toThrow();
    expect(descartadaRecientemente("asistente", null)).toBe(false);
  });

  test("el asistente no ofrece lo rechazado en la sesión ni lo que el plan ya tiene", () => {
    expect(puedeOfrecerFuncion("campanas-ampliadas", "reservas-asistente", [])).toBe(true);
    expect(puedeOfrecerFuncion("campanas-ampliadas", "reservas-asistente", ["campanas-ampliadas"])).toBe(false);
    expect(puedeOfrecerFuncion("asistente", "reservas-asistente", [])).toBe(false);
  });
});

describe("«Quiero saber más»", () => {
  test("usa el contacto existente de siShow", () => {
    expect(enlaceCorreo("siShow · Todas las campañas", "Hola")).toStartWith("mailto:");
  });
});
