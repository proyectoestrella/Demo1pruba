#!/usr/bin/env node
/**
 * Regenera las capturas de la «Guía de uso de la app» (public/guia/*.webp)
 * desde el panel de demostración ACTUAL, con los mismos nombres y tamaños.
 *
 * Uso (con una build servida, nunca contra producción):
 *   GUIA_BASE_URL=http://localhost:8118 node scripts/capturas-guia.mjs
 *   GUIA_SOLO=hoy-1-resumen,cita-1-boton node scripts/capturas-guia.mjs   # solo algunas
 *
 * Cada captura es un recorte de tamaño fijo (el de la imagen que sustituye)
 * pegado a la esquina del bloque que enseña. Toda escritura hacia el
 * servidor (server functions que no son GET, Supabase) se responde aquí: la
 * demo no toca datos reales. El PNG se pasa a WebP (calidad 80) con ffmpeg.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.GUIA_BASE_URL ?? "http://localhost:8118";
const SOLO = (process.env.GUIA_SOLO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(RAIZ, "public", "guia");
const TMP = mkdtempSync(path.join(tmpdir(), "guia-"));

/** Ancho de ventana para que la columna principal mida `w` (barra lateral 276 + margen 32). */
const vwPara = (w) => w + 308;

const navegador = await chromium.launch();

/**
 * PeluChic tiene el plan Básico: Caja, señal y asistente no salen en su panel.
 * Para fotografiarlos (la guía los enseña a los salones que los tienen) se
 * sube el plan de la demo SOLO en este navegador de captura.
 */
async function nuevaPagina(viewport, { plan = "todo-incluido", escala = 1 } = {}) {
  const ctx = await navegador.newContext({ viewport, locale: "es-ES", timezoneId: "Europe/Madrid", deviceScaleFactor: escala });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("trimly-tour-visto", "1");
    } catch {}
  });
  await ctx.route(/^https?:\/\/[^/]*supabase\.co(\/|$)/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.route(/\/_serverFn\//, (r) => (r.request().method() === "GET" ? r.fallback() : r.abort()));
  await ctx.route(/wa\.me|whatsapp\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo/peluchic`);
  await page.waitForURL(/\/app/, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (plan) {
    await page.evaluate((plan) => {
      const j = JSON.parse(localStorage.getItem("trimly-salon-store") ?? "null");
      if (!j?.state?.salonProfile) return;
      j.state.salonProfile.plan = plan;
      localStorage.setItem("trimly-salon-store", JSON.stringify(j));
    }, plan);
  }
  return page;
}

async function ir(page, ruta) {
  await page.goto(`${BASE}${ruta}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  // Avisos flotantes de la demo y del tour: fuera.
  await page.keyboard.press("Escape").catch(() => {});
}

/** Recorta `w`×`h` desde la esquina superior izquierda del localizador (+ desplazamiento). */
async function recortar(page, nombre, loc, wPx, hPx, { dx = 0, dy = 0, escala = 1, x: xAbs } = {}) {
  const w = Math.round(wPx / escala);
  const h = Math.round(hPx / escala);
  const el = loc.first();
  await el.waitFor({ state: "visible", timeout: 10_000 });
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  // Los avisos flotantes (sonner) taparían el recorte.
  if (nombre !== "cobrar-3-hecho") await page.addStyleTag({ content: "[data-sonner-toaster]{display:none!important}" }).catch(() => {});
  await page.waitForTimeout(400);
  let box = await el.boundingBox();
  // Si el recorte se sale por abajo, se sube el contenido con scroll.
  const vp = page.viewportSize();
  if (box.y + dy + h > vp.height) {
    await page.mouse.wheel(0, box.y + dy + h - vp.height + 4);
    await page.waitForTimeout(400);
    box = await el.boundingBox();
  }
  const x = Math.max(0, Math.round(box.x + dx));
  const y = Math.max(0, Math.round(box.y + dy));
  const png = path.join(TMP, `${nombre}.png`);
  await page.screenshot({ path: png, clip: { x: xAbs ?? Math.min(x, vp.width - w), y: Math.min(y, vp.height - h), width: w, height: h }, animations: "disabled", caret: "hide" });
  const webp = path.join(DESTINO, `${nombre}.webp`);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", png, "-vf", `scale=${wPx}:${hPx}`, "-c:v", "libwebp", "-quality", "80", "-compression_level", "6", webp]);
  console.log(`ok ${nombre} ${wPx}x${hPx} ${statSync(webp).size} B`);
}

const capturas = [];
const captura = (nombre, fn) => capturas.push({ nombre, fn });

/* ---------------------------- Hoy y confirmar ---------------------------- */
captura("hoy-1-resumen", async () => {
  const p = await nuevaPagina({ width: vwPara(1036), height: 900 });
  await ir(p, "/app");
  await recortar(p, "hoy-1-resumen", p.locator("main h1").first(), 1036, 390, { dy: -44 });
});
captura("confirmar-1-lista", async () => {
  const p = await nuevaPagina({ width: vwPara(968), height: 900 });
  await ir(p, "/app");
  const tarjeta = p.locator("section, div").filter({ has: p.getByRole("heading", { name: /Esto te espera/ }) }).last();
  await recortar(p, "confirmar-1-lista", tarjeta, 968, 312);
});
captura("confirmar-2-ventana", async () => {
  const p = await nuevaPagina({ width: 1344, height: 900 });
  await ir(p, "/app");
  await p.getByRole("button", { name: /^Confirmar · / }).first().click();
  await p.waitForTimeout(900);
  await recortar(p, "confirmar-2-ventana", p.getByRole("dialog"), 892, 490);
});
captura("movil-2-esto-espera", async () => {
  const p = await nuevaPagina({ width: 390, height: 844 });
  await ir(p, "/app");
  const tarjeta = p.locator("section, div").filter({ has: p.getByRole("heading", { name: /Esto te espera/ }) }).last();
  await recortar(p, "movil-2-esto-espera", tarjeta, 390, 530, { dx: -16 });
});
captura("movil-3-confirmar-ventana", async () => {
  const p = await nuevaPagina({ width: 390, height: 844 });
  await ir(p, "/app");
  await p.getByRole("button", { name: /^Confirmar · / }).first().click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(TMP, "m3.png") });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(TMP, "m3.png"), "-c:v", "libwebp", "-quality", "80", path.join(DESTINO, "movil-3-confirmar-ventana.webp")]);
  console.log("ok movil-3-confirmar-ventana");
});

/* ------------------------------- Nueva cita ------------------------------ */
async function abrirNuevaCita(p) {
  await p.getByRole("button", { name: /Nueva cita/ }).first().click();
  await p.waitForTimeout(900);
  return p.getByRole("dialog");
}
captura("cita-1-boton", async () => {
  const p = await nuevaPagina({ width: 1344, height: 900 });
  await ir(p, "/app");
  await recortar(p, "cita-1-boton", p.getByRole("button", { name: /Nueva cita/ }), 157, 64, { dx: -10, dy: -10 });
});
/* La «Nueva cita» de hoy es un asistente de 4 pasos: las capturas pequeñas
 * se hacen en el móvil (390) a escala 0,75–0,9 para que quepa el paso entero. */
async function pasoServicio(p, d) {
  await d.getByRole("button", { name: /Beatriz Ortega|Ortega/ }).first().click();
  await d.getByRole("button", { name: /^Continuar/ }).click();
  await p.waitForTimeout(500);
  await d.getByText("Lavado personalizado · 10 €", { exact: true }).first().click();
  await p.waitForTimeout(500);
}
captura("cita-2-clienta", async () => {
  const p = await nuevaPagina({ width: 390, height: 844 }, { escala: 0.7 });
  await ir(p, "/app");
  const d = await abrirNuevaCita(p);
  await recortar(p, "cita-2-clienta", d.getByText(/¿Para quién es la cita\?/).first(), 272, 282, { x: 0, dy: -16, escala: 0.7 });
});
captura("cita-2b-servicio", async () => {
  const p = await nuevaPagina({ width: 390, height: 844 }, { escala: 0.9 });
  await ir(p, "/app");
  const d = await abrirNuevaCita(p);
  await pasoServicio(p, d);
  await recortar(p, "cita-2b-servicio", d.getByText("Puedes elegir varios servicios").first(), 352, 282, { x: 0, dy: -12, escala: 0.9 });
});
captura("cita-3-diahora", async () => {
  const p = await nuevaPagina({ width: 390, height: 844 }, { escala: 0.9 });
  await ir(p, "/app");
  const d = await abrirNuevaCita(p);
  await pasoServicio(p, d);
  await d.getByRole("button", { name: /^Continuar/ }).click();
  await p.waitForTimeout(700);
  await recortar(p, "cita-3-diahora", d.getByText(/^Paso 3 de 4/).first(), 352, 432, { dx: -16, dy: -8, escala: 0.9 });
});
captura("cita-4-guardar", async () => {
  const p = await nuevaPagina({ width: 1344, height: 900 });
  await ir(p, "/app");
  const d = await abrirNuevaCita(p);
  await pasoServicio(p, d);
  await d.getByRole("button", { name: /^Continuar/ }).click();
  await p.waitForTimeout(700);
  // Primera hora libre del día elegido.
  await d.getByRole("button", { name: /^\d{1,2}:\d{2}$/ }).filter({ hasNot: p.locator("[disabled]") }).first().click().catch(() => {});
  await d.getByRole("button", { name: /^Continuar/ }).click().catch(() => {});
  await p.waitForTimeout(700);
  await recortar(p, "cita-4-guardar", d.getByRole("button", { name: /Guardar cita/ }), 234, 100, { dx: -12, dy: -28 });
});
captura("movil-1-nueva-cita", async () => {
  const p = await nuevaPagina({ width: 390, height: 844 });
  await ir(p, "/app");
  await abrirNuevaCita(p);
  await p.screenshot({ path: path.join(TMP, "m1.png"), clip: { x: 0, y: 0, width: 390, height: 400 } });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(TMP, "m1.png"), "-c:v", "libwebp", "-quality", "80", path.join(DESTINO, "movil-1-nueva-cita.webp")]);
  console.log("ok movil-1-nueva-cita");
});

/* ------------------------------- Calendario ------------------------------ */
captura("calendario-1-semana", async () => {
  const p = await nuevaPagina({ width: vwPara(1036), height: 900 });
  await ir(p, "/app/calendar");
  await p.getByRole("tab", { name: "Semana" }).click();
  await p.waitForTimeout(1200);
  await recortar(p, "calendario-1-semana", p.getByRole("button", { name: /^Hoy$/ }).first(), 1036, 480, { dx: -24, dy: -20 });
});

/* --------------------------------- Resto --------------------------------- */
const pantalla = (nombre, ruta, w, h, localizar, extra = {}) =>
  captura(nombre, async () => {
    const p = await nuevaPagina({ width: extra.vw ?? vwPara(w), height: extra.vh ?? 900 }, { escala: extra.escala ?? 1 });
    await ir(p, ruta);
    if (extra.antes) await extra.antes(p);
    await recortar(p, nombre, localizar(p), w, h, extra);
  });

pantalla("clientas-1-lista", "/app/clients", 1036, 420, (p) => p.locator("main h1").first(), { dy: -28 });
pantalla("espera-1-lista", "/app/waitlist", 1036, 420, (p) => p.locator("main h1").first(), { dy: -28 });
pantalla("equipo-1-lista", "/app/employees", 1036, 460, (p) => p.locator("main h1").first(), { dy: -28 });
pantalla("servicios-1-carta", "/app/services", 1036, 400, (p) => p.locator("main h1").first(), { dy: -28 });
pantalla("mipagina-1-editor", "/app/web", 1036, 460, (p) => p.locator("main h1").first(), { dy: -28 });
pantalla("caja-1-resumen", "/app/caja", 968, 157, (p) => p.getByText(/^Total cobrado/).first().locator("xpath=ancestor::*[contains(@class,'grid')][1]"), { vw: vwPara(968) });
pantalla("movil-5-caja", "/app/caja", 390, 670, (p) => p.locator("main h1").first(), { vw: 390, vh: 900, dx: -16, dy: -16 });

const cerrarDia = (p) => p.getByRole("heading", { name: /^Cerrar el día$/ }).first();
pantalla("caja-2-cerrar", "/app/caja", 300, 282, cerrarDia, { vw: 1100, vh: 1000, dx: -20, dy: -20, escala: 0.68 });
pantalla("caja-3-cuadra", "/app/caja", 300, 222, cerrarDia, {
  vw: 1100, vh: 1000, dx: -20, dy: -20, escala: 0.68,
  antes: async (p) => {
    const t = await p.getByText(/se ha\s+apuntado/).first().textContent();
    const n = /apuntado\s*([\d.,]+)/.exec(t ?? "")?.[1]?.replace(/\.(\d{3})/, "$1") ?? "0";
    await p.getByLabel(/Efectivo contado/).fill(n);
    await p.waitForTimeout(500);
  },
});

/* -------------------------------- Asistente ------------------------------- */
captura("asistente-1-respuesta", async () => {
  const p = await nuevaPagina({ width: 1344, height: 900 });
  await ir(p, "/app");
  await p.getByRole("button", { name: /Asistente/ }).first().click();
  await p.waitForTimeout(700);
  const caja = p.getByRole("textbox").last();
  await caja.fill("¿Cuántas citas tengo hoy?");
  await caja.press("Enter");
  await p.waitForTimeout(1500);
  await recortar(p, "asistente-1-respuesta", p.getByText(/^Asistente del salón$/).first(), 438, 330, { dx: -16, dy: -16 });
});

/* -------------------------- Ajustes: señal, accesos ----------------------- */
async function seccionAjustes(p, titulo) {
  const boton = p.getByRole("button", { name: new RegExp(titulo) }).first();
  await boton.scrollIntoViewIfNeeded();
  if ((await boton.getAttribute("aria-expanded")) === "false") await boton.click();
  await p.waitForTimeout(600);
}
pantalla("senal-1-activar", "/app/settings", 692, 316, (p) => p.locator("#ajuste-plantones").getByText(/^Fianza por hora de servicio$/).first(), {
  vw: 1344, dx: -16, dy: -12,
  antes: async (p) => {
    await seccionAjustes(p, "Plantones y fianza.*Penalización");
    const sw = p.locator("#ajuste-plantones").getByRole("switch").nth(1);
    if ((await sw.getAttribute("aria-checked")) === "false") await sw.click();
    const tel = p.locator("#ajuste-plantones").getByLabel(/Número de Bizum/).first();
    if (await tel.isVisible().catch(() => false)) await tel.fill("666 77 67 31");
    await p.waitForTimeout(400);
  },
});
pantalla("movil-6-senal", "/app/settings", 390, 500, (p) => p.locator("#ajuste-plantones").getByText(/^Fianza por hora de servicio$/).first(), {
  vw: 390, vh: 844, dx: -40, dy: -12,
  antes: async (p) => {
    await seccionAjustes(p, "Plantones y fianza.*Penalización");
    const sw = p.locator("#ajuste-plantones").getByRole("switch").nth(1);
    if ((await sw.getAttribute("aria-checked")) === "false") await sw.click();
    const tel = p.locator("#ajuste-plantones").getByLabel(/Número de Bizum/).first();
    if (await tel.isVisible().catch(() => false)) await tel.fill("666 77 67 31");
    await p.waitForTimeout(400);
  },
});
pantalla("equipo-2-accesos", "/app/settings", 706, 377, (p) => p.getByRole("button", { name: /^Accesos.*Quién entra/ }).first(), {
  vw: 1344, dx: -8, dy: -8, escala: 0.88,
  antes: async (p) => {
    await seccionAjustes(p, "^Accesos.*Quién entra");
  },
});
pantalla("historial-fila", "/app/settings", 692, 106, (p) => p.locator("#ajuste-historial").getByRole("button", { name: /Deshacer/ }).first().locator("xpath=ancestor::li[1] | ancestor::*[contains(@class,'rounded')][1]").last(), {
  vw: 1344, dx: -8, dy: -8,
  antes: async (p) => {
    // Un cambio de verdad en la demo para que el historial tenga una fila.
    await ir(p, "/app");
    await p.getByRole("button", { name: /^Confirmar · / }).first().click();
    await p.getByRole("dialog").getByRole("button", { name: /^Confirmar cita/ }).click();
    await p.waitForTimeout(800);
    await ir(p, "/app/settings");
    await seccionAjustes(p, "Historial de cambios.*Quién");
  },
});

/* ------------------------------ Cita: cobrar y señal ---------------------- */
async function abrirCitaDeHoy(p, fila = 1) {
  await ir(p, "/app/appointments");
  await p.locator("table tbody tr").filter({ hasNotText: /Anteriores/ }).nth(fila).click();
  await p.waitForTimeout(900);
}
captura("calendario-2-mover", async () => {
  const p = await nuevaPagina({ width: 1344, height: 900 });
  await abrirCitaDeHoy(p);
  await p.getByRole("dialog").getByRole("button", { name: /Mover/ }).click();
  await p.waitForTimeout(700);
  await recortar(p, "calendario-2-mover", p.getByRole("dialog").getByText(/^Fecha, duración y hora$/), 386, 147, { dx: -14, dy: -14 });
});
for (const [nombre, w, h] of [["senal-3-pedida", 386, 158], ["senal-4-recibida", 386, 122]]) {
  captura(nombre, async () => {
    const p = await nuevaPagina({ width: 1344, height: 900 });
    await abrirCitaDeHoy(p, 4);
    await p.getByRole("dialog").getByRole("button", { name: /Fianza/ }).click();
    await p.waitForTimeout(600);
    const pedir = p.getByRole("button", { name: /Pedir (señal|fianza)/ }).first();
    if (await pedir.isVisible().catch(() => false)) await pedir.click();
    await p.waitForTimeout(800);
    await p.keyboard.press("Escape").catch(() => {});
    if (nombre === "senal-4-recibida") {
      await p.getByRole("button", { name: /^Recibida$/ }).first().click();
      await p.waitForTimeout(800);
    }
    await recortar(p, nombre, p.getByRole("dialog").getByText(/^(Señal|Fianza)$/).first(), w, h, { dx: -8, dy: -8 });
  });
}
async function abrirCobrar(p) {
  await abrirCitaDeHoy(p);
  await p.getByRole("button", { name: /^Cobrar \d/ }).first().click();
  await p.waitForTimeout(900);
  return p.getByRole("dialog").last();
}
captura("cobrar-1-formulario", async () => {
  const p = await nuevaPagina({ width: 1344, height: 900 });
  const d = await abrirCobrar(p);
  await recortar(p, "cobrar-1-formulario", d, 464, 316);
});
captura("cobrar-2-mixto-propina", async () => {
  const p = await nuevaPagina({ width: 1344, height: 900 });
  const d = await abrirCobrar(p);
  await d.getByRole("button", { name: /Paga una parte de otra forma/ }).click();
  await p.waitForTimeout(400);
  await d.getByRole("button", { name: /^Tarjeta$/ }).last().click();
  await d.locator("input").nth(1).fill("20");
  await d.locator("input").nth(0).fill("21,50");
  await d.getByLabel(/Propina/).fill("5");
  await p.waitForTimeout(400);
  await recortar(p, "cobrar-2-mixto-propina", d, 464, 436);
});
captura("movil-4-cobrar", async () => {
  const p = await nuevaPagina({ width: 390, height: 844 });
  await abrirCitaDeHoy(p).catch(async () => {
    await p.locator("main a, main [role=button]").filter({ hasText: /\d\d:\d\d/ }).first().click();
  });
  await p.getByRole("button", { name: /^Cobrar \d/ }).first().click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(TMP, "m4.png"), clip: { x: 0, y: 0, width: 390, height: 610 } });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(TMP, "m4.png"), "-c:v", "libwebp", "-quality", "80", path.join(DESTINO, "movil-4-cobrar.webp")]);
  console.log("ok movil-4-cobrar");
});
for (const [nombre, w, h] of [["cobrar-3-hecho", 357, 70], ["cobrar-4-desglose", 386, 144]]) {
  captura(nombre, async () => {
    const p = await nuevaPagina({ width: 1344, height: 900 });
    const d = await abrirCobrar(p);
    await d.getByRole("button", { name: /Paga una parte de otra forma/ }).click();
    await d.getByRole("button", { name: /^Tarjeta$/ }).last().click();
    await d.locator("input").nth(1).fill("20");
    await d.locator("input").nth(0).fill("21,50");
    await d.getByLabel(/Propina/).fill("5");
    await d.getByRole("button", { name: /^Cobrar \d/ }).click();
    await p.waitForTimeout(700);
    if (nombre === "cobrar-3-hecho") {
      await recortar(p, nombre, p.locator("[data-sonner-toast]").first(), w, h);
    } else {
      await p.getByRole("dialog").getByRole("button", { name: /^Cobro/ }).first().click().catch(() => {});
      await p.waitForTimeout(500);
      await recortar(p, nombre, p.getByRole("dialog").getByText(/^Cobro$/).first(), w, h, { dx: -16, dy: -12 });
    }
  });
}

/* ------------------------------ Web pública ------------------------------- */
pantalla("web-1-hero", "/s/peluchic", 1280, 560, (p) => p.locator("body"), { vw: 1280, vh: 800 });

let fallos = 0;
for (const c of capturas) {
  if (SOLO.length && !SOLO.includes(c.nombre)) continue;
  try {
    await c.fn();
  } catch (e) {
    fallos++;
    console.log(`FALLO ${c.nombre}: ${String(e.message ?? e).split("\n")[0]}`);
  }
}
await navegador.close();
rmSync(TMP, { recursive: true, force: true });
process.exit(fallos ? 1 : 0);
