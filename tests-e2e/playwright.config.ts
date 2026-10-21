/**
 * Batería e2e de usabilidad (Playwright). Se lanza con `bun run e2e`.
 *
 * - Necesita el servidor de desarrollo ya levantado (por defecto
 *   http://127.0.0.1:8094; se cambia con E2E_BASE_URL). No lo arranca ni lo para.
 * - Nunca escribe en la base de datos real: ver fixtures.ts (intercepta
 *   *.supabase.co y toda server function que no sea de lectura).
 * - Usa el Chrome/Chromium del sistema si existe (E2E_CHROME para forzar otro);
 *   si no, el Chromium que descargue `npx playwright install chromium`.
 * - Los archivos se llaman *.e2e.ts a propósito: `bun test` no los recoge.
 */
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8094";
const executablePath =
  process.env.E2E_CHROME ??
  ["/usr/bin/google-chrome", "/usr/bin/chromium", "/snap/bin/chromium"].find((p) => existsSync(p));

const { defaultBrowserType: _ignorado, ...iphone } = devices["iPhone 13"];

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.e2e\.ts$/,
  outputDir: "./test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [["list"], ["./reporter-informe.ts"]],
  use: {
    baseURL,
    actionTimeout: 10_000,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : {},
  },
  projects: [
    { name: "movil", use: { ...iphone, browserName: "chromium" } },
    {
      name: "escritorio",
      use: { browserName: "chromium", viewport: { width: 1366, height: 900 } },
    },
  ],
});
