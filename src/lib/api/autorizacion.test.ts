/**
 * Las pruebas que demuestran que el agujero está cerrado.
 *
 * Son pruebas NEGATIVAS: casi todas comprueban que algo NO se puede hacer. Es
 * a propósito. Que el dueño vea sus clientes se nota en cuanto abres el panel;
 * que un desconocido NO los vea no se nota nunca, y es lo único que importa
 * aquí.
 *
 * Los dos salones de la historia:
 *   - `salon-a` y `salon-b`, los dos de pago (los dos existen en `salons`).
 *   - `demo-de-venta`, que no existe: es uno de los ~54 enlaces que enseña el
 *     equipo comercial en la calle.
 */
import { describe, expect, it } from "bun:test";

import {
  AccesoDenegado,
  exigirMando,
  extraerBearer,
  resolverAcceso,
  tieneMando,
  vistaEfectiva,
  type Acceso,
  type DepsAutorizacion,
} from "./autorizacion";

/** Un mundo de mentira con dos salones de pago y dos usuarios, uno de cada. */
const SALONES_REALES = new Set(["salon-a", "salon-b"]);
const TOKENS: Record<string, string> = {
  "token-de-ana": "usuario-ana",
  "token-de-bruno": "usuario-bruno",
  "token-sin-salon": "usuario-recien-llegado",
};
const MIEMBROS: Record<string, string[]> = {
  "usuario-ana": ["salon-a"],
  "usuario-bruno": ["salon-b"],
  "usuario-recien-llegado": [],
};

function deps(cabecera: string | null, extra: Partial<DepsAutorizacion> = {}): DepsAutorizacion {
  return {
    esSalonReal: async (slug) => SALONES_REALES.has(slug),
    tokenDeLaPeticion: () => extraerBearer(cabecera),
    usuarioDelToken: async (token) => TOKENS[token] ?? null,
    esMiembro: async (userId, slug) => (MIEMBROS[userId] ?? []).includes(slug),
    ...extra,
  };
}

/** Ana, con su sesión buena, llamando al salón que se le indique. */
const comoAna = (slug: string) => resolverAcceso(slug, deps("Bearer token-de-ana"));
/** Alguien de la calle, sin sesión ninguna. */
const sinSesion = (slug: string) => resolverAcceso(slug, deps(null));

describe("extraerBearer", () => {
  it("saca el token de una cabecera bien formada", () => {
    expect(extraerBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("aguanta minúsculas y espacios de más", () => {
    expect(extraerBearer("  bearer   abc  ")).toBe("abc");
  });

  it("no se cree una cabecera que no sea Bearer", () => {
    expect(extraerBearer("Basic dXNlcjpwYXNz")).toBeNull();
    expect(extraerBearer("abc.def.ghi")).toBeNull();
    expect(extraerBearer("Bearer ")).toBeNull();
    expect(extraerBearer(null)).toBeNull();
    expect(extraerBearer("")).toBeNull();
  });
});

describe("las demos de venta siguen entrando sin pedir nada", () => {
  it("un slug que no está en `salons` es demo, sin sesión y sin token", async () => {
    expect(await sinSesion("demo-de-venta")).toEqual({ tipo: "demo" });
  });

  it("una demo manda sobre sí misma: el panel funciona igual que siempre", async () => {
    const acceso = await sinSesion("demo-de-venta");
    expect(tieneMando(acceso)).toBe(true);
    expect(vistaEfectiva("panel", acceso)).toBe("panel");
  });

  it("`exigirMando` no corta nunca una demo", async () => {
    expect(await exigirMando("demo-de-venta", deps(null))).toEqual({ tipo: "demo" });
  });

  it("ni siquiera mira el token cuando el salón no es real", async () => {
    let miradas = 0;
    const acceso = await resolverAcceso(
      "demo-de-venta",
      deps(null, {
        tokenDeLaPeticion: () => {
          miradas += 1;
          return null;
        },
      }),
    );
    expect(acceso).toEqual({ tipo: "demo" });
    expect(miradas).toBe(0);
  });
});

describe("sin sesión no se entra a un salón de pago", () => {
  it("quien llega de la calle es un ajeno", async () => {
    expect(await sinSesion("salon-a")).toEqual({ tipo: "ajeno" });
  });

  it("no manda, así que todo lo del dueño le corta", async () => {
    const promesa = exigirMando("salon-a", deps(null));
    await expect(promesa).rejects.toThrow(AccesoDenegado);
  });

  it("PEDIR LA VISTA DEL PANEL NO LE DA LA LISTA DE CLIENTES", async () => {
    // Este es el agujero exacto de la auditoría: `scope: "panel"` lo elegía
    // quien llamaba. Ahora la elección del navegador se recorta.
    const acceso = await sinSesion("salon-a");
    expect(vistaEfectiva("panel", acceso)).toBe("publica");
  });

  it("pero la web de reservas le sigue funcionando", async () => {
    // No se le corta con un error: se le da la vista pública. Quien entra a
    // pedir hora tiene que poder ver qué huecos quedan libres.
    const acceso = await sinSesion("salon-a");
    expect(vistaEfectiva("publica", acceso)).toBe("publica");
    expect(acceso.tipo).toBe("ajeno");
  });

  it("un token inventado no vale", async () => {
    expect(await resolverAcceso("salon-a", deps("Bearer me-lo-acabo-de-inventar"))).toEqual({
      tipo: "ajeno",
    });
  });

  it("una cabecera que no es Bearer tampoco", async () => {
    expect(await resolverAcceso("salon-a", deps("token-de-ana"))).toEqual({ tipo: "ajeno" });
  });
});

describe("el usuario del salón A no llega al salón B", () => {
  it("Ana manda en el suyo", async () => {
    expect(await comoAna("salon-a")).toEqual({ tipo: "miembro", userId: "usuario-ana" });
  });

  it("Ana es una ajena en el de Bruno, con su sesión perfectamente válida", async () => {
    expect(await comoAna("salon-b")).toEqual({ tipo: "ajeno" });
  });

  it("NO PUEDE LEER los clientes de Bruno ni pidiendo la vista del panel", async () => {
    expect(vistaEfectiva("panel", await comoAna("salon-b"))).toBe("publica");
  });

  it("NO PUEDE ESCRIBIR en el salón de Bruno: borrar citas, deudas, notas, perfil", async () => {
    // `exigirMando` es la puerta única de todas las funciones que escriben:
    // saveSalonProfile, patchSalonProfile, syncWaitlistEntry,
    // deleteWaitlistEntry, deleteAppointment, applyClientPenalty,
    // clearClientPenalty y saveClientNotes.
    await expect(exigirMando("salon-b", deps("Bearer token-de-ana"))).rejects.toThrow(
      AccesoDenegado,
    );
  });

  it("y Bruno tampoco llega al de Ana: la puerta es simétrica", async () => {
    expect(await resolverAcceso("salon-a", deps("Bearer token-de-bruno"))).toEqual({
      tipo: "ajeno",
    });
    await expect(exigirMando("salon-a", deps("Bearer token-de-bruno"))).rejects.toThrow(
      AccesoDenegado,
    );
  });

  it("el error le dice a la persona qué hacer, sin jerga", async () => {
    const err = await exigirMando("salon-b", deps("Bearer token-de-ana")).catch((e) => e);
    expect(err).toBeInstanceOf(AccesoDenegado);
    expect((err as Error).message).toContain("/login");
    expect((err as Error).message).not.toContain("403");
  });
});

describe("tener sesión no es tener acceso", () => {
  it("un usuario recién dado de alta, sin fila en `salon_members`, no entra a ningún salón", async () => {
    expect(await resolverAcceso("salon-a", deps("Bearer token-sin-salon"))).toEqual({
      tipo: "ajeno",
    });
    expect(await resolverAcceso("salon-b", deps("Bearer token-sin-salon"))).toEqual({
      tipo: "ajeno",
    });
  });

  it("se comprueba la pertenencia al salón PEDIDO, no a uno cualquiera", async () => {
    const pedidos: string[] = [];
    await resolverAcceso(
      "salon-b",
      deps("Bearer token-de-ana", {
        esMiembro: async (userId, slug) => {
          pedidos.push(`${userId}@${slug}`);
          return (MIEMBROS[userId] ?? []).includes(slug);
        },
      }),
    );
    expect(pedidos).toEqual(["usuario-ana@salon-b"]);
  });
});

describe("cuando algo falla, se falla cerrando", () => {
  it("si no se puede verificar el token, es un ajeno (no un miembro)", async () => {
    const acceso = await resolverAcceso(
      "salon-a",
      deps("Bearer token-de-ana", {
        usuarioDelToken: async () => {
          throw new Error("Supabase no responde");
        },
      }),
    );
    expect(acceso).toEqual({ tipo: "ajeno" });
  });

  it("si no se puede comprobar la pertenencia, es un ajeno", async () => {
    // El caso real: la tabla `salon_members` todavía no está aplicada en
    // producción. Sin poder demostrar pertenencia, no se entra.
    const acceso = await resolverAcceso(
      "salon-a",
      deps("Bearer token-de-ana", { esMiembro: async () => false }),
    );
    expect(acceso).toEqual({ tipo: "ajeno" });
  });
});

describe("vistaEfectiva", () => {
  const miembro: Acceso = { tipo: "miembro", userId: "usuario-ana" };
  const demo: Acceso = { tipo: "demo" };
  const ajeno: Acceso = { tipo: "ajeno" };

  it("el miembro que pide el panel recibe el panel", () => {
    expect(vistaEfectiva("panel", miembro)).toBe("panel");
  });

  it("la demo que pide el panel recibe el panel: nada cambia para la venta", () => {
    expect(vistaEfectiva("panel", demo)).toBe("panel");
  });

  it("pedir la vista pública devuelve la pública AUNQUE seas el dueño", () => {
    // Para que la web de reservas siga siendo la web de reservas cuando la
    // abre el dueño desde su móvil con la sesión iniciada.
    expect(vistaEfectiva("publica", miembro)).toBe("publica");
    expect(vistaEfectiva("publica", demo)).toBe("publica");
  });

  it("el ajeno recibe la pública pida lo que pida", () => {
    expect(vistaEfectiva("panel", ajeno)).toBe("publica");
    expect(vistaEfectiva("publica", ajeno)).toBe("publica");
  });
});
