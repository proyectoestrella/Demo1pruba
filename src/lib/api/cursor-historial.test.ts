import { describe, expect, it } from "bun:test";
import { cursorHistorial } from "./cursor-historial";

type C = { id: string; fecha: string };
/** Evalúa el mismo criterio que el filtro de PostgREST, sobre una lista en memoria. */
const despues = (c: C, f: string, id: string) => c.fecha < f || (c.fecha === f && c.id < id);
const ordenar = (xs: C[]) => [...xs].sort((a, b) => (a.fecha === b.fecha ? b.id.localeCompare(a.id) : b.fecha.localeCompare(a.fecha)));

describe("cursor del historial con fechas repetidas", () => {
  it("el filtro lleva la pareja fecha+id, entre comillas", () => {
    expect(cursorHistorial("2026-09-26T10:00:00.000+00:00", "c-5")).toBe(
      'fecha.lt."2026-09-26T10:00:00.000+00:00",and(fecha.eq."2026-09-26T10:00:00.000+00:00",id.lt."c-5")',
    );
  });

  it("paginando de 3 en 3, 10 cambios con la misma fecha salen todos y una sola vez", () => {
    const todos = ordenar(Array.from({ length: 10 }, (_, i) => ({ id: `c-${i}`, fecha: "2026-09-26T10:00:00Z" })));
    const vistos: string[] = [];
    let pagina = todos.slice(0, 3);
    while (pagina.length) {
      vistos.push(...pagina.map((c) => c.id));
      const u = pagina[pagina.length - 1];
      pagina = todos.filter((c) => despues(c, u.fecha, u.id)).slice(0, 3);
    }
    expect(vistos).toEqual(todos.map((c) => c.id));
    // Con el cursor antiguo (solo fecha <) se perdían 7 de 10:
    expect(todos.filter((c) => c.fecha < todos[2].fecha)).toHaveLength(0);
  });

  it("comillas y barras en el id no rompen el filtro", () => {
    expect(cursorHistorial("f", 'a"b\\c')).toContain('id.lt."a\\"b\\\\c"');
  });
});
