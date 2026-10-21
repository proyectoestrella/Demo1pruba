import type { Page } from "@playwright/test";
import { entrarAlPanel, expect, test, type Auditoria } from "./fixtures";

const cerrarVisita = (page: Page) => page.getByRole("button", { name: "Cerrar", exact: true });
const siguiente = (page: Page) => page.getByRole("button", { name: "Siguiente" });

/** Entra en el panel demo y cierra la visita guiada, que sale sola en la primera visita y tapa la pantalla. */
async function enPanel(page: Page, audit: Auditoria, opciones?: { conVisita?: boolean }) {
  await entrarAlPanel(page, audit);
  // La visita arranca sola un instante después de pintar el panel: se espera a que salga.
  await cerrarVisita(page)
    .waitFor({ state: "visible", timeout: 5000 })
    .catch(() => {});
  if (opciones?.conVisita) return;
  if (await cerrarVisita(page).isVisible()) {
    await cerrarVisita(page).click();
    await expect(siguiente(page)).toBeHidden();
  }
}
/** En móvil el menú lateral no está: se navega por URL dentro de la misma sesión demo. */
async function ir(
  page: Page,
  audit: Auditoria,
  ruta: string,
  marcador: ReturnType<Page["locator"]>,
) {
  await enPanel(page, audit);
  await audit.abrir(ruta, marcador);
  if (await cerrarVisita(page).isVisible()) await cerrarVisita(page).click();
}

test.describe("Panel demo", () => {
  test("Panel · Hoy (primera visita, con visita guiada encima)", async ({ page, audit }) => {
    await enPanel(page, audit, { conVisita: true });
    await expect(siguiente(page)).toBeVisible();
    await audit.revisar("panel-hoy-primera-visita");
  });

  test("Panel · Hoy", async ({ page, audit }) => {
    await enPanel(page, audit);
    await expect(page.getByText("Pendiente de ti").first()).toBeVisible();
    await audit.revisar("panel-hoy");
  });

  test("Panel · Calendario", async ({ page, audit }) => {
    await ir(page, audit, "/app/calendar", page.getByRole("button", { name: "Bloquear tiempo" }));
    await audit.revisar("panel-calendario");
  });

  test("Panel · Clientas", async ({ page, audit }) => {
    await ir(page, audit, "/app/clients", page.getByText(/\d+ clientas/));
    await audit.revisar("panel-clientas");
  });

  test("Panel · Equipo", async ({ page, audit }) => {
    await ir(
      page,
      audit,
      "/app/employees",
      page.getByRole("button", { name: "Añadir profesional" }),
    );
    await audit.revisar("panel-equipo");
  });

  test("Panel · Servicios", async ({ page, audit }) => {
    await ir(page, audit, "/app/services", page.getByRole("button", { name: "Nuevo servicio" }));
    await audit.revisar("panel-servicios");
  });

  test("Panel · Ajustes", async ({ page, audit }) => {
    await ir(page, audit, "/app/settings", page.getByRole("heading", { name: "Ajustes" }));
    await audit.revisar("panel-ajustes");
  });

  test("Panel · Ajustes · Accesos", async ({ page, audit }) => {
    await ir(page, audit, "/app/settings", page.getByRole("heading", { name: "Ajustes" }));
    await page
      .locator("button[aria-expanded]")
      .filter({ hasText: /^Accesos/ })
      .click();
    await expect(page.getByText(/acceso|invitar/i).nth(1)).toBeVisible();
    await audit.revisar("panel-ajustes-accesos");
  });

  test("Panel · Nueva cita (abrir y cerrar sin guardar)", async ({ page, audit }) => {
    await enPanel(page, audit);
    const nueva = page.getByRole("button", { name: /^Nueva cita$/ }).first();
    // El botón flotante móvil debe ser pulsable desde el primer momento, sin scroll.
    await expect(nueva).toHaveCSS("pointer-events", "auto");
    await page.screenshot({ path: `tests-e2e/capturas/panel-fab-${test.info().project.name}.png` });
    await nueva.click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await audit.revisar("panel-nueva-cita");
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    expect(audit.bloqueos, "Abrir y cerrar no debe escribir en remoto").toEqual([]);
  });

  test("Panel · Ficha de clienta", async ({ page, audit }) => {
    await ir(page, audit, "/app/clients", page.getByText(/\d+ clientas/));
    await page
      .locator("tbody tr:visible, button:visible")
      .filter({ hasText: /\d+ visitas?|\+34/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await audit.revisar("panel-ficha-clienta");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Panel · Visita guiada (avanzar y cerrar)", async ({ page, audit }) => {
    await enPanel(page, audit, { conVisita: true });
    await expect(siguiente(page)).toBeVisible();
    await siguiente(page).click();
    await expect(page.getByRole("button", { name: "Atrás" })).toBeVisible();
    await audit.revisar("panel-visita-guiada-paso-2");
    await cerrarVisita(page).click();
    await expect(siguiente(page)).toBeHidden();
    // Se puede volver a abrir a mano.
    await page.getByRole("button", { name: "Ver el tour guiado del panel" }).click({ force: true });
    await expect(siguiente(page)).toBeVisible();
    await cerrarVisita(page).click();
    await expect(siguiente(page)).toBeHidden();
  });

  test("Panel · Aviso Instalar", async ({ page, audit }) => {
    await enPanel(page, audit);
    const aviso = page.getByText(/^Instalar PeluChic en este dispositivo/);
    await expect(aviso).toBeVisible();
    await aviso.click();
    await expect(
      page.getByText(/Añadir a|Instalar aplicación|pulsa Instalar/i).first(),
    ).toBeVisible();
    await audit.revisar("panel-aviso-instalar");
  });
});
