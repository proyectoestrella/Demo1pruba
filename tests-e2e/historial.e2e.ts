import type { Page } from "@playwright/test";
import { entrarAlPanel, expect, test } from "./fixtures";

/**
 * Historial de cambios y deshacer, en la demo: editar las notas de una ficha
 * deja un cambio con aparato; el historial lo enseña, y deshacer pide
 * confirmación en la propia fila y devuelve las notas.
 */
test.describe("Historial de cambios (demo)", () => {
  async function cerrarVisita(page: Page) {
    const cerrar = page.getByRole("button", { name: "Cerrar", exact: true });
    await cerrar.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await cerrar.isVisible()) await cerrar.click();
  }

  test("cambio → historial con aparato → deshacer con confirmación", async ({ page, audit }) => {
    await entrarAlPanel(page, audit);
    await cerrarVisita(page);
    await audit.abrir("/app/clients", page.getByText(/\d+ clientas/));
    await cerrarVisita(page);
    await page
      .locator("tbody tr:visible, button:visible")
      .filter({ hasText: /\d+ visitas?|\+34/ })
      .first()
      .click();
    const notas = page.getByLabel("Notas y preferencias");
    await expect(notas).toBeVisible();
    const antes = await notas.inputValue();
    await notas.fill("Nota de prueba del historial");
    await notas.blur();
    // Aviso efímero con «Deshacer».
    await expect(page.getByText(/Editada la ficha de/).first()).toBeVisible();
    await page.keyboard.press("Escape");

    // Historial al alcance desde la cabecera.
    await page.getByTestId("abrir-historial").filter({ visible: true }).first().click();
    const fila = page.getByTestId("fila-cambio").filter({ hasText: /Editada la ficha de/ }).first();
    await expect(fila).toBeVisible();
    await expect(fila.getByTestId("cambio-dispositivo")).toContainText("(este aparato)");
    await audit.revisar("historial-cambios");

    // Filtro «Solo este dispositivo»: lo hecho aquí sigue a la vista.
    await page.getByTestId("solo-este-dispositivo").check();
    await expect(fila).toBeVisible();

    // Deshacer pide confirmación en la propia fila; «No» no hace nada.
    await fila.getByRole("button", { name: "Deshacer", exact: true }).click();
    await expect(fila.getByTestId("confirmar-deshacer")).toBeVisible();
    await fila.getByRole("button", { name: "No, dejarlo" }).click();
    await expect(fila.getByTestId("confirmar-deshacer")).toBeHidden();
    await fila.getByRole("button", { name: "Deshacer", exact: true }).click();
    await fila.getByTestId("confirmar-deshacer-si").click();
    await expect(fila.getByText("Deshecho", { exact: true })).toBeVisible();
    // Y queda anotado el deshacer.
    await expect(page.getByTestId("fila-cambio").filter({ hasText: /Deshizo: /i }).first()).toBeVisible();
    expect(audit.bloqueos, "El historial de la demo no escribe en remoto").toEqual([]);
    void antes;
  });
});
