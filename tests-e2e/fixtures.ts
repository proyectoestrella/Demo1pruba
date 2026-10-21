import { mkdirSync } from "node:fs";
import path from "node:path";
import { test as base, expect, type Page, type TestInfo } from "@playwright/test";

/* ------------------------------------------------------------------ *
 * Red: NADA sale hacia la base de datos real.
 *  - Todo *.supabase.co se responde aquí (jamás llega a internet).
 *  - Toda server function que no sea GET (las de lectura son GET) se
 *    responde aquí con un resultado simulado.
 * ------------------------------------------------------------------ */

const seroval = (valor: string) =>
  JSON.stringify({
    t: 10,
    i: 0,
    p: {
      k: ["result", "error", "context"],
      v: [
        valor === "true"
          ? { t: 10, i: 1, p: { k: ["synced"], v: [{ t: 2, s: 2 }] }, o: 0 }
          : { t: 2, s: 1 },
        { t: 2, s: 1 },
        { t: 11, i: 2, p: { k: [], v: [] }, o: 0 },
      ],
    },
    o: 0,
  });

function nombreDeServerFn(url: string): string {
  try {
    const id = new URL(url).pathname.split("/_serverFn/")[1] ?? "";
    const json = JSON.parse(
      Buffer.from(id.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
    );
    return String(json.export ?? json.file ?? "desconocida");
  } catch {
    return "desconocida";
  }
}

export type Bloqueo = { metodo: string; destino: string };

/** Ruido de terceros que no es un fallo de la app (fuentes, mapas, vídeo, etc.). */
const CONSOLA_IGNORADA = [
  /Failed to load resource.*(fonts\.g|googleapis|gstatic|facebook|instagram|youtube|googletagmanager|google-analytics|maps)/i,
  /fonts\.(googleapis|gstatic)\.com/i,
  /net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|BLOCKED_BY_CLIENT|ABORTED|FAILED)/i,
  /\[vite\]/i,
  /Download the React DevTools/i,
];

export type Auditoria = {
  /** Abre una ruta y espera a que aparezca el marcador. Devuelve ms hasta el contenido. */
  abrir: (ruta: string, marcador: ReturnType<Page["locator"]>) => Promise<number>;
  /** Revisa la pantalla actual y guarda captura. `nombre` = pantalla. */
  revisar: (nombre: string, opciones?: { sinCaptura?: boolean }) => Promise<void>;
  bloqueos: Bloqueo[];
  /** Ignora un error de consola que la propia prueba provoca a propósito. */
  ignorar: (patron: RegExp) => void;
  consola: string[];
  /** Instante (ms) en que empezó el último `abrir`. */
  ultimaCarga: { ms: number };
};

function aviso(testInfo: TestInfo, texto: string) {
  testInfo.annotations.push({ type: "aviso", description: texto });
}
export function falloApp(testInfo: TestInfo, texto: string) {
  testInfo.annotations.push({ type: "fallo-app", description: texto });
}

export const test = base.extend<{ audit: Auditoria }>({
  context: async ({ context }, use) => {
    await context.route(/^https?:\/\/[^/]*supabase\.co(\/|$)/, async (route) => {
      const req = route.request();
      const url = req.url();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (/\/auth\/v1\/otp/.test(url))
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      if (/\/auth\/v1\/verify/.test(url))
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            code: 403,
            error_code: "otp_expired",
            msg: "Token has expired or is invalid",
          }),
        });
      if (req.method() === "GET")
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await use(context);
  },

  audit: async ({ page, context }, use, testInfo) => {
    const bloqueos: Bloqueo[] = [];
    const consola: string[] = [];
    const ultimaCarga = { ms: 0 };
    const propios: RegExp[] = [];

    await context.route(/\/_serverFn\//, async (route) => {
      const req = route.request();
      if (req.method() === "GET") return route.fallback();
      const nombre = nombreDeServerFn(req.url());
      bloqueos.push({ metodo: req.method(), destino: nombre });
      // syncAppointment devuelve {synced:true}; el resto, un resultado vacío.
      const body = /syncAppointment/i.test(nombre) ? seroval("true") : seroval("vacio");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-tss-serialized": "true" },
        body,
      });
    });

    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      if (CONSOLA_IGNORADA.some((r) => r.test(t)) || propios.some((r) => r.test(t))) return;
      consola.push(t.slice(0, 300));
    });
    page.on("pageerror", (e) => consola.push(`pageerror: ${e.message}`.slice(0, 300)));

    const abrir: Auditoria["abrir"] = async (ruta, marcador) => {
      const t0 = Date.now();
      await page.goto(ruta);
      await marcador.first().waitFor({ state: "visible", timeout: 30_000 });
      // El HTML llega antes que React: un clic anterior a la hidratación se pierde.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      ultimaCarga.ms = Date.now() - t0;
      return ultimaCarga.ms;
    };

    const revisar: Auditoria["revisar"] = async (nombre, opciones) => {
      await page.waitForTimeout(400); // deja asentar animaciones
      const esMovil = !!testInfo.project.use.isMobile;

      // Tiempo hasta contenido
      if (ultimaCarga.ms > 3000)
        aviso(
          testInfo,
          `Tardó ${(ultimaCarga.ms / 1000).toFixed(1)} s hasta mostrar contenido (>3 s)`,
        );

      // Captura completa
      if (!opciones?.sinCaptura) {
        const dir = path.join(import.meta.dirname, "capturas", testInfo.project.name);
        mkdirSync(dir, { recursive: true });
        const archivo = nombre
          .replace(/[^a-z0-9áéíóúñü]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase();
        await page.screenshot({ path: path.join(dir, `${archivo}.png`), fullPage: true });
      }

      // Scroll horizontal (fallo solo en móvil)
      const medidas = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }));
      if (esMovil) {
        expect(
          medidas.sw,
          `Scroll horizontal en móvil (scrollWidth ${medidas.sw} > innerWidth ${medidas.iw})`,
        ).toBeLessThanOrEqual(medidas.iw);
      } else if (medidas.sw > medidas.iw) {
        aviso(
          testInfo,
          `Scroll horizontal en escritorio (scrollWidth ${medidas.sw} > ${medidas.iw})`,
        );
      }

      // Botones visibles sin nombre accesible
      const sinNombre = await page.evaluate(() => {
        const visible = (e: Element) => {
          const r = (e as HTMLElement).getBoundingClientRect();
          const s = getComputedStyle(e as HTMLElement);
          return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
        };
        const nombreDe = (e: HTMLElement) => {
          if (e.getAttribute("aria-label")?.trim()) return true;
          const lb = e.getAttribute("aria-labelledby");
          if (lb && lb.split(" ").some((id) => document.getElementById(id)?.textContent?.trim()))
            return true;
          if (e.innerText?.trim() || e.textContent?.trim()) return true;
          if (e.getAttribute("title")?.trim()) return true;
          return [...e.querySelectorAll("img[alt]")].some((i) =>
            (i as HTMLImageElement).alt.trim(),
          );
        };
        return [...document.querySelectorAll<HTMLElement>("button, [role=button]")]
          .filter(visible)
          .filter((e) => !nombreDe(e))
          .map((e) => (e.outerHTML.slice(0, 110) + "").replace(/\s+/g, " "));
      });
      expect(sinNombre, `Botones visibles sin nombre accesible:\n${sinNombre.join("\n")}`).toEqual(
        [],
      );

      // Objetivos táctiles < 44 px (aviso, solo móvil)
      if (esMovil) {
        const pequenos = await page.evaluate(() => {
          const out: string[] = [];
          for (const e of document.querySelectorAll<HTMLElement>(
            "button, a[href], [role=button], input:not([type=hidden]), select, textarea, [role=checkbox]",
          )) {
            const r = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            if (
              r.width === 0 ||
              r.height === 0 ||
              s.visibility === "hidden" ||
              s.display === "none"
            )
              continue;
            if (r.width < 44 || r.height < 44) {
              const nombre = (
                e.getAttribute("aria-label") ||
                e.innerText ||
                e.getAttribute("placeholder") ||
                e.tagName
              )
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 30);
              out.push(`${nombre} (${Math.round(r.width)}x${Math.round(r.height)})`);
            }
          }
          return out;
        });
        if (pequenos.length)
          aviso(
            testInfo,
            `${pequenos.length} objetivos táctiles <44 px: ${pequenos.slice(0, 6).join("; ")}${pequenos.length > 6 ? "…" : ""}`,
          );
      }

      // Consola
      if (consola.length) {
        aviso(
          testInfo,
          `Errores de consola (${consola.length}): ${consola.slice(0, 3).join(" || ")}`,
        );
      }
      expect(consola, `Errores de consola en «${nombre}»`).toEqual([]);

      // Escrituras remotas interceptadas (informativo)
      if (bloqueos.length)
        aviso(
          testInfo,
          `Escrituras remotas interceptadas y simuladas: ${[...new Set(bloqueos.map((b) => b.destino))].join(", ")}`,
        );
    };

    await use({ abrir, revisar, bloqueos, consola, ultimaCarga, ignorar: (r) => propios.push(r) });
  },
});

export { expect };

/** Panel demo: entra por /demo/peluchic (redirige a /app con datos locales). */
export async function entrarAlPanel(page: Page, audit: Auditoria) {
  await audit.abrir("/demo/peluchic", page.getByText(/Citas de hoy/).first());
}

/**
 * El servidor de desarrollo no trae VITE_SUPABASE_* (el login diría «acceso no
 * configurado»). Para probar el flujo correo → código se sirve el módulo del
 * cliente con una URL de mentira; todo lo que salga hacia ella lo atiende el
 * mock de *.supabase.co de este archivo, nunca internet.
 */
export async function simularAuthConfigurada(page: Page) {
  await page.route(/\/src\/lib\/supabase-browser\.ts/, async (route) => {
    const resp = await route.fetch();
    const cuerpo = (await resp.text())
      .replace("import.meta.env.VITE_SUPABASE_URL;", '"https://e2e-simulado.supabase.co";')
      .replace("import.meta.env.VITE_SUPABASE_ANON_KEY;", '"e2e-clave-falsa";');
    await route.fulfill({ response: resp, body: cuerpo });
  });
}
