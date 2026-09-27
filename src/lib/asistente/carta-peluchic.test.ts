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
    expect(texto("cuánto cuesta un balayage")).toBe("precio-servicio · Mechas* está a **46,50 € / 106,50 €** (2 h).");
  });

  it("qué servicios de novia tenéis → Novias y el maquillaje que también hace novias", () => {
    const t = texto("qué servicios de novia tenéis");
    expect(t).toStartWith("carta · Para «novia» tienes **2 servicios**");
    expect(t).toContain("Novias desde 150 € (sin IVA)");
    expect(t).toContain("Maquillaje de Correccion");
  });

  it("cuánto dura la keratina → la keratina, no otro tratamiento capilar", () => {
    expect(texto("cuánto dura la keratina")).toStartWith("duracion-servicio · Según la carta, tratamiento keratina dura **2 h 30**");
  });

  it("cuánto cuesta el peinado → sus dos peinados con sus precios por largo", () => {
    expect(texto("cuánto cuesta el peinado")).toBe("precio-servicio · Lavado personalizado + Corte + Peinar **43,50 € / 47,50 €** y Peinar **24 € / 28 € / 31 €**.");
  });

  it("cuánto cuesta la depilación de cejas → la depilación primero", () => {
    expect(texto("cuánto cuesta la depilacion de cejas")).toStartWith("precio-servicio · depilacion de ceja **12 €**, depilacion limpieza de ceja **10 €**");
  });

  it("cuánto cuesta la ozonoterapia → aunque su carta diga OZONOTHERAPIA", () => {
    expect(texto("cuánto cuesta la ozonoterapia")).toBe("precio-servicio · OZONOTHERAPIA está a **41 € / 49 € / 51,50 €** (45 min).");
  });

  it("qué tratamientos capilares tengo → los capilares, no toda la carta", () => {
    const t = texto("qué tratamientos capilares tengo");
    expect(t).toStartWith("carta · Para «tratamientos capilares» tienes **4 servicios**");
    expect(t).toContain("SPA CAPILAR JAPONES 1 h 71 € / 2 h 135 €");
  });
});
