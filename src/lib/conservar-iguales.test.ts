import { describe, expect, it } from "bun:test";
import { conservarIguales } from "./conservar-iguales";
import { useSalonStore } from "./store";
import { datosPeluChic } from "./asistente/prueba-peluchic";

const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe("el refresco no sustituye listas iguales", () => {
  const d = datosPeluChic();

  it("misma agenda desde el servidor (objetos nuevos): el MISMO array", () => {
    expect(conservarIguales(copia(d.citas), d.citas)).toBe(d.citas);
  });

  it("una cita cambiada: array nuevo, pero las demás son los mismos objetos", () => {
    const nuevas = copia(d.citas);
    nuevas[5].status = nuevas[5].status === "cancelled" ? "confirmed" : "cancelled";
    const r = conservarIguales(nuevas, d.citas);
    expect(r).not.toBe(d.citas);
    expect(r[5]).toBe(nuevas[5]);
    expect(r[4]).toBe(d.citas[4]);
    expect(r[6]).toBe(d.citas[6]);
  });

  it("detecta cambios en campos anidados (serviceIds) y en campos que aparecen o desaparecen", () => {
    const a = [{ id: "1", serviceIds: ["x"] }];
    expect(conservarIguales([{ id: "1", serviceIds: ["x", "y"] }], a)).not.toBe(a);
    expect(conservarIguales([{ id: "1", serviceIds: ["x"], note: "n" }], a as never)).not.toBe(a);
    expect(conservarIguales([], a)).not.toBe(a);
  });

  it("hydrateFromServer con los mismos datos no avisa a los suscriptores (no repinta)", () => {
    const st = useSalonStore.getState();
    const datos = { appointments: copia(st.appointments), clients: copia(st.clients), waitlist: copia(st.waitlist) };
    st.hydrateFromServer(datos);
    let avisos = 0;
    const quitar = useSalonStore.subscribe(() => { avisos += 1; });
    useSalonStore.getState().hydrateFromServer({ appointments: copia(datos.appointments), clients: copia(datos.clients), waitlist: copia(datos.waitlist) });
    expect(avisos).toBe(0);
    const cambiada = copia(datos.appointments);
    if (cambiada[0]) cambiada[0].duration += 15;
    useSalonStore.getState().hydrateFromServer({ appointments: cambiada, clients: copia(datos.clients), waitlist: copia(datos.waitlist) });
    quitar();
    expect(avisos).toBe(cambiada[0] ? 1 : 0);
  });
});
