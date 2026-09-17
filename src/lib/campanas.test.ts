import { describe, expect, it } from "bun:test";
import {
  clientesQueNoVuelven,
  huecosFlojos,
  segundaVisita,
  resenaTrasLaCita,
  servicioQueMasDeja,
  buildCampanas,
  resumenDelMes,
  phoneDigits,
  whatsappUrl,
  SEMANAS_INACTIVIDAD,
} from "./campanas";
import type { Appointment, Client, Employee, Service } from "./mock/types";

const NOW = new Date("2026-09-17T12:00:00.000Z");

const SERVICES: Service[] = [
  { id: "corte", name: "Corte de caballero", description: "", durationMin: 30, priceEur: 15 },
  { id: "barba", name: "Arreglo de barba", description: "", durationMin: 20, priceEur: 10 },
];

function cliente(id: string, overrides: Partial<Client> = {}): Client {
  return {
    id,
    name: `Cliente ${id}`,
    phone: `+34 6${id.padStart(8, "0")}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function cita(overrides: Partial<Appointment>): Appointment {
  return {
    id: `a-${Math.random()}`,
    clientId: "c1",
    clientName: "Cliente c1",
    serviceIds: ["corte"],
    employeeId: "mario",
    start: NOW.toISOString(),
    duration: 30,
    priceEur: 15,
    status: "completed",
    ...overrides,
  };
}

function isoHaceDias(dias: number): string {
  return new Date(+NOW - dias * 86_400_000).toISOString();
}

const EMPLOYEES: Employee[] = [
  {
    id: "mario",
    name: "Mario",
    specialty: "",
    yearsExperience: 1,
    photo: "",
    colorVar: "--x",
    // Abierto toda la semana salvo domingo, 10 a 20.
    schedule: [
      null,
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 10, end: 18 },
    ],
  },
];

describe("clientesQueNoVuelven", () => {
  it("incluye a quien no visita desde hace más de 5 semanas", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(40) })];
    const campana = clientesQueNoVuelven(appointments, clients, SERVICES, "Barbería Pepe", NOW);
    expect(campana).not.toBeNull();
    expect(campana!.personas).toHaveLength(1);
    expect(campana!.personas[0].nombre).toBe("Cliente c1");
    expect(campana!.mensaje).toContain("Barbería Pepe");
  });

  it("no incluye a quien visitó hace menos de 5 semanas", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(10) })];
    const campana = clientesQueNoVuelven(appointments, clients, SERVICES, "Barbería Pepe", NOW);
    expect(campana).toBeNull();
  });

  it("no incluye a quien ya tiene una cita futura puesta", () => {
    const clients = [cliente("c1")];
    const appointments = [
      cita({ clientId: "c1", start: isoHaceDias(40) }),
      cita({ clientId: "c1", start: isoHaceDias(-2), status: "confirmed" }),
    ];
    const campana = clientesQueNoVuelven(appointments, clients, SERVICES, "Barbería Pepe", NOW);
    expect(campana).toBeNull();
  });

  it("no incluye a quien nunca ha venido (no es un cliente que 'no vuelve')", () => {
    const clients = [cliente("c1")];
    const campana = clientesQueNoVuelven([], clients, SERVICES, "Barbería Pepe", NOW);
    expect(campana).toBeNull();
  });

  it(`usa exactamente el umbral de ${SEMANAS_INACTIVIDAD} semanas`, () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(SEMANAS_INACTIVIDAD * 7 + 1) })];
    const campana = clientesQueNoVuelven(appointments, clients, SERVICES, "Barbería Pepe", NOW);
    expect(campana).not.toBeNull();
  });
});

describe("huecosFlojos", () => {
  it("detecta la franja con menos ocupación entre las abiertas", () => {
    const clients = [cliente("c1"), cliente("c2")];
    // Llena lunes por la mañana a tope, deja martes por la tarde vacío.
    const appointments: Appointment[] = [];
    for (let semana = 0; semana < 6; semana++) {
      const lunes = new Date(NOW);
      lunes.setDate(lunes.getDate() - lunes.getDay() + 1 - semana * 7);
      lunes.setHours(10, 0, 0, 0);
      if (+lunes < +NOW) {
        appointments.push(
          cita({ clientId: "c1", start: lunes.toISOString(), duration: 30, employeeId: "mario" }),
        );
      }
    }
    const campana = huecosFlojos(appointments, clients, EMPLOYEES, "Barbería Pepe", NOW);
    expect(campana).not.toBeNull();
    // La franja elegida no debería ser "lunes por la mañana", que es la que se llenó.
    expect(campana!.titulo).not.toBe("Llena los lunes por la mañana");
  });

  it("sin ninguna cita, la franja con huecos incluye a los clientes activos", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(10) })];
    const campana = huecosFlojos(appointments, clients, EMPLOYEES, "Barbería Pepe", NOW);
    expect(campana).not.toBeNull();
    expect(campana!.personas.length).toBeGreaterThan(0);
    expect(campana!.cifra).toBeGreaterThan(0);
  });

  it("sin clientes activos, no genera campaña aunque haya huecos", () => {
    const campana = huecosFlojos([], [], EMPLOYEES, "Barbería Pepe", NOW);
    expect(campana).toBeNull();
  });
});

describe("segundaVisita", () => {
  it("incluye a clientes nuevos con una sola cita completada en los últimos 60 días", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(20) })];
    const campana = segundaVisita(appointments, clients, SERVICES, EMPLOYEES, "Barbería Pepe", NOW);
    expect(campana).not.toBeNull();
    expect(campana!.personas).toHaveLength(1);
  });

  it("no incluye a quien ya tiene dos o más citas", () => {
    const clients = [cliente("c1")];
    const appointments = [
      cita({ clientId: "c1", start: isoHaceDias(20) }),
      cita({ clientId: "c1", start: isoHaceDias(5) }),
    ];
    const campana = segundaVisita(appointments, clients, SERVICES, EMPLOYEES, "Barbería Pepe", NOW);
    expect(campana).toBeNull();
  });

  it("no incluye una cita única que aún no ha pasado (no está completada)", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(-2), status: "confirmed" })];
    const campana = segundaVisita(appointments, clients, SERVICES, EMPLOYEES, "Barbería Pepe", NOW);
    expect(campana).toBeNull();
  });

  it("no incluye una única cita de hace más de 60 días", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(90) })];
    const campana = segundaVisita(appointments, clients, SERVICES, EMPLOYEES, "Barbería Pepe", NOW);
    expect(campana).toBeNull();
  });
});

describe("resenaTrasLaCita", () => {
  it("incluye a clientes atendidos en los últimos 7 días con enlace a Google", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(3) })];
    const campana = resenaTrasLaCita(appointments, clients, "Barbería Pepe", "Calle Falsa 1", NOW);
    expect(campana).not.toBeNull();
    expect(campana!.mensaje).toContain("google.com/maps");
  });

  it("no incluye a quien fue atendido hace más de 7 días", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(10) })];
    const campana = resenaTrasLaCita(appointments, clients, "Barbería Pepe", "Calle Falsa 1", NOW);
    expect(campana).toBeNull();
  });
});

describe("servicioQueMasDeja", () => {
  it("propone el servicio que suele acompañar al más reservado en solitario", () => {
    const clients = [cliente("c1"), cliente("c2")];
    const appointments = [
      // c1 siempre pide solo "corte"
      cita({ clientId: "c1", start: isoHaceDias(30), serviceIds: ["corte"] }),
      cita({ clientId: "c1", start: isoHaceDias(60), serviceIds: ["corte"] }),
      // c2 combina corte+barba alguna vez, así que no entra en la lista
      cita({ clientId: "c2", start: isoHaceDias(10), serviceIds: ["corte", "barba"] }),
      cita({ clientId: "c2", start: isoHaceDias(40), serviceIds: ["corte"] }),
    ];
    const campana = servicioQueMasDeja(appointments, clients, SERVICES, "Barbería Pepe", NOW);
    expect(campana).not.toBeNull();
    expect(campana!.personas.map((p) => p.clientId)).toEqual(["c1"]);
    expect(campana!.mensaje.toLowerCase()).toContain("barba");
  });

  it("sin ninguna cita combinada, no inventa el upsell", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(10), serviceIds: ["corte"] })];
    const campana = servicioQueMasDeja(appointments, clients, SERVICES, "Barbería Pepe", NOW);
    expect(campana).toBeNull();
  });
});

describe("buildCampanas / resumenDelMes", () => {
  it("filtra las campañas sin datos y resume recuperables + huecos", () => {
    const clients = [cliente("c1")];
    const appointments = [cita({ clientId: "c1", start: isoHaceDias(40) })];
    const campanas = buildCampanas({
      appointments,
      clients,
      services: SERVICES,
      employees: EMPLOYEES,
      salonName: "Barbería Pepe",
      salonAddress: "Calle Falsa 1",
      now: NOW,
    });
    expect(campanas.every((c) => c.personas.length > 0)).toBe(true);
    const resumen = resumenDelMes(campanas);
    expect(resumen.recuperables).toBe(1);
  });
});

describe("whatsappUrl / phoneDigits", () => {
  it("deja solo dígitos del teléfono", () => {
    expect(phoneDigits("+34 611 111 222")).toBe("34611111222");
  });

  it("arma el enlace de wa.me con el mensaje codificado", () => {
    const url = whatsappUrl("+34 611 111 222", "Hola ¿qué tal?");
    expect(url).toBe("https://wa.me/34611111222?text=Hola%20%C2%BFqu%C3%A9%20tal%3F");
  });
});
