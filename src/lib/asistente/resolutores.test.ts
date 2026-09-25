import { describe, expect, test } from "bun:test";
import { fechaEnZona } from "../zona-horaria";
import { AHORA_CORPUS } from "./evaluar";
import { asistentePeluChic, datosPeluChic } from "./prueba-peluchic";

const TZ = "Europe/Madrid";
const d = datosPeluChic();
const { asistente, fuentes } = asistentePeluChic({ ahora: AHORA_CORPUS });
const pedir = (q: string) => {
  asistente.reiniciar();
  const r = asistente.responder(q);
  if (r.tipo !== "respuesta") throw new Error(`${q}: ${JSON.stringify(r)}`);
  return r;
};
const activas = d.citas.filter((c) => c.status !== "cancelled" && c.status !== "blocked");
const delDia = (dia: string) => activas.filter((c) => fechaEnZona(c.start, TZ) === dia);

describe("resolutores con la demo PeluChic (cifras contrastadas con los datos)", () => {
  test("citas de hoy y su reparto", () => {
    const n = delDia("2026-09-25").length;
    const r = pedir("cuantas citas tengo hoy");
    expect(r.cifras[0].valor).toBe(n);
    for (const e of d.equipo) {
      const k = delDia("2026-09-25").filter((c) => c.employeeId === e.id).length;
      if (k) expect(r.texto).toContain(`${k} de ${e.name.split(" ")[0]}`);
    }
  });

  test("citas de mañana y de un día concreto", () => {
    expect(pedir("cuantas citas hay mañana").cifras[0].valor).toBe(delDia("2026-09-26").length);
    expect(pedir("citas del martes").cifras[0].valor).toBe(delDia("2026-09-29").length);
  });

  test("precio y duración salen de la carta", () => {
    const tinte = d.servicios.find((s) => s.name === "Tinte")!;
    const r = pedir("cuanto cuesta un tinte");
    expect(r.cifras[0].valor).toBe(tinte.priceEur);
    expect(pedir("cuanto dura el tinte").cifras[0].valor).toBe(tinte.durationMin);
  });

  test("cobrado es solo lo que tiene paidAt (con o sin cobros en la semilla)", () => {
    const r = pedir("cuanto he cobrado este mes");
    const cobrado = d.citas
      .filter((c) => fechaEnZona(c.start, TZ).slice(0, 7) === "2026-09" && c.paidAt && c.status !== "cancelled" && c.status !== "blocked" && c.status !== "no-show")
      .reduce((t, c) => t + c.priceEur, 0);
    expect(r.cifras[0].valor).toBe(cobrado);
    if (!cobrado) expect(r.texto).toContain("no has marcado ningún cobro");
  });

  test("los huecos no pisan ninguna cita y caen dentro de la jornada", () => {
    const h = fuentes.huecos("2026-09-29")!;
    expect(h.length).toBeGreaterThan(0);
    for (const x of h) {
      const pisa = delDia("2026-09-29").filter((c) => c.employeeId === x.profesionalId && c.status !== "no-show")
        .some((c) => Date.parse(c.start) < Date.parse(x.hasta) && Date.parse(c.start) + c.duration * 60_000 > Date.parse(x.desde));
      expect(pisa).toBe(false);
      expect(x.minutos).toBeGreaterThanOrEqual(30);
    }
  });

  test("lunes cerrado: no hay jornada ni huecos", () => {
    expect(fuentes.aperturaDelDia("2026-09-28")?.trabaja).toBe(false);
    expect(fuentes.huecos("2026-09-28")).toEqual([]);
  });

  test("última visita de una clienta: la de su ficha, no la de otra", () => {
    const c = d.clientes.find((x) => x.name === "Lucía García")!;
    const ult = d.citas.filter((x) => x.clientId === c.id && x.status === "completed" && Date.parse(x.start) < AHORA_CORPUS.getTime()).sort((a, b) => b.start.localeCompare(a.start))[0];
    const r = pedir("cuando vino por ultima vez Lucía García");
    expect(r.texto.startsWith("Lucía García vino")).toBe(true);
    const dia = Number(fechaEnZona(ult.start, TZ).slice(8));
    expect(r.texto).toContain(`**${dia} de `);
    expect(r.acciones[0]?.clientaId).toBe(c.id);
  });

  test("lista de espera: el número real", () => {
    expect(pedir("hay alguien en lista de espera").cifras[0].valor).toBe(d.listaEspera.length);
  });

  test("señal: regla del perfil (20 € a todas, Bizum)", () => {
    const r = pedir("cuanto pido de señal");
    expect(r.texto).toContain("20 €");
  });

  test("horario del salón en una línea", () => {
    expect(pedir("que horario tiene el salon").texto).toBe("PeluChic abre **Mar–Vie 10:00–20:00 · Sáb 9:00–14:00**.");
  });

  test("lo que no está, se dice: colores del calendario no conectados en BACKEND", () => {
    expect(pedir("colores del calendario").texto).toContain("Eso no lo tengo apuntado");
  });
});
