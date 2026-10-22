import { describe, expect, test } from "bun:test";
import { especialidadPublica } from "./web-publica";

describe("especialidadPublica", () => {
  test("quita el rol interno y su separador, y pone mayúscula", () => {
    expect(especialidadPublica("Gerente · peluquería, color y novias")).toBe(
      "Peluquería, color y novias",
    );
    expect(especialidadPublica("Encargada - color")).toBe("Color");
    expect(especialidadPublica("recepción: uñas")).toBe("Uñas");
    expect(especialidadPublica("Gerente · Recepción · mechas")).toBe("Mechas");
  });
  test("deja intacta una especialidad sin rol", () => {
    expect(especialidadPublica("Faciales y spa japonés")).toBe("Faciales y spa japonés");
    expect(especialidadPublica("Estética, masajes y cabina")).toBe("Estética, masajes y cabina");
  });
  test("no corta palabras que empiezan igual que un rol", () => {
    expect(especialidadPublica("Directoras de color")).toBe("Directoras de color");
  });
  test("solo rol o vacío devuelve cadena vacía", () => {
    expect(especialidadPublica("Gerente")).toBe("");
    expect(especialidadPublica(undefined)).toBe("");
    expect(especialidadPublica("  ")).toBe("");
  });
});
