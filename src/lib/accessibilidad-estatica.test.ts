import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;

function archivosTsx(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return archivosTsx(ruta);
    return /\.(?:ts|tsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

/**
 * Devuelve etiquetas JSX de apertura sin confundirse con el `>` de una
 * expresión, como `onClick={() => ...}`. Es deliberadamente pequeño: el
 * objetivo es vigilar los dos patrones que Lighthouse detectó en la UI.
 */
function etiquetasDeApertura(codigo: string, nombre: string): string[] {
  const inicio = `<${nombre}`;
  const etiquetas: string[] = [];
  let desde = 0;

  while ((desde = codigo.indexOf(inicio, desde)) !== -1) {
    let llave = 0;
    let comilla: "'" | '"' | "`" | null = null;
    let escape = false;
    let hasta = desde + inicio.length;
    for (; hasta < codigo.length; hasta += 1) {
      const caracter = codigo[hasta];
      if (comilla) {
        if (escape) escape = false;
        else if (caracter === "\\") escape = true;
        else if (caracter === comilla) comilla = null;
        continue;
      }
      if (caracter === "'" || caracter === '"' || caracter === "`") {
        comilla = caracter;
      } else if (caracter === "{") {
        llave += 1;
      } else if (caracter === "}") {
        llave -= 1;
      } else if (caracter === ">" && llave === 0) {
        etiquetas.push(codigo.slice(desde, hasta + 1));
        break;
      }
    }
    desde = hasta + 1;
  }
  return etiquetas;
}

const fuentes = [
  ...archivosTsx(join(raiz, "components")),
  ...archivosTsx(join(raiz, "routes")),
].map((ruta) => ({ ruta, codigo: readFileSync(ruta, "utf8") }));

describe("regresión de nombres accesibles", () => {
  test("cada SelectTrigger de la interfaz tiene una etiqueta explícita", () => {
    const sinEtiqueta = fuentes.flatMap(({ ruta, codigo }) =>
      etiquetasDeApertura(codigo, "SelectTrigger")
        .filter((etiqueta) => !/\baria-label\s*=/.test(etiqueta))
        .map(() => ruta),
    );

    expect(sinEtiqueta).toEqual([]);
  });

  test("cada botón de solo icono de la interfaz tiene una etiqueta", () => {
    const sinEtiqueta = fuentes.flatMap(({ ruta, codigo }) =>
      etiquetasDeApertura(codigo, "Button")
        .filter((etiqueta) => /\bsize\s*=\s*["']icon["']/.test(etiqueta))
        .filter((etiqueta) => !/\baria-label\s*=/.test(etiqueta))
        .map(() => ruta),
    );

    expect(sinEtiqueta).toEqual([]);
  });

  test("los menús de más opciones identifican qué control abren", () => {
    const sinEtiqueta = fuentes.flatMap(({ ruta, codigo }) => {
      const controles = codigo.match(/<(?:Button|button)\b[^>]*>(?:(?!<\/?(?:Button|button)\b)[\s\S])*?<MoreHorizontal\b/g) ?? [];
      return controles
        .filter((control) => !/\baria-label\s*=/.test(control.slice(0, control.indexOf(">") + 1)))
        .map(() => ruta);
    });

    expect(sinEtiqueta).toEqual([]);
  });

  test("el buscador de cabecera conserva en su nombre el texto visible", () => {
    const buscador = fuentes.find(({ ruta }) => ruta.endsWith("BuscadorGlobal.tsx"))?.codigo;
    expect(buscador).toContain('aria-label="Buscar clienta por nombre o teléfono"');
  });

  test("los campos reutilizables del panel conectan cada Label visible con su control", () => {
    const miPagina = fuentes.find(({ ruta }) => ruta.endsWith("app.web.tsx"))?.codigo ?? "";
    const ajustes = fuentes.find(({ ruta }) => ruta.endsWith("app.settings.tsx"))?.codigo ?? "";

    for (const [codigo, componente] of [[miPagina, "Campo"], [miPagina, "CampoLargo"], [ajustes, "Field"]] as const) {
      const inicio = codigo.indexOf(`function ${componente}(`);
      expect(inicio, `${componente} debe seguir siendo un campo reutilizable`).toBeGreaterThanOrEqual(0);
      const cuerpo = codigo.slice(inicio, codigo.indexOf("\nfunction ", inicio + 1) || undefined);
      expect(cuerpo).toContain("useId()");
      expect(cuerpo).toContain("htmlFor={id}");
      expect(cuerpo).toMatch(/<(?:Input|Textarea)\s+id=\{id\}/);
    }
  });

  test("los filtros de clientas no declaran pestañas sin panel asociado", () => {
    const clientas = fuentes.find(({ ruta }) => ruta.endsWith("app.clients.tsx"))?.codigo ?? "";
    expect(clientas).not.toContain("TabsTrigger");
    expect(clientas).toContain('role="group" aria-label="Filtrar clientas"');
    expect(clientas).toContain("aria-pressed={filtroEfectivo === id}");
  });

  test("las zonas táctiles pequeñas conservan un mínimo sin solaparse", () => {
    const hoy = fuentes.find(({ ruta }) => ruta.endsWith("HoyArena.tsx"))?.codigo ?? "";
    const calendario = fuentes.find(({ ruta }) => ruta.endsWith("CalendarioArena.tsx"))?.codigo ?? "";
    expect(hoy).toContain("min-w-[600px]");
    expect(hoy).toContain("min-w-6");
    expect(calendario).toContain('aria-label="Colores del calendario"');
    expect(calendario).toContain("anchoMinimoMovil={anchoMinimoSemanaMovil}");
    expect(calendario).toContain("return Math.max(44, maxCarriles * 28)");
  });
});
