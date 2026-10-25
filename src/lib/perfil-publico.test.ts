import { expect, test } from "bun:test";
import { perfilPublico } from "./perfil-publico";

test("el perfil público conserva los bloqueos operativos pero no sus notas privadas", () => {
  const perfil = {
    id: "p",
    slug: "peluchic",
    name: "PeluChic",
    bloqueosAgenda: [{ id: "b", profesionalId: "maria", inicio: "2026-10-10T10:00:00Z", fin: "2026-10-10T11:00:00Z", motivo: "Ana no quiere coincidir con su ex", internoNuevo: "secreto" }],
    diasEspeciales: [{ fecha: "2026-10-12", cerrado: true, nota: "Cierra por la operación de María", internoNuevo: "secreto" }],
  } as any;

  expect(perfilPublico(perfil)).toMatchObject({
    bloqueosAgenda: [{ id: "b", profesionalId: "maria", inicio: "2026-10-10T10:00:00Z", fin: "2026-10-10T11:00:00Z" }],
    diasEspeciales: [{ fecha: "2026-10-12", cerrado: true }],
  });
  expect(JSON.stringify(perfilPublico(perfil))).not.toContain("secreto");
  expect(JSON.stringify(perfilPublico(perfil))).not.toContain("operación");
});

test("la duración por clienta y los avatares de clientas no salen a la web pública", () => {
  const p = { ...({} as Record<string, unknown>), name: "S", duracionClientas: { c1: { corte: 35 } }, avataresClientas: { c1: {} } } as never;
  const r = perfilPublico(p) as Record<string, unknown>;
  expect(r.duracionClientas).toBeUndefined();
  expect(r.avataresClientas).toBeUndefined();
});
