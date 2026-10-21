/**
 * Regla única de maquetación (src/styles.css · «REGLA ÚNICA DE MAQUETACIÓN»):
 * en cada pantalla del panel y en cada ancho, nada se sale por los lados y el
 * contenido principal empieza exactamente en el gutter común
 * (16 px móvil · 24 px tablet · 32 px escritorio), medido desde el borde del <main>.
 *
 * Se ejecuta solo en el proyecto «escritorio»: los cuatro anchos los pone esta prueba.
 */
import type { Page } from "@playwright/test";
import { entrarAlPanel, expect, test } from "./fixtures";

const ANCHOS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 900 },
] as const;

const gutterPara = (ancho: number) => (ancho < 768 ? 16 : ancho < 1024 ? 24 : 32);

type Pantalla = { nombre: string; ruta?: string; preparar?: (page: Page) => Promise<void> };

const PANTALLAS: Pantalla[] = [
  { nombre: "Hoy" },
  { nombre: "Calendario", ruta: "/app/calendar" },
  { nombre: "Citas", ruta: "/app/appointments" },
  { nombre: "Clientas", ruta: "/app/clients" },
  { nombre: "Equipo", ruta: "/app/employees" },
  { nombre: "Servicios", ruta: "/app/services" },
  { nombre: "Ajustes", ruta: "/app/settings" },
  {
    nombre: "Ajustes · Accesos",
    ruta: "/app/settings",
    preparar: async (page) => {
      await page.locator("button[aria-expanded]").filter({ hasText: /^Accesos/ }).click();
    },
  },
  { nombre: "Mi página", ruta: "/app/web" },
  { nombre: "Hoja del día", ruta: "/app/hoja" },
];

const cerrarVisita = (page: Page) => page.getByRole("button", { name: "Cerrar", exact: true });

async function sinScrollHorizontal(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw, "La página no debe hacer scroll horizontal").toBeLessThanOrEqual(cw);
}

async function abrirPanel(page: Page, audit: Parameters<typeof entrarAlPanel>[1]) {
  await entrarAlPanel(page, audit);
  await cerrarVisita(page)
    .waitFor({ state: "visible", timeout: 4000 })
    .catch(() => {});
  if (await cerrarVisita(page).isVisible()) await cerrarVisita(page).click();
}

for (const vp of ANCHOS) {
  test.describe(`Maquetación ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp, isMobile: vp.width < 768, hasTouch: vp.width < 1024 });
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== "escritorio", "Los anchos los fija esta prueba");
    });

    for (const p of PANTALLAS) {
      test(`${p.nombre}: sin desbordes y gutter común`, async ({ page, audit }) => {
        await abrirPanel(page, audit);
        if (p.ruta) {
          await audit.abrir(p.ruta, page.locator("main [data-pagina]").first());
          if (await cerrarVisita(page).isVisible()) await cerrarVisita(page).click();
        }
        await p.preparar?.(page);
        await page.waitForTimeout(400); // fundido de entrada de la pantalla
        await sinScrollHorizontal(page);

        const medida = await page.evaluate(() => {
          const pagina = document.querySelector<HTMLElement>("main [data-pagina]")!;
          const main = pagina.closest("main")!;
          const estilo = getComputedStyle(pagina);
          const izq = pagina.getBoundingClientRect().left + parseFloat(estilo.paddingLeft);
          const h1 = pagina.querySelector("h1");
          // Nada visible del contenido puede salirse del <main> por la derecha.
          const derMain = main.getBoundingClientRect().right;
          const salidos = [...main.querySelectorAll<HTMLElement>("h1, h2, p, button, a, input, section")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              if (!r.width || !r.height) return false;
              // Las tiras con scroll propio (chips, rejillas) recortan a propósito.
              for (let a = el.parentElement; a && a !== main; a = a.parentElement) {
                const o = getComputedStyle(a).overflowX;
                if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return false;
              }
              return r.right > derMain + 1;
            })
            .map((el) => `${el.tagName} «${(el.textContent ?? "").trim().slice(0, 30)}»`);
          return {
            gutter: Math.round(izq - main.getBoundingClientRect().left),
            h1: h1 ? Math.round(h1.getBoundingClientRect().left - izq) : 0,
            salidos,
          };
        });
        expect(medida.gutter, "Borde izquierdo del contenido = gutter común").toBeGreaterThanOrEqual(
          gutterPara(vp.width) - 2,
        );
        expect(medida.gutter).toBeLessThanOrEqual(gutterPara(vp.width) + 2);
        // En el calendario de PC el título va a la derecha de los controles: solo no puede salirse del gutter.
        if (p.ruta === "/app/calendar") expect(medida.h1).toBeGreaterThanOrEqual(-2);
        else expect(Math.abs(medida.h1), "El título de la página arranca en el gutter").toBeLessThanOrEqual(2);
        expect(medida.salidos, "Nada se sale por la derecha").toEqual([]);
      });
    }

    test("Nueva cita: a pantalla completa en móvil y sin desbordes", async ({ page, audit }) => {
      await abrirPanel(page, audit);
      await page.getByRole("button", { name: /^Nueva cita$/ }).first().click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo).toBeVisible();
      await sinScrollHorizontal(page);
      const caja = (await dialogo.boundingBox())!;
      if (vp.width < 768) {
        expect(caja.x).toBeLessThanOrEqual(1);
        expect(caja.width).toBeGreaterThanOrEqual(vp.width - 1);
      }
      expect(caja.x + caja.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test("Login: sin desbordes", async ({ page }) => {
      await page.goto("/login?s=peluchic");
      await expect(page.getByRole("button", { name: /Enviar código/ })).toBeVisible();
      await sinScrollHorizontal(page);
      if (vp.width < 768) {
        const caja = (await page.locator("main > div").first().boundingBox())!;
        expect(Math.round(caja.x)).toBe(16);
      }
    });
  });
}
