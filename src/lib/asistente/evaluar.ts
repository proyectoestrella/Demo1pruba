/**
 * Evalúa el corpus contra la demo PeluChic: acierto global, por categoría y
 * los fallos. Lo usan corpus.test.ts y el informe del lote.
 */
import { CORPUS } from "./corpus";
import { CORPUS_CIEGO } from "./corpus-ciego";
import { CORPUS_CIEGO_2 } from "./corpus-ciego-2";
import { CORPUS_CIEGO_3 } from "./corpus-ciego-3";
import { INTENCIONES, POR_ID } from "./intenciones";
import { normalizar } from "./normalizar";
import { asistentePeluChic, datosPeluChic } from "./prueba-peluchic";
import type { RespuestaAsistente } from "./responder";

/** Viernes 25/09/2026 a mediodía en Madrid: los días de la semana del corpus no caen en «mañana». */
export const AHORA_CORPUS = new Date("2026-09-25T10:00:00Z");

export function intencionDe(r: RespuestaAsistente): string {
  if (r.tipo === "no-se") return "no-se";
  if (r.tipo === "respuesta" && r.tambien) return `${r.intencion}|${r.tambien.intencion}`;
  return r.intencion ?? "dudosa";
}

export interface Caso {
  pregunta: string;
  esperada: string;
  obtenida: string;
  respuesta: RespuestaAsistente;
  ms: number;
  clientaId?: string;
}

export function casosDelCorpus(corpus: Array<[string, string]> = CORPUS): Caso[] {
  const d = datosPeluChic();
  // Clientas con nombre completo único y alguna visita, para {C}.
  const porNombre = new Map<string, number>();
  for (const c of d.clientes) porNombre.set(normalizar(c.name), (porNombre.get(normalizar(c.name)) ?? 0) + 1);
  const conVisitas = new Set(d.citas.filter((c) => c.status === "completed").map((c) => c.clientId));
  const unicas = d.clientes.filter((c) => porNombre.get(normalizar(c.name)) === 1 && conVisitas.has(c.id) && !d.clientes.some((o) => o.id !== c.id && normalizar(o.name).startsWith(normalizar(c.name))));
  const pros = d.equipo.map((e) => e.name.split(" ")[0]);
  const servicios = ["tinte", "mechas", "corte y peinado", "recogido", "tratamiento"];
  const { asistente } = asistentePeluChic({ ahora: AHORA_CORPUS });
  // Precalienta (índices y catálogo) para que el tiempo medido sea el de una pregunta.
  asistente.precalentar();
  const out: Caso[] = [];
  corpus.forEach(([plantilla, esperada], i) => {
    const cl = unicas[(i * 7) % unicas.length];
    const pregunta = plantilla.replace("{C}", cl.name).replace("{P}", pros[i % pros.length]).replace("{S}", servicios[i % servicios.length]);
    asistente.reiniciar();
    const t0 = performance.now();
    const respuesta = asistente.responder(pregunta);
    const ms = performance.now() - t0;
    out.push({ pregunta, esperada, obtenida: intencionDe(respuesta), respuesta, ms, clientaId: plantilla.includes("{C}") ? cl.id : undefined });
  });
  return out;
}

/** Acierta si responde la intención esperada, o si responde la de negocio y avisa de la de plan esperada. */
export function acierta(c: Caso): boolean {
  return c.obtenida.split("|").includes(c.esperada);
}

/**
 * Qué pasó con cada pregunta, pensando en «sin inventarse nada»:
 * - acierto: respondió (o avisó de) la intención esperada.
 * - inofensivo: no acertó, pero no dio un dato: preguntó (`elegir`) o dijo «no lo sé».
 * - dañino: respondió con otra intención (un dato que no era el pedido), o
 *   respondió algo a una pregunta que no era del salón.
 */
export type Resultado = "acierto" | "inofensivo" | "danino";
export function resultado(c: Caso): Resultado {
  if (acierta(c)) return "acierto";
  const r = c.respuesta;
  if (r.tipo === "elegir" || r.tipo === "no-se") return "inofensivo";
  // Charla ante una pregunta ajena no da ningún dato del salón.
  if (c.esperada === "no-se" && r.tipo === "respuesta" && POR_ID.get(r.intencion)?.grupo === "charla") return "inofensivo";
  return "danino";
}

export function tresMetricas(casos: Caso[]) {
  const n = { acierto: 0, inofensivo: 0, danino: 0 };
  for (const c of casos) n[resultado(c)]++;
  const neg = casos.filter((c) => POR_ID.get(c.esperada)?.grupo === "negocio");
  return { ...n, total: casos.length, negocio: neg.filter(acierta).length, totalNegocio: neg.length, danos: casos.filter((c) => resultado(c) === "danino") };
}

export function matriz(casos: Caso[]) {
  const porCat = new Map<string, { total: number; ok: number }>();
  for (const c of casos) {
    const cat = c.esperada === "no-se" ? "fuera del dominio" : (POR_ID.get(c.esperada)?.categoria ?? "?");
    const v = porCat.get(cat) ?? { total: 0, ok: 0 };
    v.total++;
    if (acierta(c)) v.ok++;
    porCat.set(cat, v);
  }
  const ok = casos.filter(acierta).length;
  return { total: casos.length, ok, pct: ok / casos.length, porCat, fallos: casos.filter((c) => !acierta(c)) };
}

if (import.meta.main) {
  const casos = casosDelCorpus(process.argv.includes("--ciego3") ? CORPUS_CIEGO_3 : process.argv.includes("--ciego2") ? CORPUS_CIEGO_2 : process.argv.includes("--ciego") ? CORPUS_CIEGO : CORPUS);
  const m = matriz(casos);
  console.log(`Acierto: ${m.ok}/${m.total} = ${(m.pct * 100).toFixed(1)} %  · intenciones del catálogo: ${INTENCIONES.length}`);
  for (const [k, v] of [...m.porCat].sort()) console.log(`  ${k.padEnd(18)} ${v.ok}/${v.total}`);
  const ms = casos.map((c) => c.ms).sort((a, b) => a - b);
  console.log(`Tiempo: mediana ${ms[Math.floor(ms.length / 2)].toFixed(1)} ms · p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(1)} ms · máx ${ms[ms.length - 1].toFixed(1)} ms`);
  const t = tresMetricas(casos);
  const pc = (x: number, d: number) => `${((x / d) * 100).toFixed(1)} %`;
  console.log(`Acierto ${t.acierto} (${pc(t.acierto, t.total)}) · inofensivo ${t.inofensivo} (${pc(t.inofensivo, t.total)}) · DAÑINO ${t.danino} (${pc(t.danino, t.total)}) · negocio ${t.negocio}/${t.totalNegocio} (${pc(t.negocio, t.totalNegocio)})`);
  for (const f of m.fallos) console.log(`${resultado(f) === "danino" ? "  ☠" : "  ·"}`, `  ✗ «${f.pregunta}» esperada ${f.esperada} → ${f.obtenida}${f.respuesta.tipo === "elegir" ? ` [${f.respuesta.opciones.map((o) => o.etiqueta).join(" | ")}]` : ""}`);
}
