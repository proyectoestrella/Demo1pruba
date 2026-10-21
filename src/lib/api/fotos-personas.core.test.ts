import { describe, expect, it } from "bun:test";
import { activarFoto, fotosActivas, listarFotos, puedeCambiarFotos, quitarFotoActiva, subirFoto, FotoInvalida } from "./fotos-personas.core";
import { base64DeBytes, MAX_BYTES_FOTO } from "../fotos-personas";
import type { Acceso } from "./autorizacion";

type Fila = Record<string, unknown>;
/** Doble mínimo de supabase-js: tabla en memoria + storage que apunta lo que sube. */
function doble(opts: { sinTabla?: boolean } = {}) {
  const tabla: Fila[] = [];
  const subidos: string[] = [];
  const borrados: string[] = [];
  const from = (_t: string) => {
    const filtros: Array<[string, unknown]> = [];
    let op = "select"; let datos: Fila = {};
    let single = false; let lim = Infinity; let orden: { col: string; asc: boolean } | null = null;
    const q: Record<string, unknown> = {};
    const ejecutar = () => {
      if (opts.sinTabla) return { data: null, error: { message: 'relation "fotos_personas" does not exist', code: "42P01" } };
      const casa = (f: Fila) => filtros.every(([c, v]) => f[c] === v);
      if (op === "insert") { tabla.push({ creado: new Date(Date.now() + tabla.length).toISOString(), ...datos }); return { data: null, error: null }; }
      if (op === "update") { for (const f of tabla.filter(casa)) Object.assign(f, datos); return { data: null, error: null }; }
      if (op === "delete") { for (const f of tabla.filter(casa)) tabla.splice(tabla.indexOf(f), 1); return { data: null, error: null }; }
      let r = tabla.filter(casa);
      if (orden) r = [...r].sort((a, b) => (String(a[orden!.col]) < String(b[orden!.col]) ? -1 : 1) * (orden!.asc ? 1 : -1));
      r = r.slice(0, lim);
      return { data: single ? (r[0] ?? null) : r, error: null };
    };
    Object.assign(q, {
      select: () => q, eq: (c: string, v: unknown) => (filtros.push([c, v]), q), limit: (n: number) => ((lim = n), q),
      order: (col: string, o: { ascending: boolean }) => ((orden = { col, asc: o.ascending }), q),
      maybeSingle: () => ((single = true), q),
      insert: (d: Fila) => ((op = "insert"), (datos = d), q), update: (d: Fila) => ((op = "update"), (datos = d), q), delete: () => ((op = "delete"), q),
      then: (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) => Promise.resolve(ejecutar()).then(ok, mal),
    });
    return q;
  };
  const storage = { from: () => ({
    upload: async (ruta: string) => { subidos.push(ruta); return { error: null }; },
    remove: async (rutas: string[]) => { borrados.push(...rutas); return { error: null }; },
    createSignedUrls: async (rutas: string[]) => ({ data: rutas.map((p) => ({ path: p, signedUrl: `https://firmada/${p}?t=1` })), error: null }),
  }) };
  return { sb: { from, storage }, tabla, subidos, borrados };
}

const miembro = (rol: "gerente" | "subencargado" | "recepcion" | "estilista", employeeId: string | null = null): Acceso =>
  ({ tipo: "miembro", userId: "u1", rol, employeeId, displayName: null });
const foto = (n = 60) => { const b = new Uint8Array(n); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return base64DeBytes(b); };
let u = 0; const uuid = () => `00000000-0000-4000-8000-${String(++u).padStart(12, "0")}`;

describe("permisos de las fotos", () => {
  it("equipo: gerente y subencargada sí; recepción no; estilista solo la suya", () => {
    expect(puedeCambiarFotos(miembro("gerente"), "equipo", "e1")).toBe(true);
    expect(puedeCambiarFotos(miembro("subencargado"), "equipo", "e1")).toBe(true);
    expect(puedeCambiarFotos(miembro("recepcion"), "equipo", "e1")).toBe(false);
    expect(puedeCambiarFotos(miembro("estilista", "e1"), "equipo", "e1")).toBe(true);
    expect(puedeCambiarFotos(miembro("estilista", "e1"), "equipo", "e2")).toBe(false);
  });
  it("clientas: quien edita clientas; demo y ajeno nunca", () => {
    expect(puedeCambiarFotos(miembro("recepcion"), "clienta", "c1")).toBe(true);
    expect(puedeCambiarFotos({ tipo: "ajeno" }, "clienta", "c1")).toBe(false);
    expect(puedeCambiarFotos({ tipo: "demo" }, "clienta", "c1")).toBe(false);
  });
});

describe("subir, historial, volver a una anterior y quitar", () => {
  it("la nueva queda activa, la anterior se conserva y se puede recuperar", async () => {
    const d = doble();
    const a = miembro("gerente");
    const r1 = await subirFoto(d.sb, "salon", a, "clienta", "c1", foto(), uuid);
    const r2 = await subirFoto(d.sb, "salon", a, "clienta", "c1", foto(80), uuid);
    if (!r1.disponible || !r2.disponible) throw new Error("no disponible");
    expect(d.subidos[0]).toMatch(/^salon\/clientas\/c1\/.+\.webp$/);
    expect(d.tabla.filter((f) => f.activa).map((f) => f.id)).toEqual([r2.foto.id]);
    expect(d.tabla.find((f) => f.id === r2.foto.id)?.creado_por).toBe("u1");

    const lista = await listarFotos(d.sb, "salon", a, "clienta", "c1");
    if (!lista.disponible) throw new Error("no disponible");
    expect(lista.fotos.map((f) => f.id)).toEqual([r2.foto.id, r1.foto.id]);

    await activarFoto(d.sb, "salon", a, "clienta", "c1", r1.foto.id);
    expect(d.tabla.filter((f) => f.activa).map((f) => f.id)).toEqual([r1.foto.id]);

    await quitarFotoActiva(d.sb, "salon", a, "clienta", "c1");
    expect(d.tabla.some((f) => f.activa)).toBe(false);
    expect(d.tabla).toHaveLength(2);
  });
  it("fotosActivas devuelve URL firmada por persona", async () => {
    const d = doble();
    await subirFoto(d.sb, "salon", miembro("gerente"), "equipo", "e1", foto(), uuid);
    const r = await fotosActivas(d.sb, "salon", miembro("gerente"));
    expect(r.disponible && r.fotos["equipo:e1"]).toMatch(/^https:\/\/firmada\/salon\/equipo\/e1\//);
  });
  it("no deja activar una foto de otra persona ni de otro salón", async () => {
    const d = doble();
    const r = await subirFoto(d.sb, "salon", miembro("gerente"), "clienta", "c1", foto(), uuid);
    if (!r.disponible) throw new Error();
    await expect(activarFoto(d.sb, "salon", miembro("gerente"), "clienta", "c2", r.foto.id)).rejects.toThrow(FotoInvalida);
    await expect(activarFoto(d.sb, "otro", miembro("gerente"), "clienta", "c1", r.foto.id)).rejects.toThrow(FotoInvalida);
  });
  it("poda a 10 y borra del almacén las antiguas", async () => {
    const d = doble();
    for (let i = 0; i < 12; i++) await subirFoto(d.sb, "salon", miembro("gerente"), "equipo", "e1", foto(), uuid);
    expect(d.tabla).toHaveLength(10);
    expect(d.borrados).toHaveLength(2);
    expect(d.tabla.filter((f) => f.activa)).toHaveLength(1);
  });
});

describe("rechazos y sin esquema", () => {
  it("sin permiso no sube nada", async () => {
    const d = doble();
    await expect(subirFoto(d.sb, "salon", miembro("recepcion"), "equipo", "e1", foto(), uuid)).rejects.toThrow(/no permite/);
    await expect(subirFoto(d.sb, "salon", miembro("estilista", "e2"), "equipo", "e1", foto(), uuid)).rejects.toThrow(/no permite/);
    await expect(subirFoto(d.sb, "salon", { tipo: "ajeno" }, "clienta", "c1", foto(), uuid)).rejects.toThrow();
    expect(d.subidos).toHaveLength(0);
  });
  it("valida tamaño, formato, tipo e id antes de subir", async () => {
    const d = doble(); const a = miembro("gerente");
    await expect(subirFoto(d.sb, "salon", a, "clienta", "c1", foto(MAX_BYTES_FOTO + 10), uuid)).rejects.toThrow(/pesa demasiado/);
    await expect(subirFoto(d.sb, "salon", a, "clienta", "c1", btoa("<svg/>"), uuid)).rejects.toThrow(/formato/);
    await expect(subirFoto(d.sb, "salon", a, "clienta", "../x", foto(), uuid)).rejects.toThrow(/no válida/);
    await expect(subirFoto(d.sb, "salon", a, "otra" as never, "c1", foto(), uuid)).rejects.toThrow(/no válida/);
    expect(d.subidos).toHaveLength(0);
  });
  it("sin tabla responde «no disponible» sin romper", async () => {
    const d = doble({ sinTabla: true }); const a = miembro("gerente");
    expect(await fotosActivas(d.sb, "salon", a)).toEqual({ disponible: false });
    expect(await listarFotos(d.sb, "salon", a, "clienta", "c1")).toEqual({ disponible: false });
    expect(await subirFoto(d.sb, "salon", a, "clienta", "c1", foto(), uuid)).toEqual({ disponible: false });
    expect(d.subidos).toHaveLength(0);
  });
});
