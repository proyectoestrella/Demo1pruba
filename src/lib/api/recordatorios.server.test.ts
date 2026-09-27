import { describe, expect, it } from "bun:test";
import type { CorreoSaliente, ProveedorCorreo } from "../email.server";
import { enmascararCorreo, enviarRecordatoriosDeManana, leerFiltroRecordatorios } from "./recordatorios.server";

type Fila = Record<string, unknown>;

/**
 * Supabase de mentira con la forma que usa `enviarRecordatoriosDeManana`:
 * encadena select/eq/is/gte/lt/in/update, aplica los `eq` a las filas y
 * apunta cada operación para poder comprobar qué consulta se hizo.
 */
function supabaseFalso(citas: Fila[], salones: Fila[]) {
  const consultas: string[][] = [];
  const marcadas: string[] = [];
  const from = (tabla: string) => {
    const ops: string[] = [tabla];
    consultas.push(ops);
    const eqs: Array<[string, unknown]> = [];
    let esUpdate = false;
    const b = {
      select: () => (ops.push("select"), b),
      eq: (c: string, v: unknown) => (ops.push(`eq ${c}=${String(v)}`), eqs.push([c, v]), b),
      is: (c: string) => (ops.push(`is ${c}`), b),
      gte: (c: string) => (ops.push(`gte ${c}`), b),
      lt: (c: string) => (ops.push(`lt ${c}`), b),
      in: (c: string, v: unknown[]) => (ops.push(`in ${c}=${v.join(",")}`), b),
      update: () => ((esUpdate = true), ops.push("update"), b),
      then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => {
        let r: unknown;
        if (tabla === "appointments" && esUpdate) {
          marcadas.push(String(eqs.find(([c]) => c === "id")?.[1]));
          r = { error: null };
        } else if (tabla === "appointments") {
          r = { data: citas.filter((f) => eqs.every(([c, v]) => f[c] === v)), error: null };
        } else {
          r = { data: salones, error: null };
        }
        return Promise.resolve(r).then(ok, ko);
      },
    };
    return b;
  };
  return { cliente: { from } as never, consultas, marcadas };
}

function proveedorFalso() {
  const enviados: CorreoSaliente[] = [];
  const p: ProveedorCorreo = { nombre: "falso", enviar: async (c) => void enviados.push(c) };
  return { p, enviados };
}

// Domingo 27-sep-2026 a las 17:00 en Madrid; «mañana» es el lunes 28.
const AHORA = new Date("2026-09-27T15:00:00Z");
const cita = (id: string, salon: string, email: string | null, start = "2026-09-28T08:00:00Z"): Fila => ({
  id,
  salon_slug: salon,
  client_name: "Clienta",
  service_id: "corte",
  start_at: start,
  status: "confirmed",
  note: null,
  reminder_sent_at: null,
  deposit_requested_at: null,
  deposit_received_at: null,
  deposit_eur: null,
  clients: { name: "Clienta", email },
});
const CITAS = [
  cita("a1", "pruebas-sishow", "tomas@example.com"),
  cita("a2", "pruebas-sishow", "otra@example.com"),
  cita("b1", "peluchic", "clienta@example.com"),
  cita("c1", "pruebas-sishow", "lejos@example.com", "2026-09-30T08:00:00Z"),
];
const SALONES = [
  { slug: "pruebas-sishow", profile: { name: "Pruebas siShow", tagline: "Peluquería", address: "Calle 1" } },
  { slug: "peluchic", profile: { name: "PeluChic", tagline: "Peluquería", address: "Calle 2" } },
];

describe("leerFiltroRecordatorios", () => {
  const f = (qs: string) => leerFiltroRecordatorios(new URL(`https://sishow.es/api/recordatorios${qs}`));

  it("sin parámetros no filtra nada (lo que manda el cron)", () => {
    expect(f("")).toEqual({});
    expect(f("?token=secreto")).toEqual({});
  });

  it("lee salon, cita y dry", () => {
    expect(f("?salon=pruebas-sishow")).toEqual({ salon: "pruebas-sishow" });
    expect(f("?cita=4b1e0c9a-1d2e-4f00-9a1b-0c0d0e0f1a2b&dry=1")).toEqual({
      cita: "4b1e0c9a-1d2e-4f00-9a1b-0c0d0e0f1a2b",
      simulacion: true,
    });
    expect(f("?dry=true")).toEqual({ simulacion: true });
  });

  it("un valor mal formado es error, nunca «sin filtro»", () => {
    expect(f("?salon=")).toHaveProperty("error");
    expect(f("?salon=Pelu%20Chic")).toHaveProperty("error");
    expect(f("?salon=a,b")).toHaveProperty("error");
    expect(f("?cita=1;drop")).toHaveProperty("error");
    expect(f("?dry=0")).toHaveProperty("error");
  });
});

describe("enviarRecordatoriosDeManana con filtros", () => {
  it("sin filtro: todos los salones, como siempre (misma consulta que antes)", async () => {
    const db = supabaseFalso(CITAS, SALONES);
    const { p, enviados } = proveedorFalso();
    const r = await enviarRecordatoriosDeManana(AHORA, p, {}, db.cliente);
    expect(r).toEqual({ proveedor: "falso", candidatas: 3, enviados: 3, fallidos: [] });
    expect(enviados.map((c) => c.para).sort()).toEqual(["clienta@example.com", "otra@example.com", "tomas@example.com"]);
    expect(db.consultas[0]).toEqual([
      "appointments",
      "select",
      "eq status=confirmed",
      "is reminder_sent_at",
      "gte start_at",
      "lt start_at",
    ]);
    expect(db.marcadas.sort()).toEqual(["a1", "a2", "b1"]);
  });

  it("?salon= limita la consulta y los envíos a ese salón", async () => {
    const db = supabaseFalso(CITAS, SALONES);
    const { p, enviados } = proveedorFalso();
    const r = await enviarRecordatoriosDeManana(AHORA, p, { salon: "pruebas-sishow" }, db.cliente);
    expect(db.consultas[0]).toContain("eq salon_slug=pruebas-sishow");
    expect(r.enviados).toBe(2);
    expect(enviados.map((c) => c.para).sort()).toEqual(["otra@example.com", "tomas@example.com"]);
    expect(db.marcadas.sort()).toEqual(["a1", "a2"]);
  });

  it("?cita= limita a esa cita, que sigue teniendo que ser de mañana", async () => {
    const db = supabaseFalso(CITAS, SALONES);
    const { p, enviados } = proveedorFalso();
    expect((await enviarRecordatoriosDeManana(AHORA, p, { cita: "a1" }, db.cliente)).enviados).toBe(1);
    expect(enviados.map((c) => c.para)).toEqual(["tomas@example.com"]);
    const lejos = await enviarRecordatoriosDeManana(AHORA, p, { cita: "c1" }, supabaseFalso(CITAS, SALONES).cliente);
    expect(lejos).toMatchObject({ candidatas: 0, enviados: 0 });
  });

  it("?dry=1 no envía ni marca, y enmascara los correos", async () => {
    const db = supabaseFalso(CITAS, SALONES);
    const { p, enviados } = proveedorFalso();
    const r = await enviarRecordatoriosDeManana(AHORA, p, { salon: "pruebas-sishow", simulacion: true }, db.cliente);
    expect(enviados).toHaveLength(0);
    expect(db.marcadas).toHaveLength(0);
    expect(r.enviados).toBe(0);
    expect(r.candidatas).toBe(2);
    expect(r.simulacion?.map((s) => s.para).sort()).toEqual(["o***@example.com", "t***@example.com"]);
    expect(r.simulacion?.every((s) => s.salon === "pruebas-sishow")).toBe(true);
  });

  it("?dry=1 sin proveedor de correo también simula y dice que falta", async () => {
    const r = await enviarRecordatoriosDeManana(AHORA, null, { simulacion: true }, supabaseFalso(CITAS, SALONES).cliente);
    expect(r).toMatchObject({ proveedor: null, candidatas: 3, motivo: "sin-proveedor" });
    expect(r.simulacion).toHaveLength(3);
  });

  it("sin Supabase sigue diciendo sin-backend", async () => {
    expect(await enviarRecordatoriosDeManana(AHORA, null, {}, null)).toEqual({
      proveedor: null,
      candidatas: 0,
      enviados: 0,
      fallidos: [],
      motivo: "sin-backend",
    });
  });
});

describe("enmascararCorreo", () => {
  it("deja la inicial y el dominio", () => {
    expect(enmascararCorreo("maria.lopez@gmail.com")).toBe("m***@gmail.com");
    expect(enmascararCorreo("sinarroba")).toBe("***");
  });
});
