import { describe, expect, test } from "bun:test";
import { CORPUS } from "./corpus";
import { CORPUS_CIEGO } from "./corpus-ciego";
import { CORPUS_CIEGO_2 } from "./corpus-ciego-2";
import { normalizar } from "./normalizar";
import { asistentePeluChicArena, datosPeluChicArena } from "./prueba-peluchic-arena";

/**
 * El motor de BACKEND con el adaptador de ESTA rama (fuentes-panel.ts) sobre
 * la demo PeluChic. Mismos corpus y la misma forma de rellenar {C}/{P}/{S}
 * que su evaluar.ts, que aquí no se trae porque depende de su fuentes-backend.ts.
 */
const AHORA = new Date("2026-09-25T10:00:00Z");
const { estado, equipo } = datosPeluChicArena();
const { asistente } = asistentePeluChicArena({ ahora: AHORA });

// Clientas con nombre completo único, con visitas y que no sean prefijo de otra.
const porNombre = new Map<string, number>();
for (const c of estado.clients) porNombre.set(normalizar(c.name), (porNombre.get(normalizar(c.name)) ?? 0) + 1);
const conVisitas = new Set(estado.appointments.filter((c) => c.status === "completed").map((c) => c.clientId));
const unicas = estado.clients.filter((c) => porNombre.get(normalizar(c.name)) === 1 && conVisitas.has(c.id) && !estado.clients.some((o) => o.id !== c.id && normalizar(o.name).startsWith(normalizar(c.name))));
const pros = equipo.map((e) => e.name.split(" ")[0]);
const SERVICIOS = ["tinte", "mechas", "corte y peinado", "recogido", "tratamiento"];
const rellenar = (t: string, i: number) => t.replace("{C}", unicas[(i * 7) % unicas.length].name).replace("{P}", pros[i % pros.length]).replace("{S}", SERVICIOS[i % SERVICIOS.length]);

function acierto(corpus: Array<[string, string]>) {
  let bien = 0;
  const fallos: string[] = [];
  corpus.forEach(([p, esperada], i) => {
    asistente.reiniciar();
    const r = asistente.responder(rellenar(p, i));
    const obtenida = r.tipo === "no-se" ? "no-se" : (r.intencion ?? "elegir");
    if (obtenida === esperada) bien++;
    else fallos.push(`${rellenar(p, i)} → ${obtenida} (esperada ${esperada})`);
  });
  return { pct: bien / corpus.length, fallos, n: corpus.length };
}

describe("motor de BACKEND con las fuentes de la rama Arena", () => {
  test("responde con la forma pactada y en milisegundos", () => {
    asistente.precalentar();
    const t0 = performance.now();
    const r = asistente.responder("cuantas citas tengo hoy");
    expect(performance.now() - t0).toBeLessThan(200);
    expect(r.tipo).toBe("respuesta");
    if (r.tipo === "respuesta") expect(Array.isArray(r.cifras) && Array.isArray(r.acciones)).toBe(true);
  });
  test("acierto de intención con estas fuentes: corpus ≥ 90 %, corpus ciegos ≥ 80 %", () => {
    const t0 = performance.now();
    const a = acierto(CORPUS);
    console.log(`${a.n} preguntas, ${((performance.now() - t0) / a.n).toFixed(1)} ms de media`);
    const b = acierto([...CORPUS_CIEGO, ...CORPUS_CIEGO_2]);
    console.log(`corpus ${Math.round(a.pct * 1000) / 10} % · ciegos ${Math.round(b.pct * 1000) / 10} %`);
    if (a.pct < 0.9) console.log(a.fallos.slice(0, 20).join("\n"));
    expect(a.pct).toBeGreaterThanOrEqual(0.9);
    expect(b.pct).toBeGreaterThanOrEqual(0.8);
  }, 60_000);
  test("escalado: primero pasos y guía, después el contacto", () => {
    const r = asistente.responder("no me funciona la web");
    expect(r.tipo).toBe("escalar");
    if (r.tipo === "escalar") {
      expect(r.pasos.length).toBeGreaterThan(0);
      expect(r.contacto.correo).toBe("ejemplo@sishow.com");
    }
  });
});
