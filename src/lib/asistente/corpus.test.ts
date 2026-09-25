import { describe, expect, test } from "bun:test";
import { CORPUS } from "./corpus";
import { CORPUS_CIEGO } from "./corpus-ciego";
import { CORPUS_CIEGO_2 } from "./corpus-ciego-2";
import { casosDelCorpus, matriz, type Caso } from "./evaluar";
import { INTENCIONES } from "./intenciones";
import { datosPeluChic } from "./prueba-peluchic";

const casos = casosDelCorpus();
const ciego = casosDelCorpus(CORPUS_CIEGO);
const ciego2 = casosDelCorpus(CORPUS_CIEGO_2);

describe("corpus del asistente sobre la demo PeluChic", () => {
  test("al menos 400 formulaciones, todas con una intención del catálogo", () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(400);
    const ids = new Set(INTENCIONES.map((i) => i.id));
    for (const [, id] of CORPUS) expect([id, id === "no-se" || ids.has(id)]).toEqual([id, true]);
  });

  test("acierto de intención ≥ 95 %", () => {
    const m = matriz(casos);
    if (m.pct < 0.95) console.log(m.fallos.map((f) => `${f.pregunta} → ${f.obtenida} (esperada ${f.esperada})`).join("\n"));
    expect(m.pct).toBeGreaterThanOrEqual(0.95);
  });

  test("cero falsos positivos graves: nunca los datos de otra clienta (los tres corpus)", () => {
    const d = datosPeluChic();
    const nombres = d.clientes.map((c) => c.name);
    const revisar = (c: Caso) => {
      const r = c.respuesta;
      if (r.tipo !== "respuesta") return;
      const esperada = c.clientaId ? d.clientes.find((x) => x.id === c.clientaId)! : null;
      // Una acción sobre una ficha solo puede ser de la clienta nombrada.
      for (const a of r.acciones) {
        if (a.clientaId && esperada && ["abrir-ficha", "whatsapp", "nueva-cita"].includes(a.tipo)) expect([c.pregunta, a.clientaId]).toEqual([c.pregunta, esperada.id]);
      }
      // Si la pregunta nombra a una clienta, el texto no puede nombrar a otra con nombre completo.
      if (esperada) {
        const otras = nombres.filter((n) => n !== esperada.name && r.texto.includes(n) && !esperada.name.includes(n));
        expect([c.pregunta, otras]).toEqual([c.pregunta, []]);
      }
    };
    for (const c of [...casos, ...ciego, ...ciego2]) revisar(c);
  });

  test("corpus ciegos: guardas de regresión (medidos: 94,5 % y 91,2 %)", () => {
    expect(matriz(ciego).pct).toBeGreaterThanOrEqual(0.93);
    expect(matriz(ciego2).pct).toBeGreaterThanOrEqual(0.9);
  });

  test("menos de 20 ms por pregunta con ~3.300 citas (tras precalentar)", () => {
    expect(datosPeluChic().citas.length).toBeGreaterThan(3000);
    const peor = Math.max(...[...casos, ...ciego, ...ciego2].map((c) => c.ms));
    expect(peor).toBeLessThan(20);
  });
});
