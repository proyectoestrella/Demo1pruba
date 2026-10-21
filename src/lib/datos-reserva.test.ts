import { describe, expect, it } from "bun:test";
import { mensajeErrorReserva, motivosDatosReserva } from "./reserva-publica";

const completos = {
  nombre: "  Al  ", telefonoValido: true, sinProfesional: false,
  privacidadLeida: true, faltaPolitica: false, bloqueada: false,
  faltanRespuestas: false, sending: false, resolviendo: false,
};

describe("Motivos del botón Confirmar", () => {
  it("permite confirmar con dos caracteres tras recortar", () => {
    expect(motivosDatosReserva(completos)).toEqual([]);
  });
  for (const nombre of ["", " \t", "A", " A "]) {
    it(`pide nombre para ${JSON.stringify(nombre)}`, () => {
      expect(motivosDatosReserva({ ...completos, nombre })).toEqual(["nombre (mínimo 2 caracteres)"]);
    });
  }
  it("enumera juntos los campos pendientes", () => {
    expect(motivosDatosReserva({ ...completos, nombre: "", telefonoValido: false, privacidadLeida: false })).toEqual([
      "nombre (mínimo 2 caracteres)", "teléfono válido", "aceptar el aviso de privacidad",
    ]);
  });
  for (const campo of ["sinProfesional", "faltaPolitica", "bloqueada", "faltanRespuestas", "sending", "resolviendo"] as const) {
    it(`explica también el bloqueo por ${campo}`, () => {
      expect(motivosDatosReserva({ ...completos, [campo]: true })).toHaveLength(1);
    });
  }
  it("traduce NOMBRE_INVALIDO a una indicación accionable", () => {
    expect(mensajeErrorReserva(new Error("NOMBRE_INVALIDO"))).toBe("Escribe un nombre de al menos 2 caracteres.");
  });
});
