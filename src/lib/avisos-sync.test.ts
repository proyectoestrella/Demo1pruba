import { beforeEach, describe, expect, it } from "bun:test";

import {
  descartarAviso,
  leerAvisos,
  leerAvisosEnServidor,
  limpiarAvisos,
  registrarAviso,
  suscribirAvisos,
} from "./avisos-sync";

beforeEach(() => limpiarAvisos());

describe("avisos de sincronización", () => {
  it("un fallo registrado se puede leer", () => {
    registrarAviso("No hemos podido guardar la cita de Ana.");
    expect(leerAvisos().map((a) => a.mensaje)).toEqual(["No hemos podido guardar la cita de Ana."]);
  });

  it("no repite el mismo mensaje aunque falle cinco veces", () => {
    for (let i = 0; i < 5; i++) registrarAviso("No hemos podido guardar la cita de Ana.");
    expect(leerAvisos()).toHaveLength(1);
  });

  it("guarda el ÚLTIMO reintento, que es el que corresponde a la pantalla de ahora", () => {
    registrarAviso("mismo fallo", () => {});
    const ultimo = () => {};
    registrarAviso("mismo fallo", ultimo);
    expect(leerAvisos()[0]!.reintentar).toBe(ultimo);
  });

  it("fallos distintos son avisos distintos", () => {
    registrarAviso("la cita de Ana");
    registrarAviso("los datos de tu salón");
    expect(leerAvisos()).toHaveLength(2);
  });

  it("descartar quita solo ese aviso y avisa a los suscritos", () => {
    const id = registrarAviso("uno");
    registrarAviso("dos");
    let cambios = 0;
    const baja = suscribirAvisos(() => {
      cambios += 1;
    });
    descartarAviso(id);
    expect(leerAvisos().map((a) => a.mensaje)).toEqual(["dos"]);
    expect(cambios).toBe(1);
    // Descartar algo que ya no está no dispara un repintado inútil.
    descartarAviso(id);
    expect(cambios).toBe(1);
    baja();
  });

  it("darse de baja deja de recibir cambios", () => {
    let cambios = 0;
    const baja = suscribirAvisos(() => {
      cambios += 1;
    });
    registrarAviso("uno");
    baja();
    registrarAviso("dos");
    expect(cambios).toBe(1);
  });

  it("la identidad del array solo cambia cuando cambia el contenido", () => {
    const antes = leerAvisos();
    expect(leerAvisos()).toBe(antes);
    registrarAviso("uno");
    expect(leerAvisos()).not.toBe(antes);
  });

  it("en el servidor nunca hay avisos", () => {
    registrarAviso("uno");
    expect(leerAvisosEnServidor()).toEqual([]);
  });
});
