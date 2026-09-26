import { describe, expect, test } from "bun:test";
import { CORPUS } from "./corpus";
import { CORPUS_CIEGO } from "./corpus-ciego";
import { CORPUS_CIEGO_2 } from "./corpus-ciego-2";
import { AHORA_CORPUS, casosDelCorpus, matriz, type Caso } from "./evaluar";
import { INTENCIONES } from "./intenciones";
import { asistentePeluChic, datosPeluChic } from "./prueba-peluchic";

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

  /**
   * `casosDelCorpus` ya precalienta y mide, pero con UNA sola lectura por
   * pregunta: con la máquina cargada (otro proceso, un GC largo, un test en
   * paralelo) basta que UNA de las ~900 preguntas tenga un pico puntual para
   * que el máximo se dispare y el test falle sin que el asistente se haya
   * vuelto más lento. Aquí se repite cada pregunta varias veces sobre el
   * MISMO asistente ya precalentado (no se vuelve a precalentar entre
   * repeticiones: eso mediría el arranque, no la pregunta) y se toma su
   * mediana, que absorbe un pico aislado sin dejar de detectar que una
   * pregunta concreta sea sistemáticamente lenta.
   *
   * Aun así, con otras compilaciones en la misma máquina fallaba de vez en
   * cuando, y un test de rendimiento no puede tumbar la suite de corrección.
   * Solo corre si se pide: `ASISTENTE_RENDIMIENTO=1 TZ=UTC bun test src/lib/asistente/corpus.test.ts`,
   * con la máquina tranquila y antes de cerrar un lote que toque el motor.
   */
  test.skipIf(process.env.ASISTENTE_RENDIMIENTO !== "1")("menos de 20 ms por pregunta con ~3.300 citas (tras precalentar, mediana de varias corridas)", () => {
    expect(datosPeluChic().citas.length).toBeGreaterThan(3000);
    const preguntas = [...casos, ...ciego, ...ciego2].map((c) => c.pregunta);
    const { asistente } = asistentePeluChic({ ahora: AHORA_CORPUS });
    asistente.precalentar();
    const CORRIDAS = 5;
    let peorMediana = 0;
    for (const pregunta of preguntas) {
      const tiempos: number[] = [];
      for (let i = 0; i < CORRIDAS; i++) {
        asistente.reiniciar();
        const t0 = performance.now();
        asistente.responder(pregunta);
        tiempos.push(performance.now() - t0);
      }
      tiempos.sort((a, b) => a - b);
      const mediana = tiempos[Math.floor(CORRIDAS / 2)];
      if (mediana > peorMediana) peorMediana = mediana;
    }
    expect(peorMediana).toBeLessThan(20);
    // ~900 preguntas × 5 corridas sobre 3.300 citas tardan más que el
    // timeout por defecto de bun test (5 s) aunque cada pregunta sea rápida.
  }, 30000);
});
