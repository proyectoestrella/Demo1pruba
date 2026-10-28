import { afterAll, beforeAll, describe, expect, it, setSystemTime } from "bun:test";
import { MEZCLA_PELUCHIC, PELUCHIC } from "../demos/peluchic";
import { employeesForType, servicesForType, textosDeCarta } from "../mock/salon";
import { buildSeed } from "../mock/seed";
import { crearFuentesPanel } from "./fuentes-panel";
import { crearAsistente } from "./responder";

/** El asistente del panel sobre la carta REAL de PeluChic (lote P). */
function asistente() {
  const equipo = employeesForType("peluqueria", PELUCHIC.team, PELUCHIC.teamHours, PELUCHIC.openingHours, undefined, "2026-09-28");
  const servicios = servicesForType("peluqueria", PELUCHIC.menu, textosDeCarta(PELUCHIC));
  const seed = buildSeed("peluqueria", equipo, servicios, { duracionFlexible: true, mezcla: MEZCLA_PELUCHIC });
  const estado = { appointments: seed.appointments, clients: seed.clients, services: servicios, waitlist: seed.waitlist, salonProfile: PELUCHIC, realSalonSlug: null };
  return crearAsistente(crearFuentesPanel(() => estado as never, () => equipo, { plan: "todo-incluido", enlace: () => "/s/peluchic" }));
}
const texto = (q: string) => {
  const r = asistente().responder(q);
  return r.tipo === "respuesta" ? `${r.intencion} · ${r.texto}` : `${r.tipo}`;
};

describe("el asistente contesta con la carta real de PeluChic", () => {
  beforeAll(() => setSystemTime(new Date("2026-09-28T09:30:00+02:00")));
  afterAll(() => setSystemTime());

  it("cuánto cuesta un balayage → sus mechas, con el precio como lo anuncia", () => {
    expect(texto("cuánto cuesta un balayage")).toBe("precio-servicio · Mechas* **46,50 € / 106,50 €** y Mechas + Matiz **116,50 €**.");
  });

  it("qué servicios de novia tenéis → Novias (el maquillaje de cámara y foco ya no está en la carta)", () => {
    const t = texto("qué servicios de novia tenéis");
    expect(t).toStartWith("carta · Para «novia» tienes **1 servicio**");
    expect(t).toContain("Novias desde 150 € (sin IVA)");
    expect(t).not.toContain("Maquillaje de Correccion");
  });

  it("cuánto dura la keratina → la keratina, no otro tratamiento capilar", () => {
    expect(texto("cuánto dura la keratina")).toStartWith("duracion-servicio · Según la carta, tratamiento keratina dura **2 h**");
  });

  it("cuánto cuesta el peinado → sus dos peinados con sus precios por largo", () => {
    expect(texto("cuánto cuesta el peinado")).toBe("precio-servicio · Lavado personalizado + Corte + Peinar **43,50 € / 47,50 €** y Peinar **24 € / 28 € / 31 €**.");
  });

  it("cuánto cuesta la depilación de cejas → la depilación primero", () => {
    expect(texto("cuánto cuesta la depilacion de cejas")).toStartWith("precio-servicio · depilacion de ceja **12 €**");
  });

  it("cuánto cuesta la ozonoterapia → aunque su carta diga OZONOTHERAPIA", () => {
    expect(texto("cuánto cuesta la ozonoterapia")).toBe("precio-servicio · OZONOTHERAPIA está a **41 € / 49 € / 51,50 €** (1 h).");
  });

  it("qué tratamientos capilares tengo → los capilares, no toda la carta", () => {
    const t = texto("qué tratamientos capilares tengo");
    expect(t).toStartWith("carta · Para «tratamientos capilares» tienes **3 servicios**");
    expect(t).toContain("Dermapen capilar sesion 30´ 55 €");
  });
});
