/**
 * Salir tiene que dejar el aparato limpio.
 *
 * El caso real: el iPad del salón guarda en claro las citas y las fichas de
 * los clientes. Si "cerrar sesión" solo cerrara la sesión, todo eso se
 * quedaría dentro del aparato y cualquiera que lo abriera después lo vería.
 */
import { describe, expect, it } from "bun:test";

import { CLAVE_ALMACEN_SALON, CLAVE_SESION, limpiarDatosLocales } from "./sesion";

/** Un `localStorage` de mentira, con lo que de verdad hay en el iPad de un salón. */
function almacenDePrueba() {
  const datos = new Map<string, string>([
    [
      CLAVE_ALMACEN_SALON,
      JSON.stringify({
        state: {
          clients: [{ name: "Prueba QA Trimly", phone: "600111222", notes: "usa el número 8" }],
          appointments: [{ id: "a-1", clientName: "Prueba QA Trimly" }],
        },
      }),
    ],
    [CLAVE_SESION, JSON.stringify({ access_token: "abc.def.ghi" })],
    ["theme", "dark"],
  ]);
  return {
    datos,
    removeItem: (k: string) => {
      datos.delete(k);
    },
  };
}

describe("limpiarDatosLocales", () => {
  it("borra las citas y las fichas de clientes del aparato", () => {
    const almacen = almacenDePrueba();
    limpiarDatosLocales(almacen);
    expect(almacen.datos.has(CLAVE_ALMACEN_SALON)).toBe(false);
  });

  it("borra también la sesión", () => {
    const almacen = almacenDePrueba();
    limpiarDatosLocales(almacen);
    expect(almacen.datos.has(CLAVE_SESION)).toBe(false);
  });

  it("no queda ni rastro del teléfono ni de la nota de un cliente", () => {
    const almacen = almacenDePrueba();
    limpiarDatosLocales(almacen);
    const queda = [...almacen.datos.values()].join(" ");
    expect(queda).not.toContain("600111222");
    expect(queda).not.toContain("Prueba QA Trimly");
    expect(queda).not.toContain("usa el número 8");
  });

  it("no se lleva por delante las preferencias que no son de nadie", () => {
    // El tema claro/oscuro no dice nada de ningún cliente: no hay motivo para
    // borrarlo y sería molesto.
    const almacen = almacenDePrueba();
    limpiarDatosLocales(almacen);
    expect(almacen.datos.get("theme")).toBe("dark");
  });

  it("vale que lo llamen dos veces seguidas", () => {
    const almacen = almacenDePrueba();
    limpiarDatosLocales(almacen);
    expect(() => limpiarDatosLocales(almacen)).not.toThrow();
  });

  it("la clave del almacén es la que usa de verdad la store", () => {
    // Si alguien renombra el almacén en lib/store.ts y no lo cambia aquí,
    // "cerrar sesión" dejaría de borrar nada sin avisar.
    expect(CLAVE_ALMACEN_SALON).toBe("trimly-salon-store");
  });
});
