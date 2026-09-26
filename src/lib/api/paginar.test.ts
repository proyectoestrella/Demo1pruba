import { describe, expect, it } from "bun:test";
import { leerTodasLasFilas } from "./paginar";

/** Un servidor que, como PostgREST, corta en `max` filas por petición. */
function servidor(total: number, max: number) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i }));
  const pedidas: Array<[number, number]> = [];
  const pagina = async (desde: number, hasta: number) => {
    pedidas.push([desde, hasta]);
    return { data: filas.slice(desde, Math.min(hasta + 1, desde + max)), error: null };
  };
  return { pagina, pedidas };
}

describe("leer una tabla entera por encima del tope de 1000 filas", () => {
  it("3.300 citas llegan todas, sin repetir ninguna", async () => {
    const { pagina, pedidas } = servidor(3300, 1000);
    const r = await leerTodasLasFilas(pagina);
    expect(r.data).toHaveLength(3300);
    expect(new Set(r.data.map((f) => f.id)).size).toBe(3300);
    expect(pedidas).toEqual([[0, 999], [1000, 1999], [2000, 2999], [3000, 3999]]);
  });

  it("justo 1000 filas: una página más, vacía, y se para", async () => {
    const { pagina, pedidas } = servidor(1000, 1000);
    expect((await leerTodasLasFilas(pagina)).data).toHaveLength(1000);
    expect(pedidas).toHaveLength(2);
  });

  it("salón vacío: una sola petición y lista vacía", async () => {
    const { pagina, pedidas } = servidor(0, 1000);
    expect((await leerTodasLasFilas(pagina)).data).toEqual([]);
    expect(pedidas).toHaveLength(1);
  });

  it("un error a mitad no devuelve media agenda: devuelve el error", async () => {
    let n = 0;
    const r = await leerTodasLasFilas(async () => (++n === 2 ? { data: null, error: { message: "boom" } } : { data: Array(1000).fill({}), error: null }));
    expect(r).toEqual({ data: [], error: { message: "boom" } });
  });
});
