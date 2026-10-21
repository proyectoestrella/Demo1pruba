import { EXPRESIONES_RETRATO, PEINADOS_RETRATO, svgRetrato } from "../src/lib/retratos-avatar";

const tarjetas = PEINADOS_RETRATO.flatMap((peinado) =>
  EXPRESIONES_RETRATO.map(
    (expresion) => `
    <article>
      ${svgRetrato({ version: 2, peinado: peinado.id, expresion: expresion.id })}
      <strong>${peinado.nombre}</strong>
      <span>Sonrisa ${expresion.nombre.toLowerCase()} · ${peinado.grupo}</span>
    </article>`,
  ),
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
    header { max-width: 760px; margin: 0 auto 28px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 5vw, 48px); letter-spacing: -.04em; }
    p { margin: 0; color: #625d57; line-height: 1.5; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; max-width: 1180px; margin: auto; }
    article { display: flex; flex-direction: column; align-items: center; padding: 16px 12px 14px; border: 1px solid #d8d2cb; border-radius: 18px; background: #fff; text-align: center; }
    svg { width: 120px; height: 120px; margin-bottom: 10px; }
    strong { font-size: 14px; }
    span { margin-top: 4px; color: #746e67; font-size: 11px; }
    @media (max-width: 520px) { body { padding: 20px 12px; } main { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } article { padding-inline: 6px; } svg { width: 112px; height: 112px; } }
  </style>
</head>
<body>
  <header><h1>Muestrario de avatares</h1><p>15 peinados × 3 sonrisas. Línea negra, fondo blanco y el mismo grosor de trazo en toda la familia.</p></header>
  <main>${tarjetas}</main>
</body>
</html>`;

await Bun.write("tests-e2e/capturas/avatares/muestrario.html", html);
