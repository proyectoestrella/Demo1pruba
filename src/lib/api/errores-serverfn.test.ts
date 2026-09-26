import { describe, expect, it } from "bun:test";
import { mensajeDeValidacion, payloadIlegible, reescribirErrorDeValidacion, respuestaDeError, vigilarEntrada } from "./errores-serverfn";

const ZOD_CRUDO = JSON.stringify([{ code: "too_small", minimum: 1, type: "string", inclusive: true, exact: false, message: "String must contain at least 1 character(s)", path: ["slug"] }], null, 2);
/** Como lo guarda seroval: el texto escapado como literal de JS (así llega de producción). */
const ZOD = JSON.stringify(ZOD_CRUDO).slice(1, -1);
/** Respuesta tal cual la da hoy producción para un slug vacío (200 con el error dentro). */
const respuestaZod = () =>
  new Response(JSON.stringify({ t: 10, i: 0, p: { k: ["result", "error", "context"], v: [{ t: 2, s: 1 }, { t: 25, i: 1, s: { message: { t: 1, s: ZOD } }, c: "$TSR/Error" }, { t: 10, i: 2, p: { k: [], v: [] }, o: 0 }] }, o: 0 }), {
    status: 200, headers: { "content-type": "application/json", "x-tss-serialized": "true" },
  });

describe("server functions: entradas malformadas → 4xx en español", () => {
  it("payload GET que no es JSON: ilegible", async () => {
    expect(await payloadIlegible(new Request("https://x.test/_serverFn/abc?payload=%7Bno-json"))).toBe(true);
    expect(await payloadIlegible(new Request("https://x.test/_serverFn/abc?payload=%7B%7D"))).toBe(false);
    expect(await payloadIlegible(new Request("https://x.test/_serverFn/abc"))).toBe(false);
  });

  it("cuerpo POST JSON roto: ilegible, y el cuerpo sigue disponible para el handler", async () => {
    const roto = new Request("https://x.test/_serverFn/abc", { method: "POST", body: "{", headers: { "content-type": "application/json" } });
    expect(await payloadIlegible(roto)).toBe(true);
    const bueno = new Request("https://x.test/_serverFn/abc", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(await payloadIlegible(bueno)).toBe(false);
    expect(await bueno.text()).toBe("{}");
  });

  it("vigilarEntrada: payload roto → 400 con Error serializado, sin llamar al resto", async () => {
    let llamado = false;
    const r = await vigilarEntrada(new Request("https://x.test/_serverFn/abc?payload=%7Bno"), async () => { llamado = true; return new Response("x"); });
    expect(llamado).toBe(false);
    expect(r!.status).toBe(400);
    const cuerpo = await r!.json();
    expect(cuerpo.c).toBe("$TSR/Error");
    expect(cuerpo.s.message.s).toContain("no se pueden leer");
  });

  it("error de zod (hoy 200) → 400 con el mensaje en español y el mismo formato", async () => {
    const r = await reescribirErrorDeValidacion(respuestaZod());
    expect(r.status).toBe(400);
    const cuerpo = await r.json();
    expect(cuerpo.p.v[1].s.message.s).toBe("Datos no válidos: «slug» no puede ir vacío.");
    expect(r.headers.get("x-tss-serialized")).toBe("true");
  });

  it("una respuesta buena o un error que no es de zod no se tocan", async () => {
    const ok = new Response(JSON.stringify({ t: 10, p: { k: ["result"], v: [1] } }), { headers: { "content-type": "application/json", "x-tss-serialized": "true" } });
    expect(await reescribirErrorDeValidacion(ok)).toBe(ok);
    const otro = respuestaDeError("No autorizado", 500);
    expect(await reescribirErrorDeValidacion(otro)).toBe(otro);
  });

  it("mensajes de zod más comunes", () => {
    expect(mensajeDeValidacion(JSON.stringify([{ code: "invalid_type", expected: "string", path: ["desde"] }]))).toBe("Datos no válidos: «desde» falta o no tiene el formato esperado.");
    expect(mensajeDeValidacion("no es zod")).toBeNull();
    expect(mensajeDeValidacion("[]")).toBeNull();
  });

  it("una página pedida como JSON → 406, no 500; las api/* y el HTML pasan", async () => {
    const siguiente = async () => new Response("pagina");
    const json = await vigilarEntrada(new Request("https://x.test/s/xyz", { headers: { accept: "application/json" } }), siguiente);
    expect(json!.status).toBe(406);
    expect((await vigilarEntrada(new Request("https://x.test/s/xyz", { headers: { accept: "text/html,*/*" } }), siguiente))!.status).toBe(200);
    expect((await vigilarEntrada(new Request("https://x.test/api/foto", { headers: { accept: "application/json" } }), siguiente))!.status).toBe(200);
  });
});
