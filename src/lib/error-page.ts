export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Esta página no ha cargado · siShow</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #faf7f2; color: #2b211b; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #7a5539; color: #fff; border-radius: 999px; }
      .secondary { background: #fff; color: #2b211b; border-color: #e4d9cc; border-radius: 999px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Esta página no ha cargado</h1>
      <p>Algo ha fallado por nuestra parte. Prueba a recargar en un momento o vuelve al inicio.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Volver a intentarlo</button>
        <a class="secondary" href="/">Ir al inicio</a>
      </div>
    </div>
  </body>
</html>`;
}
