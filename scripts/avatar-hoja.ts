#!/usr/bin/env bun
/** Genera una hoja estática para revisar el avatar completo, no solo muestras. */
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  COLORES_PELO,
  EDADES,
  PEINADOS,
  PIELES,
  svgDeComposicion,
  type AvatarComposicion,
} from "../src/lib/avatar-svg";

const destino = process.argv[2];
if (!destino) {
  console.error("Uso: bun scripts/avatar-hoja.ts <ruta-salida.html>");
  process.exit(1);
}

const escapar = (texto: string) =>
  texto.replace(
    /[&<>"']/g,
    (caracter) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter]!,
  );
const avatar = (receta: AvatarComposicion, px: number, etiqueta: string) =>
  `<figure class="celda"><div class="avatar" style="width:${px}px;height:${px}px">${svgDeComposicion(receta, { simple: px <= 28 })}</div><figcaption>${escapar(etiqueta)}</figcaption></figure>`;
const receta = (
  piel: AvatarComposicion["piel"],
  peinado: AvatarComposicion["peinado"],
  edad: AvatarComposicion["edad"] = "adulta",
): AvatarComposicion => ({
  piel,
  peinado,
  edad,
  colorPelo:
    edad === "mayor"
      ? "gris"
      : ["morena", "castana", "oscura", "profunda"].includes(piel)
        ? "negro"
        : "castano",
  fondo: "salvia",
});

const matrizEdad = PIELES.flatMap((piel) =>
  EDADES.map((edad) =>
    avatar(receta(piel.id, "corto-con-raya", edad.id), 96, `${piel.nombre} · ${edad.nombre}`),
  ),
).join("");
const matrizPeinados = PEINADOS.flatMap((peinado) =>
  (["muy-clara", "oliva", "profunda"] as const).map((piel) =>
    avatar(
      receta(piel, peinado.id),
      64,
      `${peinado.nombre} · ${PIELES.find((tono) => tono.id === piel)!.nombre}`,
    ),
  ),
).join("");
const tamanos = PIELES.flatMap((piel) =>
  [24, 40].map((px) => avatar(receta(piel.id, "corto-con-raya"), px, `${piel.nombre} · ${px}px`)),
).join("");

const coloresPelo = COLORES_PELO.flatMap((color) =>
  (["clara", "oliva", "oscura"] as const).map((piel) =>
    avatar(
      { ...receta(piel, "corto-con-raya"), colorPelo: color.id },
      64,
      `${color.nombre} · ${PIELES.find((tono) => tono.id === piel)!.nombre}`,
    ),
  ),
).join("");

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hoja de contacto · avatares Trimly</title>
  <style>
    :root { color: #3B2F2A; background: #EFE7DB; font-family: Manrope, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { max-width: 1500px; margin: 0 auto; padding: 32px; }
    h1 { margin: 0; font-size: 28px; } p { color: #62534C; margin: 8px 0 24px; }
    section { margin: 28px 0; padding: 20px; border: 1px solid #D9CBB8; border-radius: 20px; background: #F7F2EA; }
    h2 { margin: 0 0 6px; font-size: 17px; } .nota { margin: 0 0 16px; font-size: 13px; }
    .rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(122px, 1fr)); gap: 12px; }
    .peinados { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); }
    .pequenos { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); }
    .celda { display: flex; min-width: 0; min-height: 128px; align-items: center; flex-direction: column; justify-content: center; gap: 7px; margin: 0; padding: 8px 4px; border-radius: 12px; background: #fff; }
    .peinados .celda { min-height: 102px; } .pequenos .celda { min-height: 80px; }
    .avatar { flex: 0 0 auto; } .avatar svg { display: block; width: 100%; height: 100%; }
    figcaption { max-width: 100%; color: #5E4F48; font-size: 11px; font-weight: 700; line-height: 1.25; text-align: center; }
    code { padding: 2px 5px; border-radius: 5px; background: #E9DFD1; color: #5E4F48; }
    @media print { body { padding: 14px; } section { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>Hoja de contacto · avatares v3</h1>
  <p>SVG original, sin recursos externos. Camiseta fija; cambia solo el fondo.</p>
  <section><h2>10 tonos × 3 edades · 96 px</h2><p class="nota">Peinado común: corto con raya.</p><div class="rejilla">${matrizEdad}</div></section>
  <section><h2>16 peinados × claro, oliváceo y profundo · 64 px</h2><p class="nota">Los tres tonos son Muy clara, Oliva <code>#C99C62</code> y Profunda.</p><div class="rejilla peinados">${matrizPeinados}</div></section>
  <section><h2>10 colores de pelo × Clara, Oliva y Oscura · 64 px</h2><div class="rejilla peinados">${coloresPelo}</div></section>
  <section><h2>Lectura a tamaño pequeño · 24 y 40 px</h2><div class="rejilla pequenos">${tamanos}</div></section>
</body>
</html>`;

const ruta = resolve(destino);
await mkdir(dirname(ruta), { recursive: true });
await Bun.write(ruta, html);
console.log(`Hoja creada: ${ruta}`);
