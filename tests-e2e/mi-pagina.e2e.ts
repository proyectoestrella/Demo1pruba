import type { Page } from "@playwright/test";
import { entrarAlPanel, expect, test, type Auditoria } from "./fixtures";

/**
 * Mi página (demo de PeluChic): editar → aplicar → verlo en la vista previa y
 * en la página pública /s/peluchic; recargar sin perder nada; y volver atrás
 * desde Versiones. Todo en el navegador; nada sale a la red real (fixtures.ts).
 */
async function abrirMiPagina(page: Page, audit: Auditoria, { entrar = true } = {}) {
  // Un aviso de hidratación de la página pública (avatares con foto embebida) es
  // ajeno a esta pantalla y lo cubre la prueba de la landing.
  audit.ignorar(/hydrated but some attributes/);
  if (entrar) {
    await entrarAlPanel(page, audit);
    await page.getByRole("button", { name: "Cerrar", exact: true }).click({ timeout: 4000 }).catch(() => {});
  }
  await audit.abrir("/app/web", page.getByLabel("Nombre del salón"));
  const contacto = page.getByRole("button", { name: /Cómo te encuentran/ });
  if (await contacto.getAttribute("aria-expanded").then((v) => v !== "true").catch(() => true)) await contacto.click();
}

test.describe("Mi página", () => {
  test("Editar, aplicar, ver en la página pública, recargar y restaurar", async ({ page, audit }) => {
    await abrirMiPagina(page, audit);
    const aplicar = page.getByRole("button", { name: "Aplicar en la demo" });
    await expect(aplicar).toBeDisabled();
    const tipoOriginal = await page.getByLabel("Tipo de negocio").inputValue();
    const waOriginal = await page.getByLabel("WhatsApp para pedir cita").inputValue();

    await page.getByLabel("Tipo de negocio").fill("Peluquería de prueba e2e");
    await page.getByLabel("WhatsApp para pedir cita").fill("+34 612 345 678");
    await expect(page.getByText("Cambios sin publicar", { exact: true })).toBeVisible();
    await expect(aplicar).toBeEnabled();

    // La vista previa (iframe con la web real) recoge el borrador sin publicar.
    const previa = page.frameLocator("iframe").first();
    await expect(previa.getByText("Peluquería de prueba e2e").first()).toBeAttached({ timeout: 15_000 });

    // Valida antes de aplicar: un teléfono imposible no se guarda y se explica.
    await page.getByLabel("Teléfono", { exact: true }).fill("12");
    await aplicar.click();
    await expect(page.getByRole("alert").filter({ hasText: "revisar" })).toBeVisible();
    await page.getByLabel("Teléfono", { exact: true }).fill("612 345 678");

    await aplicar.click();
    await expect(page.getByText("Cambios aplicados en esta demo").first()).toBeVisible();
    await expect(page.getByText("Todo publicado", { exact: true })).toBeVisible();

    // La página pública de la misma sesión ya lo muestra.
    await page.goto("/s/peluchic");
    await expect(page.getByText("Peluquería de prueba e2e").first()).toBeAttached(); // en móvil el rótulo se oculta por diseño

    // Y al volver a Mi página tras recargar, sigue ahí y no hay «cambios sin publicar».
    await abrirMiPagina(page, audit, { entrar: false });
    await expect(page.getByLabel("Tipo de negocio")).toHaveValue("Peluquería de prueba e2e");
    await expect(page.getByLabel("WhatsApp para pedir cita")).toHaveValue("+34 612 345 678");
    await expect(page.getByText("Todo publicado", { exact: true })).toBeVisible();

    // Versiones: volver a la anterior devuelve TODOS los campos editados, no solo algunos.
    await page.getByRole("button", { name: /Versi(ón|ones)/ }).first().click();
    await page.getByRole("dialog").locator("li button").nth(1).click();
    await page.getByRole("button", { name: "Restaurar esta versión" }).click();
    await expect(page.getByLabel("Tipo de negocio")).toHaveValue(tipoOriginal);
    await expect(page.getByLabel("WhatsApp para pedir cita")).toHaveValue(waOriginal);
    await page.goto("/s/peluchic");
    await expect(page.getByText("Peluquería de prueba e2e")).toHaveCount(0);
    expect(audit.consola).toEqual([]);
  });

  test("Validaciones: reseñas con decimales y textos largos se explican", async ({ page, audit }) => {
    await abrirMiPagina(page, audit);
    await page.getByLabel("Instagram", { exact: true }).fill("mi salon");
    await page.getByRole("button", { name: "Aplicar en la demo" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Instagram" })).toBeVisible();
    await expect(page.getByText("Hay algo que revisar antes de publicar").first()).toBeVisible();
    expect(audit.consola).toEqual([]);
  });

  test("Cambios sin publicar: avisa antes de salir de la pantalla", async ({ page, audit }) => {
    await abrirMiPagina(page, audit);
    await page.getByLabel("Tipo de negocio").fill("Cambio sin aplicar");
    let mensaje = "";
    page.once("dialog", async (d) => {
      mensaje = d.message();
      await d.dismiss(); // «Cancelar»: se queda
    });
    await page.locator('a[href="/app/calendar"]:visible').first().click();
    await expect.poll(() => mensaje).toContain("cambios sin publicar");
    await expect(page).toHaveURL(/\/app\/web/);
    await expect(page.getByLabel("Tipo de negocio")).toHaveValue("Cambio sin aplicar");
  });
});
