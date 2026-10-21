import { expect, simularAuthConfigurada, test } from "./fixtures";

const LOGIN = "/login?s=peluchic";

test.describe("Entrada", () => {
  test("Acceso 1 · /login?s=peluchic", async ({ page, audit }) => {
    await audit.abrir(LOGIN, page.getByText("Acceso profesional"));
    await expect(page.getByText("PeluChic").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar código" })).toBeVisible();
    await audit.revisar("acceso-1-login");
  });

  test("Acceso 2 · correo inválido muestra aviso", async ({ page, audit }) => {
    await simularAuthConfigurada(page);
    await audit.abrir(LOGIN, page.getByText("Acceso profesional"));
    await page.getByLabel("Tu correo").fill("a@b");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText(/Escribe tu correo completo/)).toBeVisible();
    await audit.revisar("acceso-2-correo-invalido");
  });

  test("Acceso 3 · correo → código (OTP simulado)", async ({ page, audit }) => {
    await simularAuthConfigurada(page);
    await audit.abrir(LOGIN, page.getByText("Acceso profesional"));
    await page.getByLabel("Tu correo").fill("prueba-e2e@example.com");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText("Mira tu correo")).toBeVisible();
    await expect(page.getByLabel("Código del correo")).toBeVisible();
    await audit.revisar("acceso-3-introduce-codigo");
  });

  test("Acceso 4 · código de 6 cifras pegado", async ({ page, audit }) => {
    await simularAuthConfigurada(page);
    audit.ignorar(/status of 403/); // el 403 lo provoca esta prueba (código rechazado a propósito)
    await audit.abrir(LOGIN, page.getByText("Acceso profesional"));
    await page.getByLabel("Tu correo").fill("prueba-e2e@example.com");
    await page.getByRole("button", { name: "Enviar código" }).click();
    const campo = page.getByLabel("Código del correo");
    await expect(campo).toBeVisible();
    // Pegado real: evento paste con texto con espacios y guiones, como lo copia un correo.
    await campo.focus();
    await campo.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", "123 456");
      el.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    await campo.fill("12345678"); // algunos navegadores no aplican el paste sintético: se rellena igual
    await expect(campo).toHaveValue("12345678");
    // El código simulado se rechaza (verify devuelve otp_expired): la app debe explicarlo.
    await expect(page.getByRole("alert")).toContainText(/código/i);
    await expect(page).toHaveURL(/\/login/);
    await audit.revisar("acceso-4-codigo-pegado");
  });
});
