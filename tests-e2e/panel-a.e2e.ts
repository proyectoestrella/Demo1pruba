/**
 * 22-oct (panel A, instalación de PeluChic): calendario que abre en
 * Cronograma, Clientas sin «Importar» salvo con ?importar=1, Citas con un
 * periodo que filtra la lista y el único «Exportar resumen», y el calendario
 * usable con el móvil en horizontal.
 */
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { entrarAlPanel, expect, test, type Auditoria } from "./fixtures";

const cerrarVisita = (page: Page) => page.getByRole("button", { name: "Cerrar", exact: true });

async function abrir(page: Page, audit: Auditoria, ruta: string, marcador: ReturnType<Page["locator"]>) {
  await entrarAlPanel(page, audit);
  await cerrarVisita(page).waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
  if (await cerrarVisita(page).isVisible()) await cerrarVisita(page).click();
  await audit.abrir(ruta, marcador);
  if (await cerrarVisita(page).isVisible()) await cerrarVisita(page).click();
}

const vistaActiva = (page: Page) =>
  page.getByRole("tablist", { name: "Vista del calendario" }).locator('[aria-selected="true"]');

test.describe("Calendario: vista por defecto", () => {
  test("la primera visita abre en Cronograma y una vista elegida se recuerda", async ({ page, audit }) => {
    await abrir(page, audit, "/app/calendar", vistaActiva(page));
    await expect(page.getByRole("tab", { name: "Cronograma", selected: true })).toBeVisible();
    await page.getByRole("tab", { name: "Mes", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Mes", exact: true, selected: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("tab", { name: "Mes", exact: true, selected: true })).toBeVisible();
    await expect(vistaActiva(page)).toHaveCount(1);
    expect(audit.consola).toEqual([]);
  });
});

test.describe("Clientas: importar solo con ?importar=1", () => {
  test("por defecto no hay botón de importar", async ({ page, audit }) => {
    await abrir(page, audit, "/app/clients", page.getByText(/\d+ clientas/));
    await expect(page.getByRole("button", { name: /Importar/ })).toHaveCount(0);
    await expect(page.getByText(/impórtalas/)).toHaveCount(0);
  });

  test("con ?importar=1 sale el botón y abre el diálogo", async ({ page, audit }) => {
    await abrir(page, audit, "/app/clients?importar=1", page.getByText(/\d+ clientas/));
    const boton = page.getByRole("button", { name: "Importar desde TPV 123" });
    await expect(boton).toBeVisible();
    await boton.click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Importar desde TPV 123" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    expect(audit.consola).toEqual([]);
  });
});

test.describe("Citas: periodo y «Exportar resumen»", () => {
  const PERIODOS = ["Todas las fechas", "Hoy", "Últimos 7 días", "Últimos 30 días", "Este mes", "Mes pasado"];

  test("cada periodo filtra la lista y el CSV trae lo mismo", async ({ page, audit }, info) => {
    test.skip(info.project.name !== "escritorio", "Una pasada basta: la lógica es la misma");
    test.setTimeout(120_000);
    await abrir(page, audit, "/app/appointments", page.getByTestId("resumen-periodo-citas"));
    // Un solo botón de exportar; los dos de antes ya no existen.
    await expect(page.getByRole("button", { name: "Exportar resumen" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Resumen del mes|Exportar a Excel/ })).toHaveCount(0);

    const cuentas: Record<string, number> = {};
    for (const periodo of PERIODOS) {
      await page.getByRole("combobox", { name: "Periodo" }).click();
      await page.getByRole("option", { name: periodo, exact: true }).click();
      const resumen = page.getByTestId("resumen-periodo-citas");
      await expect(resumen).toContainText(periodo);
      const n = Number((await resumen.innerText()).match(/^(\d+) citas?/)![1]);
      cuentas[periodo] = n;

      const [descarga] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Exportar resumen" }).click(),
      ]);
      const csv = readFileSync((await descarga.path())!, "utf8");
      expect(csv.charCodeAt(0), "BOM UTF-8").toBe(0xfeff);
      const lineas = csv.slice(1).split("\r\n");
      expect(lineas[1]).toBe(`Periodo;${(await resumen.innerText()).replace(/^\d+ citas? · /, "")}`);
      const detalle = lineas.slice(lineas.indexOf("Detalle") + 2);
      if (n === 0) {
        expect(detalle).toEqual(["Sin citas en este periodo."]);
      } else {
        expect(detalle.length, `${periodo}: filas del CSV = citas de la lista`).toBe(n);
        for (const l of detalle) expect(l).toMatch(/^\d{2}\/\d{2}\/\d{4};\d{2}:\d{2};/);
      }
      const totales = lineas.find((l) => l.startsWith("Citas (sin canceladas);"))!;
      const canceladas = Number(lineas.find((l) => l.startsWith("Canceladas;"))!.split(";")[1]);
      expect(Number(totales.split(";")[1]) + canceladas).toBe(n);
      expect(lineas.find((l) => l.startsWith("Ingresos:"))).toMatch(/;\d+,\d{2}$/);
    }
    // Los periodos encajan entre sí.
    expect(cuentas["Hoy"]).toBeLessThanOrEqual(cuentas["Últimos 7 días"]);
    expect(cuentas["Últimos 7 días"]).toBeLessThanOrEqual(cuentas["Últimos 30 días"]);
    expect(cuentas["Este mes"]).toBeLessThanOrEqual(cuentas["Todas las fechas"]);
    expect(cuentas["Mes pasado"]).toBeLessThanOrEqual(cuentas["Todas las fechas"]);

    // Los filtros de estado también llegan al archivo.
    await page.getByRole("combobox", { name: "Periodo" }).click();
    await page.getByRole("option", { name: "Este mes", exact: true }).click();
    await page.getByRole("combobox", { name: "Filtrar por estado" }).click();
    await page.getByRole("option", { name: "Cancelada", exact: true }).click();
    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar resumen" }).click(),
    ]);
    const csv = readFileSync((await descarga.path())!, "utf8");
    expect(csv).toContain("Filtros;Estado: Cancelada");
    expect(csv).toContain("Citas (sin canceladas);0");
    expect(audit.consola).toEqual([]);
  });
});

for (const vp of [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
]) {
  test.describe(`Móvil en horizontal ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp, isMobile: true, hasTouch: true });
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== "escritorio", "El tamaño lo fija esta prueba");
    });

    test("el calendario se ve y se desplaza en todas las vistas", async ({ page, audit }) => {
      await abrir(page, audit, "/app/calendar", vistaActiva(page));
      for (const vista of ["Cronograma", "Día", "Semana", "Mes"]) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole("tab", { name: vista, exact: true }).click();
        await page.waitForTimeout(300);
        // La página se desplaza hasta dejar la caja del calendario entera a la vista.
        await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
        await page.waitForTimeout(300);
        const medida = await page.evaluate(() => {
          const caja = document.querySelector<HTMLElement>(".caja-calendario")!.getBoundingClientRect();
          const barra = document.querySelector<HTMLElement>(".barra-inferior-panel")!.getBoundingClientRect();
          return { alto: caja.height, arriba: caja.top, abajo: caja.bottom, barra: barra.top, scrollY: window.scrollY };
        });
        expect(medida.scrollY, `${vista}: la página se desplaza`).toBeGreaterThan(0);
        expect(medida.alto, `${vista}: la caja tiene alto de verdad`).toBeGreaterThan(vp.height * 0.6);
        if (vista !== "Cronograma") {
          expect(medida.arriba, `${vista}: la caja empieza en pantalla`).toBeGreaterThanOrEqual(-1);
          expect(medida.abajo, `${vista}: la barra inferior no la tapa`).toBeLessThanOrEqual(medida.barra + 1);
          // Y por dentro sigue su propio scroll (horas o semanas).
          const desplazable = page.locator(".caja-calendario .overflow-auto").first();
          const antes = await desplazable.evaluate((n) => n.scrollTop);
          await desplazable.evaluate((n) => n.scrollBy(0, 200));
          const despues = await desplazable.evaluate((n) => n.scrollTop);
          if (vista !== "Mes") expect(despues, `${vista}: la rejilla se desplaza por dentro`).toBeGreaterThan(antes);
        } else {
          // El cronograma crece: al final del scroll se ve su última fila sobre la barra.
          expect(medida.abajo).toBeLessThanOrEqual(medida.barra + 1);
        }
      }
      expect(audit.consola).toEqual([]);
    });

    test("cabecera y barra inferior compactas", async ({ page, audit }) => {
      await abrir(page, audit, "/app/calendar", vistaActiva(page));
      const altos = await page.evaluate(() => ({
        cabecera: document.querySelector<HTMLElement>(".cabecera-panel")!.getBoundingClientRect().height,
        barra: document.querySelector<HTMLElement>(".barra-inferior-panel")!.getBoundingClientRect().height,
      }));
      expect(altos.cabecera).toBeLessThanOrEqual(64);
      expect(altos.barra).toBeLessThanOrEqual(48);
    });

    for (const ruta of ["/app", "/app/appointments", "/app/clients", "/app/employees", "/app/services", "/app/settings"]) {
      test(`${ruta}: sin desbordes y con scroll`, async ({ page, audit }) => {
        await abrir(page, audit, ruta, page.locator("main [data-pagina]").first());
        const m = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
          sh: document.documentElement.scrollHeight,
          ch: document.documentElement.clientHeight,
        }));
        expect(m.sw).toBeLessThanOrEqual(m.cw);
        expect(m.sh).toBeGreaterThan(m.ch);
        await page.mouse.wheel(0, 600);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
        expect(audit.consola).toEqual([]);
      });
    }
  });
}
