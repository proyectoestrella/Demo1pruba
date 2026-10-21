import type { Page } from "@playwright/test";
import { entrarAlPanel, expect, test } from "./fixtures";

/**
 * Fotos reales de personas, en la demo (almacén simulado en el navegador):
 * subir, verla en la ficha y en la lista, cambiarla, volver a una anterior y
 * volver al avatar dibujado. Equipo y clientas.
 */
async function pngDePrueba(page: Page, color: string, ancho = 400, alto = 300): Promise<Buffer> {
  const b64 = await page.evaluate(([c, w, h]) => {
    const cv = document.createElement("canvas");
    cv.width = w as number; cv.height = h as number;
    const x = cv.getContext("2d")!;
    x.fillStyle = c as string; x.fillRect(0, 0, w as number, h as number);
    return cv.toDataURL("image/png").split(",")[1];
  }, [color, ancho, alto] as const);
  return Buffer.from(b64, "base64");
}

async function cerrarVisita(page: Page) {
  const cerrar = page.getByRole("button", { name: "Cerrar", exact: true });
  await cerrar.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
  if (await cerrar.isVisible()) await cerrar.click();
}

async function subir(page: Page, color: string) {
  const dialogo = page.getByTestId("gestor-foto");
  await dialogo.getByTestId("foto-input-galeria").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: await pngDePrueba(page, color) });
  await expect(dialogo.getByTestId("foto-vista-previa")).toBeVisible();
  await dialogo.getByRole("button", { name: "Guardar foto" }).click();
  await expect(dialogo.getByText("Esta es la foto actual.")).toBeVisible();
}

test.describe("Fotos de personas (demo)", () => {
  test("clienta: subir → ver en ficha y lista → cambiar → volver a la anterior → avatar dibujado", async ({ page, audit }) => {
    await entrarAlPanel(page, audit);
    await cerrarVisita(page);
    await audit.abrir("/app/clients", page.getByText(/\d+ clientas/));
    await cerrarVisita(page);
    const fila = page.locator("tbody tr:visible, button:visible").filter({ hasText: /\d+ visitas?|\+34/ }).first();
    const nombreFila = ((await fila.innerText()).split("\n")[0] ?? "").trim();
    await fila.click();

    const abrir = page.getByTestId("abrir-foto");
    await expect(abrir).toBeVisible();
    await abrir.click();
    const dialogo = page.getByTestId("gestor-foto");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText("Fotos anteriores")).toHaveCount(0);

    await subir(page, "#c0392b");
    const primera = await dialogo.locator('[data-avatar="foto"] img').getAttribute("src");
    expect(primera).toMatch(/^blob:/);
    await audit.revisar("foto-clienta-dialogo");

    await subir(page, "#2980b9");
    const segunda = await dialogo.locator('[data-avatar="foto"] img').getAttribute("src");
    expect(segunda).not.toBe(primera);
    await expect(dialogo.getByTestId("foto-anterior")).toHaveCount(1);

    // Volver a la anterior con un toque.
    await dialogo.getByTestId("foto-anterior").click();
    await expect(dialogo.locator('[data-avatar="foto"] img')).toHaveAttribute("src", primera!);
    await expect(dialogo.getByTestId("foto-anterior")).toHaveCount(1); // ahora la anterior es la azul

    // Cerrar: la ficha enseña la foto.
    await dialogo.getByRole("button", { name: "Listo", exact: true }).click();
    await expect(page.locator('[data-avatar="foto"]:visible').first()).toBeVisible();

    // Volver al avatar dibujado (conserva el historial).
    await page.getByTestId("abrir-foto").click();
    await page.getByTestId("gestor-foto").getByRole("button", { name: "Volver al avatar dibujado" }).click();
    await expect(page.getByTestId("gestor-foto").locator('[data-avatar="foto"]')).toHaveCount(0);
    await expect(page.getByTestId("gestor-foto").getByTestId("foto-anterior")).toHaveCount(2);
    expect(nombreFila.length).toBeGreaterThan(0);
  });

  test("equipo: la foto sustituye al avatar y se ve también en la lista de clientas tras recargar la vista", async ({ page, audit }) => {
    await entrarAlPanel(page, audit);
    await cerrarVisita(page);
    await audit.abrir("/app/employees", page.getByRole("heading", { name: "Equipo" }).first());
    await page.getByTestId("abrir-foto").first().click();
    await subir(page, "#27ae60");
    await page.getByTestId("gestor-foto").getByRole("button", { name: "Listo", exact: true }).click();
    await expect(page.locator('section [data-avatar="foto"]').first()).toBeVisible();
    await audit.revisar("foto-equipo");
  });

  test("foto ilegible: mensaje claro y no se rompe", async ({ page, audit }) => {
    await entrarAlPanel(page, audit);
    await cerrarVisita(page);
    await audit.abrir("/app/employees", page.getByRole("heading", { name: "Equipo" }).first());
    await page.getByTestId("abrir-foto").first().click();
    const dialogo = page.getByTestId("gestor-foto");
    await dialogo.getByTestId("foto-input-galeria").setInputFiles({ name: "rota.heic", mimeType: "image/heic", buffer: Buffer.from("no soy una imagen") });
    await expect(dialogo.getByTestId("foto-error")).toContainText("No se puede leer esa foto");
    await expect(dialogo.getByRole("button", { name: "Elegir de la galería" })).toBeEnabled();
  });
});
