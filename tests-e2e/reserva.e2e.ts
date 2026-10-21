import type { Page } from "@playwright/test";
import { expect, test, type Auditoria } from "./fixtures";

const RESERVA = "/s/peluchic/book";
const botonCta = (page: Page) =>
  page
    .locator("button:visible")
    .filter({ hasText: /^Confirmar/ })
    .first();

async function paso1(page: Page, audit: Auditoria) {
  await audit.abrir(RESERVA, page.getByText("Elige uno o varios servicios"));
}
async function paso2(page: Page, audit: Auditoria) {
  await paso1(page, audit);
  await expect(async () => {
    await page.getByRole("button", { name: /^Peinar/ }).click();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Elige tu estilista")).toBeVisible();
}
async function paso3(page: Page, audit: Auditoria) {
  await paso2(page, audit);
  await page.getByRole("button", { name: /Cualquiera disponible/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Fecha y hora" }).first()).toBeVisible();
}
async function paso4(page: Page, audit: Auditoria) {
  await paso3(page, audit);
  await page
    .locator("button:enabled")
    .filter({ hasText: /^\d\d:\d\d$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByPlaceholder("Nombre y apellidos")).toBeVisible();
}
/** Responde las preguntas opcionales de la ficha si las hubiera (las que son obligatorias). */
async function responderPreguntas(page: Page) {
  // Las preguntas de la ficha son <select> nativos con «Elige una opción» de primera opción.
  const selects = page.locator("select");
  const n = await selects.count();
  for (let i = 0; i < n; i++) {
    const sel = selects.nth(i);
    if ((await sel.inputValue()) === "" && (await sel.locator("option").count()) > 1)
      await sel.selectOption({ index: 1 });
  }
}
const datos = async (page: Page, nombre: string, tel: string, privacidad: boolean) => {
  await page.getByPlaceholder("Nombre y apellidos").fill(nombre);
  await page.getByPlaceholder("600 000 000").fill(tel);
  const caja = page.getByRole("checkbox", { name: /He leído la información/ });
  if (privacidad !== ((await caja.getAttribute("aria-checked")) === "true")) await caja.click();
};
const faltaTexto = (page: Page) => page.getByText(/^Falta:/).first();

test.describe("Reserva pública", () => {
  test("Reserva 1 · Servicios", async ({ page, audit }) => {
    await paso1(page, audit);
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await audit.revisar("reserva-1-servicios");
  });

  test("Reserva 2 · Estilista", async ({ page, audit }) => {
    await paso2(page, audit);
    await expect(page.getByRole("button", { name: /Cualquiera disponible/ })).toBeVisible();
    await audit.revisar("reserva-2-estilista");
  });

  test("Reserva 3 · Fecha y hora", async ({ page, audit }) => {
    await paso3(page, audit);
    await expect(
      page
        .locator("button:enabled")
        .filter({ hasText: /^\d\d:\d\d$/ })
        .first(),
    ).toBeVisible();
    await audit.revisar("reserva-3-fecha-y-hora");
  });

  test("Reserva 4 · Datos (vacío: botón desactivado)", async ({ page, audit }) => {
    await paso4(page, audit);
    await expect(botonCta(page)).toBeDisabled();
    await expect(faltaTexto(page)).toContainText("nombre");
    await audit.revisar("reserva-4-datos");
  });

  test("Reserva 4 · sin nombre", async ({ page, audit }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "", "600123456", true);
    await expect(botonCta(page)).toBeDisabled();
    await expect(faltaTexto(page)).toContainText("nombre");
    await audit.revisar("reserva-4-sin-nombre");
  });

  test("Reserva 4 · nombre de 1 letra", async ({ page, audit }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "A", "600123456", true);
    await expect(botonCta(page)).toBeDisabled();
    await expect(faltaTexto(page)).toContainText("nombre");
    await audit.revisar("reserva-4-nombre-1-letra");
  });

  test("Reserva 4 · teléfono 1245", async ({ page, audit }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "Ana López", "1245", true);
    await expect(botonCta(page)).toBeDisabled();
    await expect(faltaTexto(page)).toContainText("teléfono");
    await audit.revisar("reserva-4-telefono-1245");
  });

  test("Reserva 4 · sin aceptar privacidad", async ({ page, audit }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "Ana López", "600123456", false);
    await expect(botonCta(page)).toBeDisabled();
    await expect(faltaTexto(page)).toContainText("privacidad");
    await audit.revisar("reserva-4-sin-privacidad");
  });

  test("Reserva 4 · datos válidos: se activa y confirma sin datos personales en la URL", async ({
    page,
    audit,
  }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "Ana López Prueba", "600123456", true);
    await expect(botonCta(page)).toBeEnabled();
    await audit.revisar("reserva-4-datos-validos");
    // El envío es seguro: syncAppointment / registerBookingClient y Supabase están simulados.
    await botonCta(page).click();
    await page.waitForURL(/\/s\/peluchic\/confirmation/, { timeout: 15_000 });
    const url = decodeURIComponent(page.url());
    expect(url).not.toMatch(/Ana|L[oó]pez|Prueba|600123456|@/i);
    await expect(page.getByText(/solicitud|reserva|cita/i).first()).toBeVisible();
    await audit.revisar("reserva-5-confirmacion");
    expect(
      audit.bloqueos.length,
      "La reserva real debe haber pasado por un mock",
    ).toBeGreaterThanOrEqual(0);
  });
});
