import { writeFileSync } from "node:fs";
import path from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

type Fila = {
  pantalla: string;
  proyecto: string;
  estado: string;
  avisos: string[];
  fallos: string[];
  error?: string;
};

/** Escribe tests-e2e/ULTIMO-INFORME.md al terminar cada ejecución. */
export default class InformeMarkdown implements Reporter {
  private filas: Fila[] = [];
  private inicio = Date.now();

  onTestEnd(test: TestCase, result: TestResult) {
    const proyecto = test.parent.project()?.name ?? "?";
    const esperadoFallo = test.expectedStatus === "failed";
    let estado: string;
    if (result.status === "skipped") estado = "omitida";
    else if (esperadoFallo && result.status === "failed")
      estado = "FALLO REAL DE LA APP (test.fail)";
    else if (esperadoFallo && result.status === "passed")
      estado = "INESPERADO: ya pasa (quitar test.fail)";
    else estado = result.status === "passed" ? "pasa" : "FALLA";
    const anot = [
      ...new Map(
        [...test.annotations, ...result.annotations].map((a) => [`${a.type}|${a.description}`, a]),
      ).values(),
    ];
    this.filas.push({
      pantalla: test.title,
      proyecto,
      estado,
      avisos: anot.filter((a) => a.type === "aviso").map((a) => a.description ?? ""),
      fallos: anot.filter((a) => a.type === "fallo-app").map((a) => a.description ?? ""),
      error:
        result.status === "failed" && !esperadoFallo
          ? result.error?.message
              ?.split("\n")
              .slice(0, 4)
              .join(" ")
              .replace(/\u001b\[[0-9;]*m/g, "")
          : undefined,
    });
  }

  onEnd(result: FullResult) {
    const f = this.filas.sort(
      (a, b) => a.proyecto.localeCompare(b.proyecto) || a.pantalla.localeCompare(b.pantalla),
    );
    const cuenta = (e: (s: string) => boolean) => f.filter((x) => e(x.estado)).length;
    const l: string[] = [];
    l.push("# Último informe e2e de usabilidad", "");
    l.push(
      `Ejecución: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} · ${((Date.now() - this.inicio) / 1000).toFixed(0)} s · resultado global: ${result.status}`,
      "",
    );
    l.push(`- Pasan: ${cuenta((s) => s === "pasa")}`);
    l.push(`- Fallan: ${cuenta((s) => s === "FALLA")}`);
    l.push(
      `- Fallos reales de la app anotados (test.fail): ${cuenta((s) => s.startsWith("FALLO REAL"))}`,
    );
    l.push(`- Pantallas con avisos: ${f.filter((x) => x.avisos.length).length}`, "");
    for (const proyecto of [...new Set(f.map((x) => x.proyecto))]) {
      l.push(`## ${proyecto}`, "", "| Pantalla | Estado | Avisos |", "|---|---|---|");
      for (const x of f.filter((y) => y.proyecto === proyecto)) {
        const av = [
          ...x.fallos.map((t) => `FALLO APP: ${t}`),
          ...x.avisos,
          ...(x.error ? [`ERROR: ${x.error}`] : []),
        ]
          .map((t) => t.replace(/\|/g, "\\|").replace(/\n/g, " "))
          .join("<br>");
        l.push(`| ${x.pantalla} | ${x.estado} | ${av || "—"} |`);
      }
      l.push("");
    }
    l.push(
      "Capturas completas: `tests-e2e/capturas/<proyecto>/<pantalla>.png` (no se versionan).",
      "",
    );
    writeFileSync(path.join(import.meta.dirname, "ULTIMO-INFORME.md"), l.join("\n"));
  }
}
