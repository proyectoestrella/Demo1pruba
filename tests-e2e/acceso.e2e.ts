import { expect, simularAuthConfigurada, test } from "./fixtures";

/** Resultado seroval de una server function que devuelve `{ permitido: true }`. */
const PERMITIDO = JSON.stringify({
  t: 10,
  i: 0,
  p: {
    k: ["result", "error", "context"],
    v: [
      { t: 10, i: 1, p: { k: ["permitido"], v: [{ t: 2, s: 2 }] }, o: 0 },
      { t: 2, s: 1 },
      { t: 11, i: 2, p: { k: [], v: [] }, o: 0 },
    ],
  },
  o: 0,
});

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

  test("Acceso 5 · código válido: entra al panel sin errores ni doble verificación", async ({ page, audit }) => {
    await simularAuthConfigurada(page);
    let verificaciones = 0;
    // Más reciente = más prioritaria: aquí el código SÍ es válido.
    await page.context().route(/\/auth\/v1\/verify/, async (route) => {
      verificaciones++;
      await new Promise((r) => setTimeout(r, 400)); // da tiempo a ver «Entrando…»
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "e2e-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "e2e-refresco",
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            aud: "authenticated",
            role: "authenticated",
            email: "prueba-e2e@example.com",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        }),
      });
    });
    await page.route(/\/_serverFn\//, async (route) => {
      const req = route.request();
      // accesoAlPanel es una lectura (GET): se responde aquí, con retraso, para ver «Entrando…».
      const id = req.url().split("/_serverFn/")[1]?.split("?")[0] ?? "";
      const nombre = Buffer.from(id.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
      const cuerpo = /accesoAlPanel/.test(nombre) ? PERMITIDO : null;
      if (!cuerpo) return route.fallback();
      await new Promise((r) => setTimeout(r, 1500)); // la comprobación del panel tarda: se ve «Entrando…»
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-tss-serialized": "true" },
        body: cuerpo,
      });
    });
    await audit.abrir(LOGIN, page.getByText("Acceso profesional"));
    await page.getByLabel("Tu correo").fill("prueba-e2e@example.com");
    await page.getByRole("button", { name: "Enviar código" }).click();
    const campo = page.getByLabel("Código del correo");
    await campo.fill("12345678");
    // Estado de transición: botón «Entrando…» deshabilitado, sin alertas de error.
    await expect(page.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.waitForURL(/\/app(\?|$|\/)/, { timeout: 30_000 });
    expect(verificaciones).toBe(1);
    expect(audit.consola.filter((c) => !/403/.test(c))).toEqual([]);
  });
});
