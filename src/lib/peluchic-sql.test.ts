import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMenuEntry } from "./business-type";
import { PELUCHIC } from "./demos/peluchic";
import { generarSeed, generarUpdate, perfilProduccion } from "../../scripts/generar-sql-peluchic";

const SUPABASE = join(import.meta.dir, "..", "..", "supabase");
const leer = (f: string) => readFileSync(join(SUPABASE, f), "utf8");

function perfilDelSql(sql: string): any {
  const m = sql.match(/\$perfil\$([\s\S]*?)\$perfil\$/);
  if (!m) throw new Error("sin literal $perfil$");
  return JSON.parse(m[1]);
}

describe("SQL de PeluChic generado desde la demo", () => {
  test("seed y update del repo son idénticos a lo que genera la demo (si falla: bun scripts/generar-sql-peluchic.ts)", () => {
    expect(leer("seed-peluchic.sql")).toBe(generarSeed());
    expect(leer("update-peluchic.sql")).toBe(generarUpdate());
  });

  test("el JSON del SQL es el perfil de producción de la demo", () => {
    for (const f of ["seed-peluchic.sql", "update-peluchic.sql"]) {
      expect(perfilDelSql(leer(f))).toEqual(JSON.parse(JSON.stringify(perfilProduccion())));
    }
  });

  test("producción: plan reservas, sin rating inventado, sin datos de demo", () => {
    const p = perfilDelSql(leer("seed-peluchic.sql"));
    expect(p.plan).toBe("reservas");
    expect(p.rating).toBe(0);
    expect(p.reviewCount).toBe(0);
    expect(p.photoCount).toBeUndefined();
    expect(p.depositEnabled).toBe(true);
    expect(p.depositMode).toBe("hora");
    expect(p.depositHourlyRateEur).toBe(5);
    expect(p.depositDeadlineHours).toBe(4);
    expect(p.depositAutoRelease).toBe(false);
    expect(p.bloqueosAgenda).toHaveLength(3);
    expect(p.bloqueosAgenda.map((b: { profesionalId: string }) => b.profesionalId)).toEqual(["maria", "anca", "patricia"]);
    expect(JSON.stringify(p.diasEspeciales)).not.toContain("nota");
  });

  test("la carta, leída con parseMenuEntry, da los 55 ids de la demo", () => {
    const p = perfilDelSql(leer("seed-peluchic.sql"));
    const ids = p.menu.map((e: string) => parseMenuEntry(e)?.id);
    const demo = PELUCHIC.menu!.map((e) => parseMenuEntry(e)?.id);
    expect(ids).toHaveLength(55);
    expect(new Set(ids).size).toBe(55);
    expect(ids).toEqual(demo);
    expect(ids.every(Boolean)).toBe(true);
  });

  test("todas las referencias apuntan a ids existentes", () => {
    const p = perfilDelSql(leer("seed-peluchic.sql"));
    const ids = new Set<string>(p.menu.map((e: string) => parseMenuEntry(e)!.id));
    const refs: string[] = [
      ...Object.values<string[]>(p.serviciosPorProfesional).flat(),
      ...p.preguntasReserva.flatMap((q: any) => q.servicios ?? []),
      ...Object.keys(p.preciosLiterales),
      ...Object.keys(p.descripcionesServicios),
      ...p.destacados,
      "exosomas", "dermapen-facial", "dermapen-corporal",
    ];
    const rotas = refs.filter((r) => !ids.has(r));
    expect(rotas).toEqual([]);
    expect(Object.keys(p.preciosLiterales)).toHaveLength(Object.keys(PELUCHIC.preciosLiterales!).length);
  });
});
