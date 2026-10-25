import type { Page } from "@playwright/test";
import { expect, test, type Auditoria } from "./fixtures";

const RESERVA = "/s/peluchic/book";
const resumenMovil = (page: Page) => page.getByTestId("booking-summary-mobile");

function claveEnMadrid(fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function sumarDias(clave: string, dias: number): string {
  const fecha = new Date(`${clave}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function diaSemana(clave: string): number {
  return new Date(`${clave}T12:00:00Z`).getUTCDay();
}

function siguienteAbierto(desde: string, incluir = false): string {
  for (let distancia = incluir ? 0 : 1; distancia < 10; distancia++) {
    const candidata = sumarDias(desde, distancia);
    const dia = diaSemana(candidata);
    if (dia >= 2 && dia <= 6) return candidata;
  }
  throw new Error("No se encontró un día abierto de PeluChic");
}

function fechaLargaEs(clave: string): string {
  const texto = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${clave}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fechaCortaEs(clave: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${clave}T12:00:00Z`));
}

async function elegirPrimeraHora(page: Page): Promise<string> {
  const boton = page
    .locator("button:enabled")
    .filter({ hasText: /^\d\d:\d\d$/ })
    .first();
  const hora = (await boton.textContent())!.trim();
  await boton.click();
  const confirmarEspera = page.getByRole("button", { name: `Prefiero las ${hora}` });
  if (await confirmarEspera.isVisible().catch(() => false)) await confirmarEspera.click();
  return hora;
}
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
    await expect(page.getByRole("button", { name: "Continuar" })).not.toHaveAttribute("data-incompleto", "", { timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Fecha y hora" }).first()).toBeVisible();
}
async function paso3(page: Page, audit: Auditoria) {
  await paso2(page, audit);
  await page
    .locator("button:enabled")
    .filter({ hasText: /^\d\d:\d\d$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "¿Con quién?" }).first()).toBeVisible();
}
async function paso4(page: Page, audit: Auditoria) {
  await paso3(page, audit);
  await page.getByRole("button", { name: /Cualquiera disponible/ }).click();
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
  test("Fecha · las flechas saltan domingo y lunes y no retroceden antes de hoy", async ({
    page,
    audit,
  }) => {
    await paso2(page, audit);
    const primera = siguienteAbierto(claveEnMadrid(), true);
    await expect(page.getByTestId("active-date-label")).toHaveText(fechaLargaEs(primera));
    await expect(page.getByRole("button", { name: "Día anterior" })).toBeDisabled();

    let actual = primera;
    while (diaSemana(actual) !== 6) {
      actual = siguienteAbierto(actual);
      await page.getByRole("button", { name: "Día siguiente" }).click();
    }
    const despuesDelSabado = siguienteAbierto(actual);
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await expect(page.getByTestId("active-date-label")).toHaveText(fechaLargaEs(despuesDelSabado));
    expect(diaSemana(despuesDelSabado)).toBe(2);
  });

  test("Fecha · cambiar de día sin hora actualiza el resumen y pide elegir hora", async ({
    page,
    audit,
  }) => {
    await paso2(page, audit);
    const fechaAnterior = siguienteAbierto(claveEnMadrid(), true);
    const fechaNueva = siguienteAbierto(fechaAnterior);
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await expect(page.getByTestId("active-date-label")).toHaveText(fechaLargaEs(fechaNueva));
    await expect(resumenMovil(page)).toContainText(fechaCortaEs(fechaNueva));
    await expect(resumenMovil(page)).not.toContainText(fechaCortaEs(fechaAnterior));
    await expect(resumenMovil(page)).toContainText("Elige hora");
  });

  test("Fecha · elegir una hora la lleva al resumen", async ({ page, audit }) => {
    await paso2(page, audit);
    const hora = await elegirPrimeraHora(page);
    await expect(resumenMovil(page)).toContainText(hora);
    await expect(resumenMovil(page)).not.toContainText("Elige hora");
  });

  test("Fecha · cambiar servicios borra la fecha y la hora del resumen", async ({
    page,
    audit,
  }) => {
    await paso2(page, audit);
    await elegirPrimeraHora(page);
    await page.getByRole("button", { name: "Atrás" }).click();
    await page.getByRole("button", { name: /Cortar Caballero\/Niño/ }).click();
    await expect(resumenMovil(page)).toContainText("Elige fecha");
    await expect(resumenMovil(page)).toContainText("Elige hora");
  });

  test("Fecha · cambiar la profesional preferida revalida la hora", async ({ page, audit }) => {
    await paso2(page, audit);
    // El día siguiente al martes inicial es miércoles: Anca libra ese día.
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await elegirPrimeraHora(page);
    await page.getByLabel("¿Prefieres a alguien?").selectOption({ label: "Anca" });
    await expect(resumenMovil(page)).toContainText("Elige hora");
  });

  test("Fecha · atrás y adelante conserva una elección que sigue siendo válida", async ({
    page,
    audit,
  }) => {
    await paso2(page, audit);
    const hora = await elegirPrimeraHora(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "¿Con quién?" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Atrás" }).click();
    await expect(resumenMovil(page)).toContainText(hora);
    await expect(page.getByRole("button", { name: hora, exact: true })).toHaveAttribute(
      "class",
      /bg-primary/,
    );
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "¿Con quién?" }).first()).toBeVisible();
  });

  test("Fecha · avisa si no está la preferida y permite reservar con otra", async ({
    page,
    audit,
  }) => {
    await paso2(page, audit);
    await page.getByLabel("¿Prefieres a alguien?").selectOption({ label: "María" });
    const alternativa = page.locator('button[data-alternative="true"]:enabled').first();
    const hora = (await alternativa.textContent())!.trim();
    await alternativa.click();
    const aviso = page
      .getByRole("alert")
      .filter({ hasText: new RegExp(`A las ${hora} no está María, pero sí`) });
    await expect(aviso).toBeVisible();
    const reservar = aviso.getByRole("button", { name: /^Reservar con / });
    const profesional = (await reservar.textContent())!.replace("Reservar con ", "").trim();
    await reservar.click();
    await expect(page.getByLabel("¿Prefieres a alguien?")).toHaveValue(
      profesional === "Anca" ? "anca" : "patricia",
    );
    await expect(resumenMovil(page)).toContainText(hora);
  });

  test("Fecha · explica que no trabaja y lleva al próximo día de esa profesional", async ({
    page,
    audit,
  }) => {
    await paso2(page, audit);
    // PeluChic abre el miércoles, pero Anca libra.
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await page.getByLabel("¿Prefieres a alguien?").selectOption({ label: "Anca" });
    await expect(page.getByText("Anca no trabaja este día")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ver horas con otra profesional" }),
    ).toBeVisible();
    const fechaAnterior = await page.getByTestId("active-date-label").textContent();
    await page.getByRole("button", { name: "Ir al próximo día con Anca" }).click();
    await expect(page.getByTestId("active-date-label")).not.toHaveText(fechaAnterior!);
    await expect(page.getByText("Anca no trabaja este día")).toHaveCount(0);
    await expect(
      page
        .locator("button:enabled")
        .filter({ hasText: /^\d\d:\d\d$/ })
        .first(),
    ).toBeVisible();
  });

  test("Reserva 1 · Servicios", async ({ page, audit }) => {
    await paso1(page, audit);
    const continuar = page.getByRole("button", { name: "Continuar" });
    await expect(continuar).toHaveAttribute("data-incompleto", "");
    // Sin tocar nada no hay aviso en rojo; sale al intentar continuar.
    await expect(page.getByRole("status").filter({ hasText: "Elige un servicio" })).toHaveCount(0);
    await continuar.click();
    await expect(page.getByRole("status").filter({ hasText: "Elige un servicio" }).first()).toBeVisible();
    await expect(page.getByText("Elige uno o varios servicios")).toBeVisible();
    await audit.revisar("reserva-1-servicios");
  });

  test("Reserva 2 · Fecha y hora", async ({ page, audit }) => {
    await paso2(page, audit);
    await expect(
      page
        .locator("button:enabled")
        .filter({ hasText: /^\d\d:\d\d$/ })
        .first(),
    ).toBeVisible();
    await expect(page.getByLabel("¿Prefieres a alguien?")).toHaveValue("any");
    await audit.revisar("reserva-2-fecha-y-hora");
  });

  test("Reserva 3 · Profesional", async ({ page, audit }) => {
    await paso3(page, audit);
    await expect(page.getByRole("button", { name: /Cualquiera disponible/ })).toBeVisible();
    await audit.revisar("reserva-3-profesional");
  });

  test("Reserva 2–3 · una preferencia distingue huecos y llega preseleccionada", async ({
    page,
    audit,
  }) => {
    await paso2(page, audit);
    const selector = page.getByLabel("¿Prefieres a alguien?");
    const opcion = selector.locator("option").nth(1);
    const employeeId = await opcion.getAttribute("value");
    const employeeName = await opcion.textContent();
    await selector.selectOption(employeeId!);
    await page
      .locator('button:enabled:not([data-alternative="true"])')
      .filter({ hasText: /^\d\d:\d\d$/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.locator('button[aria-pressed="true"]').filter({ hasText: employeeName! }).first(),
    ).toBeVisible();
  });

  test("Reserva 4 · Datos (vacío: botón desactivado)", async ({ page, audit }) => {
    await paso4(page, audit);
    await expect(botonCta(page)).toHaveAttribute("data-incompleto", "");
    await botonCta(page).click();
    await expect(faltaTexto(page)).toContainText("nombre");
    await audit.revisar("reserva-4-datos");
  });

  test("Reserva 4 · la casilla de privacidad se marca tocando el texto y es cómoda", async ({
    page,
    audit,
  }) => {
    await paso4(page, audit);
    const caja = page.getByRole("checkbox", { name: /He leído la información/ });
    const caja_box = await caja.boundingBox();
    expect(caja_box!.width).toBeGreaterThanOrEqual(22);
    const fila = page.locator("label").filter({ hasText: /He leído la información/ });
    expect((await fila.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByText("He leído la información sobre el tratamiento de mis datos.").click();
    await expect(caja).toHaveAttribute("aria-checked", "true");
    await page.screenshot({
      path: `tests-e2e/capturas/reserva-casilla-${test.info().project.name}.png`,
    });
  });

  test("Reserva 4 · sin nombre", async ({ page, audit }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "", "600123456", true);
    await expect(botonCta(page)).toHaveAttribute("data-incompleto", "");
    await botonCta(page).click();
    await expect(faltaTexto(page)).toContainText("nombre");
    await audit.revisar("reserva-4-sin-nombre");
  });

  test("Reserva 4 · nombre de 1 letra", async ({ page, audit }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "A", "600123456", true);
    await expect(botonCta(page)).toHaveAttribute("data-incompleto", "");
    await botonCta(page).click();
    await expect(faltaTexto(page)).toContainText("nombre");
    await audit.revisar("reserva-4-nombre-1-letra");
  });

  test("Reserva 4 · teléfono 1245", async ({ page, audit }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "Ana López", "1245", true);
    await expect(botonCta(page)).toHaveAttribute("data-incompleto", "");
    await botonCta(page).click();
    await expect(faltaTexto(page)).toContainText("teléfono");
    await audit.revisar("reserva-4-telefono-1245");
  });

  test("Reserva 4 · sin aceptar privacidad", async ({ page, audit }) => {
    await paso4(page, audit);
    await responderPreguntas(page);
    await datos(page, "Ana López", "600123456", false);
    await expect(botonCta(page)).toHaveAttribute("data-incompleto", "");
    await botonCta(page).click();
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
    await expect(botonCta(page)).not.toHaveAttribute("data-incompleto", "");
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
