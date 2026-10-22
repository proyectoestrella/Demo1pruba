/**
 * «Instalar» el panel (22-oct): la tarjeta de Hoy va en el flujo (nunca encima
 * de la barra inferior), se cierra y lo recuerda, y en ordenador no sale; la
 * fila de Ajustes › Accesos está siempre.
 *
 * En la demo la tarjeta no sale sola: `?instalar=1` la pide a propósito.
 * Capturas: E2E_CAPTURAS=<carpeta> guarda las de cada caso.
 */
import type { Page } from "@playwright/test";
import { entrarAlPanel, expect, test } from "./fixtures";

const CAPTURAS = process.env.E2E_CAPTURAS;
const tarjeta = (page: Page) => page.locator("[data-aviso-instalar]");

async function cerrarVisita(page: Page) {
  const cerrar = page.getByRole("button", { name: "Cerrar", exact: true });
  await cerrar.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
  if (await cerrar.isVisible()) await cerrar.click();
}

/** Simula que Chrome ofrece instalar (lo que hace en Android). */
async function ofrecerInstalacion(page: Page) {
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & Record<string, unknown>;
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);
  });
}

async function captura(page: Page, nombre: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nombre}.png` });
}

test("móvil Android: la tarjeta va al final de Hoy, por encima de la barra, y al cerrarla no vuelve", async ({ browser }, info) => {
  test.skip(info.project.name !== "movil", "solo móvil");
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    locale: "es-ES",
  });
  const page = await ctx.newPage();
  await page.goto("/demo/peluchic");
  await page.getByText(/Citas de hoy/).first().waitFor();
  await page.goto("/app?instalar=1");
  await page.getByText(/Citas de hoy/).first().waitFor();
  await cerrarVisita(page);
  await ofrecerInstalacion(page);
  await expect(tarjeta(page)).toBeVisible({ timeout: 8000 });
  await expect(tarjeta(page).getByRole("button", { name: "Instalar" })).toBeVisible();
  // En el flujo, no fija: nunca tapa nada.
  expect(await tarjeta(page).evaluate((el) => getComputedStyle(el).position)).toBe("static");
  await tarjeta(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const t = (await tarjeta(page).boundingBox())!;
  const barra = (await page.locator('nav[aria-label="Apartados"]').boundingBox())!;
  expect(t.y + t.height).toBeLessThanOrEqual(barra.y + 1);
  await captura(page, "390-android-tarjeta");
  // Cerrar: se recuerda al volver a cargar.
  await tarjeta(page).getByRole("button", { name: "Cerrar" }).click();
  await expect(tarjeta(page)).toHaveCount(0);
  await page.reload();
  await page.getByText(/Citas de hoy/).first().waitFor();
  await ofrecerInstalacion(page);
  await page.waitForTimeout(3500);
  await expect(tarjeta(page)).toHaveCount(0);
  await ctx.close();
});

test("iPhone Safari: «Cómo» abre la hoja con los pasos; sin ?instalar=1 la demo no la enseña", async ({ page, audit }, info) => {
  test.skip(info.project.name !== "movil", "solo móvil");
  await entrarAlPanel(page, audit);
  await cerrarVisita(page);
  await page.waitForTimeout(3500);
  await expect(tarjeta(page)).toHaveCount(0);
  await page.goto("/app?instalar=1");
  await page.getByText(/Citas de hoy/).first().waitFor();
  await cerrarVisita(page);
  await expect(tarjeta(page)).toBeVisible({ timeout: 8000 });
  await tarjeta(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const t = (await tarjeta(page).boundingBox())!;
  const barra = (await page.locator('nav[aria-label="Apartados"]').boundingBox())!;
  expect(t.y + t.height).toBeLessThanOrEqual(barra.y + 1);
  await captura(page, "390-ios-tarjeta");
  await tarjeta(page).getByRole("button", { name: "Cómo" }).click();
  const hoja = page.locator("[data-hoja-instalar]");
  await expect(hoja).toBeVisible();
  await expect(hoja.getByText("Compartir")).toBeVisible();
  await expect(hoja.getByText("Añadir a pantalla de inicio")).toBeVisible();
  await page.waitForTimeout(400);
  await captura(page, "390-ios-hoja-pasos");
});

test("ordenador: sin tarjeta en Hoy; la fila de Ajustes › Accesos abre los pasos", async ({ page, audit }, info) => {
  test.skip(info.project.name !== "escritorio", "solo escritorio");
  await entrarAlPanel(page, audit);
  await page.goto("/app?instalar=1");
  await page.getByText(/Citas de hoy/).first().waitFor();
  await cerrarVisita(page);
  await page.waitForTimeout(3500);
  await expect(tarjeta(page)).toHaveCount(0);
  await page.goto("/app/settings?seccion=accesos");
  await cerrarVisita(page);
  const fila = page.locator("[data-fila-instalar]");
  if (!(await fila.isVisible())) await page.getByText("Accesos", { exact: true }).first().click();
  await expect(fila).toBeVisible();
  await fila.scrollIntoViewIfNeeded();
  await captura(page, "1366-ajustes-fila");
  await fila.getByRole("button", { name: "Cómo" }).click();
  await expect(page.locator("[data-hoja-instalar]")).toBeVisible();
  await page.waitForTimeout(400);
  await captura(page, "1366-ajustes-hoja");
});
