// Muestrario de retratos Notionists: catálogo actual (96 y 40 px) y los 16 de antes del 21-oct.
// Uso: bun scripts/generar-muestrario-avatares.ts [carpeta-de-salida]
import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import {
  LABIOS_RETRATO,
  PEINADOS_RETRATO,
  PEINADOS_V1,
  normalizarRetrato,
} from "../src/lib/retratos-avatar";
import { uriRetrato } from "../src/lib/retratos-dicebear";

const salida = process.argv[2] ?? "tests-e2e/capturas/avatares";

/** Réplica exacta del render anterior (cd6393b~1): semilla por tipo y labios variant01. */
const uriAntes = (tipo: "mujer" | "hombre", peinado: string, size: number) =>
  createAvatar(notionists, {
    seed: `sishow-${tipo}`,
    size,
    radius: 50,
    backgroundColor: ["ffffff"],
    hair: [peinado],
    beardProbability: 0,
    glassesProbability: 0,
    gestureProbability: 0,
    bodyIconProbability: 0,
    body: ["variant01"],
    eyes: ["variant01"],
    brows: ["variant01"],
    lips: ["variant01"],
    nose: ["variant01"],
  }).toDataUri();

const estilo = `<style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#f6f3ef;color:#2b211b;font-family:system-ui,sans-serif}
h1{margin:0 0 4px;font-size:24px}p{margin:0 0 16px;color:#6b6058;font-size:13px}h2{font-size:15px;margin:18px 0 8px}
.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
.c{background:#fff;border:1px solid #e3dbd2;border-radius:14px;padding:8px 4px;text-align:center}
.c img{display:block;margin:0 auto 6px;border-radius:50%;box-shadow:0 0 0 1px #e3dbd2}
.c b{display:block;font-size:11px;line-height:1.2}.c i{display:block;font-style:normal;font-size:10px;color:#8a7d72}
.fila40{display:flex;flex-wrap:wrap;gap:10px;background:#fff;border-radius:14px;padding:12px;border:1px solid #e3dbd2}
.fila40 img{border-radius:50%;box-shadow:0 0 0 1px #e3dbd2}
</style>`;

const grupo = { largo: "largo", afro: "afro / rizo", corto: "corto" } as const;
const tarjetas = PEINADOS_RETRATO.map(
  (p) =>
    `<div class="c"><img src="${uriRetrato({ version: 3, peinado: p.id }, 96)}" width="96" height="96"><b>${p.nombre}</b><i>${p.id} · ${grupo[p.grupo]}</i></div>`,
).join("");
const fila40 = PEINADOS_RETRATO.map(
  (p) =>
    `<img src="${uriRetrato({ version: 3, peinado: p.id }, 40)}" width="40" height="40" title="${p.nombre}">`,
).join("");
const nuevo = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Retratos siShow</title>${estilo}<body>
<h1>Retratos del selector · DiceBear Notionists</h1>
<p>${PEINADOS_RETRATO.length} peinados (${PEINADOS_RETRATO.filter((p) => p.grupo !== "corto").length} largos o rizados, ${PEINADOS_RETRATO.filter((p) => p.grupo === "corto").length} cortos) · sonrisa: lips ${LABIOS_RETRATO} · fondo blanco</p>
<h2>96 px</h2><div class="grid">${tarjetas}</div>
<h2>40 px (tamaño de lista)</h2><div class="fila40">${fila40}</div></body></html>`;

const antes = (["mujer", "hombre"] as const)
  .flatMap((tipo) =>
    PEINADOS_V1[tipo].map((variante, indice) => {
      const ahora = normalizarRetrato({ version: 1, tipo, peinado: indice })!;
      return `<div class="c"><img src="${uriAntes(tipo, variante, 96)}" width="96" height="96"><b>${tipo} ${indice}</b><i>${variante}</i>
<img src="${uriRetrato(ahora, 96)}" width="96" height="96" style="margin-top:8px"><i>ahora: ${ahora.peinado}</i></div>`;
    }),
  )
  .join("");
const comparacion = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Retratos antes</title>${estilo}<body>
<h1>Antes de esta noche: los 16 retratos guardables (v1)</h1>
<p>Arriba, el render exacto previo a cd6393b (labios variant01). Debajo, cómo se ve ahora ese mismo avatar guardado.</p>
<div class="grid">${antes}</div></body></html>`;

await Bun.write(`${salida}/muestrario.html`, nuevo);
await Bun.write(`${salida}/antes.html`, comparacion);
console.log(`Escrito ${salida}/muestrario.html y ${salida}/antes.html`);
