import { EXPRESIONES_RETRATO, PEINADOS_RETRATO, svgRetrato } from "../src/lib/retratos-avatar";

const tamanos = [32, 48, 96] as const;

const tarjetas = PEINADOS_RETRATO.map(
  (peinado) => `
    <article>
      <header class="card-header">
        <strong>${peinado.nombre}</strong>
        <span>${peinado.grupo}</span>
      </header>
      <div class="expression-labels" aria-hidden="true">
        <i></i>${EXPRESIONES_RETRATO.map((expresion) => `<i>${expresion.nombre}</i>`).join("")}
      </div>
      ${tamanos
        .map(
          (tamano) => `<div class="size-row">
        <b>${tamano}<small>px</small></b>
        ${EXPRESIONES_RETRATO.map(
          (expresion) =>
            `<div class="portrait" style="--avatar-size:${tamano}px">${svgRetrato({ version: 2, peinado: peinado.id, expresion: expresion.id })}</div>`,
        ).join("")}
      </div>`,
        )
        .join("")}
    </article>`,
).join("");

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Muestrario de avatares · PeluChic</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; background: #f6f3ef; color: #171717; font-family: ui-sans-serif, system-ui, sans-serif; }
    body > header { max-width: 1180px; margin: 0 auto 28px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 5vw, 48px); letter-spacing: -.04em; }
    p { margin: 0; color: #625d57; line-height: 1.5; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 14px; max-width: 1180px; margin: auto; }
    article { padding: 16px; border: 1px solid #d8d2cb; border-radius: 18px; background: #fff; }
    .card-header { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #e9e5e0; }
    .card-header strong { font-size: 16px; }
    .card-header span { color: #746e67; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .expression-labels, .size-row { display: grid; grid-template-columns: 38px repeat(3, minmax(0, 1fr)); align-items: center; justify-items: center; }
    .expression-labels { min-height: 30px; color: #746e67; font-size: 10px; }
    .expression-labels i { font-style: normal; }
    .size-row { min-height: 110px; border-top: 1px solid #f0ede9; }
    .size-row b { color: #4e4944; font-size: 13px; font-variant-numeric: tabular-nums; }
    .size-row small { display: block; color: #8b847c; font-size: 8px; font-weight: 500; text-align: center; }
    .portrait { display: grid; width: 100%; height: 100%; place-items: center; }
    .portrait svg { display: block; width: var(--avatar-size); height: var(--avatar-size); }
    @media (max-width: 520px) { body { padding: 20px 10px; } main { grid-template-columns: 1fr; gap: 10px; } article { padding: 14px 8px; } }
  </style>
</head>
<body>
  <header><h1>Muestrario de avatares</h1><p>15 peinados × 3 expresiones, comprobados a 32, 48 y 96 px. Línea negra, fondo blanco y grosor de trazo común.</p></header>
  <main>${tarjetas}</main>
</body>
</html>`;

await Bun.write("tests-e2e/capturas/avatares/muestrario.html", html);
