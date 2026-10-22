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
    await page.getByRole("dialog").getByTestId("fila-version").nth(1).click();
    await expect(page.getByTestId("diferencias-version")).toContainText("Peluquería de prueba e2e");
    await page.getByTestId("volver-a-version").click();
    await page.getByTestId("confirmar-version-si").click();
    await expect(page.getByLabel("Tipo de negocio")).toHaveValue(tipoOriginal);
    await expect(page.getByLabel("WhatsApp para pedir cita")).toHaveValue(waOriginal);
    await page.goto("/s/peluchic");
    await expect(page.getByText("Peluquería de prueba e2e")).toHaveCount(0);
    expect(audit.consola).toEqual([]);
  });

  test("Texto e imagen: publicar, verlo en la web, deshacer desde el Historial y volver a una versión", async ({ page, audit }) => {
    audit.ignorar(/Failed to load resource|ERR_|net::/);
    await abrirMiPagina(page, audit);
    const tipo = page.getByLabel("Tipo de negocio");
    const portada = page.getByLabel("Foto de portada (enlace)");
    const tipoOriginal = await tipo.inputValue();
    const portadaOriginal = await portada.inputValue();
    const aplicar = page.getByRole("button", { name: "Aplicar en la demo" });

    // 1) Primera publicación: un texto.
    await tipo.fill("Salón e2e versión uno");
    await aplicar.click();
    await expect(page.getByText("Todo publicado", { exact: true })).toBeVisible();
    // 2) Segunda: la foto de portada.
    await portada.fill("/demo/peluchic-galeria/novia-melena-suelta-1200.webp");
    await aplicar.click();
    await expect(page.getByText("Todo publicado", { exact: true })).toBeVisible();

    // La web pública ya lo enseña.
    await page.goto("/s/peluchic");
    await expect(page.getByText("Salón e2e versión uno").first()).toBeAttached();
    expect(await page.content()).toContain("novia-melena-suelta");

    // Historial: frases que se entienden, y deshacer la portada.
    await abrirMiPagina(page, audit, { entrar: false });
    await page.getByTestId("abrir-historial").filter({ visible: true }).first().click();
    const filaPortada = page.getByTestId("fila-cambio").filter({ hasText: "Nueva foto de portada" }).filter({ hasNotText: "Deshizo" }).first();
    await expect(filaPortada).toBeVisible();
    await expect(page.getByTestId("fila-cambio").filter({ hasText: "Cambió el tipo de negocio" }).first()).toContainText("Salón e2e versión uno");
    await filaPortada.getByRole("button", { name: "Deshacer", exact: true }).click();
    await filaPortada.getByTestId("confirmar-deshacer-si").click();
    await expect(filaPortada.getByText("Deshecho", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await abrirMiPagina(page, audit, { entrar: false });
    await expect(portada).toHaveValue(portadaOriginal);
    await expect(tipo).toHaveValue("Salón e2e versión uno");

    // Versiones: volver a la de antes de todo, con su lista de diferencias y confirmación.
    await page.getByTestId("abrir-versiones").click();
    const filas = page.getByRole("dialog").getByTestId("fila-version");
    await filas.last().click();
    await expect(page.getByTestId("diferencias-version")).toContainText("Salón e2e versión uno");
    await page.getByTestId("volver-a-version").click();
    await expect(page.getByTestId("confirmar-version")).toBeVisible();
    await page.getByTestId("confirmar-version-si").click();
    await expect(tipo).toHaveValue(tipoOriginal);
    await page.reload();
    await abrirMiPagina(page, audit, { entrar: false });
    await expect(tipo).toHaveValue(tipoOriginal);

    // Restaurar también se deshace: la versión de antes de restaurar sigue en la lista.
    await page.getByTestId("abrir-versiones").click();
    await expect(page.getByRole("dialog").getByTestId("fila-version").nth(1)).toBeVisible();
    await page.getByRole("dialog").getByTestId("fila-version").nth(1).click();
    await expect(page.getByTestId("diferencias-version")).toContainText("Salón e2e versión uno");
  });

  test("En vertical no hay scroll vacío bajo la página (marco de la vista previa)", async ({ page, audit }) => {
    await abrirMiPagina(page, audit);
    for (const [width, height] of [[360, 740], [390, 844], [430, 932], [844, 390]] as const) {
      await page.setViewportSize({ width, height });
      // Le da tiempo al ResizeObserver: el fallo crecía en bucle tras cada medida.
      await page.waitForTimeout(1200);
      const m = await page.evaluate(() => {
        const ultimo = document.querySelector('[data-testid="hueco-vista-previa"]')!.closest(".pagina")!;
        return { alto: document.documentElement.scrollHeight, fin: ultimo.getBoundingClientRect().bottom + window.scrollY };
      });
      // La página acaba tras el último bloque más el hueco normal de abajo (barra del panel), nunca miles de píxeles después.
      expect(m.alto - m.fin, `${width}x${height}: scrollHeight ${m.alto}, fin del contenido ${m.fin}`).toBeLessThan(260);
    }
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
