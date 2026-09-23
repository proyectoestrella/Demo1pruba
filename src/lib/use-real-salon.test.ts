import { describe, expect, it } from "bun:test";

import {
  MENSAJE_CARGA_FALLIDA,
  resolverSalonReal,
  type DatosDelSalon,
  type DepsSalonReal,
  type StoreSalonReal,
} from "./use-real-salon";
import type { SalonProfile } from "./mock/types";
import { salon } from "./mock/salon";

/**
 * El módulo donde estaba el peor fallo de todo el backend: las citas y los
 * clientes de EJEMPLO podían acabar en la base de datos de un salón de pago,
 * porque `setRealSalonSlug` se encendía ANTES de que llegaran los datos
 * reales. Hasta hoy no tenía ni una prueba.
 *
 * Todo se prueba sin React y sin la store de verdad: `resolverSalonReal` pide
 * sus dependencias, así que aquí se le pasa una store de mentira que apunta en
 * un diario el ORDEN exacto de las llamadas. El orden es justamente lo que
 * estaba mal, así que es lo que hay que comprobar.
 */

interface StoreFalsa extends StoreSalonReal {
  diario: string[];
  realSalonSlug: string | null;
  appointments: unknown[];
  clients: unknown[];
  waitlist: unknown[];
}

function storeFalsa(): StoreFalsa {
  const s: StoreFalsa = {
    diario: [],
    realSalonSlug: null,
    // Lo que hay al entrar: datos de ejemplo del seed, como en cualquier pestaña nueva.
    appointments: [{ id: "cita-de-ejemplo" }],
    clients: [{ id: "cliente-de-ejemplo" }],
    waitlist: [{ id: "espera-de-ejemplo" }],
    salonProfile: salon,
    setRealSalonSlug: (slug) => {
      s.diario.push(`setRealSalonSlug:${slug ?? "null"}`);
      s.realSalonSlug = slug;
    },
    updateSalonProfile: (patch) => {
      s.diario.push("updateSalonProfile");
      s.salonProfile = { ...s.salonProfile, ...patch } as SalonProfile;
    },
    applyBusinessType: () => {
      s.diario.push("applyBusinessType");
      // Es lo que hace de verdad: sembrar citas y clientes inventados.
      s.appointments = [{ id: "cita-de-ejemplo" }];
      s.clients = [{ id: "cliente-de-ejemplo" }];
      s.waitlist = [{ id: "espera-de-ejemplo" }];
    },
    vaciarDatosDeEjemplo: () => {
      s.diario.push("vaciarDatosDeEjemplo");
      s.appointments = [];
      s.clients = [];
      s.waitlist = [];
    },
    hydrateFromServer: (datos) => {
      s.diario.push("hydrateFromServer");
      s.appointments = datos.appointments;
      s.clients = datos.clients;
      s.waitlist = datos.waitlist;
    },
  };
  return s;
}

const PERFIL_REAL = {
  ...salon,
  slug: "the-best-shave-barber",
  name: "The Best Shave & Barber",
} as SalonProfile;

const AGENDA_REAL: DatosDelSalon = {
  appointments: [{ id: "cita-real" }] as never,
  clients: [{ id: "cliente-real" }] as never,
  waitlist: [],
};

function deps(over: Partial<DepsSalonReal> & { store: () => StoreSalonReal }): DepsSalonReal {
  return {
    getSalonProfile: async () => ({ profile: PERFIL_REAL }),
    listSalonData: async () => AGENDA_REAL,
    avisar: () => {},
    cancelado: () => false,
    ...over,
  };
}

describe("resolverSalonReal — un salón de pago no se conecta hasta tener sus datos", () => {
  it("enciende realSalonSlug DESPUÉS de hidratar, nunca antes", async () => {
    const s = storeFalsa();
    const res = await resolverSalonReal("the-best-shave-barber", "panel", deps({ store: () => s }));

    expect(res).toBe("real");
    // Este es el invariante de todo el arreglo: hidratar va antes de conectar.
    const iHidrata = s.diario.indexOf("hydrateFromServer");
    const iConecta = s.diario.indexOf("setRealSalonSlug:the-best-shave-barber");
    expect(iHidrata).toBeGreaterThanOrEqual(0);
    expect(iConecta).toBeGreaterThan(iHidrata);
    expect(s.realSalonSlug).toBe("the-best-shave-barber");
  });

  it("borra las citas y clientes de ejemplo que siembra applyBusinessType", async () => {
    const s = storeFalsa();
    await resolverSalonReal("the-best-shave-barber", "panel", deps({ store: () => s }));

    const iSiembra = s.diario.indexOf("applyBusinessType");
    const iVacia = s.diario.indexOf("vaciarDatosDeEjemplo");
    expect(iVacia).toBeGreaterThan(iSiembra);
    // Y lo que queda al final es lo del servidor, no lo inventado.
    expect(s.appointments).toEqual(AGENDA_REAL.appointments);
    expect(s.clients).toEqual(AGENDA_REAL.clients);
  });

  it("no hay ningún instante conectado con datos de ejemplo en la store", async () => {
    const s = storeFalsa();
    // Se toma una foto del estado cada vez que se toca realSalonSlug.
    const fotos: { slug: string | null; citas: number; clientes: number }[] = [];
    const original = s.setRealSalonSlug;
    s.setRealSalonSlug = (slug) => {
      original(slug);
      fotos.push({ slug, citas: s.appointments.length, clientes: s.clients.length });
    };

    await resolverSalonReal("the-best-shave-barber", "panel", deps({ store: () => s }));

    for (const foto of fotos) {
      if (foto.slug === null) continue;
      // Conectado ⇒ lo que hay en la store vino del servidor.
      expect(foto.citas).toBe(AGENDA_REAL.appointments.length);
      expect(foto.clientes).toBe(AGENDA_REAL.clients.length);
    }
  });

  it("si la agenda no carga: NO queda conectado y el dueño ve un aviso en español", async () => {
    const s = storeFalsa();
    const avisos: string[] = [];
    const res = await resolverSalonReal(
      "the-best-shave-barber",
      "panel",
      deps({
        store: () => s,
        listSalonData: async () => {
          throw new Error("network down");
        },
        avisar: (m) => avisos.push(m),
      }),
    );

    expect(res).toBe("fallo");
    // Lo crítico: nada de lo que toque el dueño va a subir a la base real.
    expect(s.realSalonSlug).toBeNull();
    // Y tampoco se queda enseñando citas inventadas.
    expect(s.appointments).toEqual([]);
    expect(s.clients).toEqual([]);
    expect(avisos).toEqual([MENSAJE_CARGA_FALLIDA]);
    expect(avisos[0]).not.toContain("Supabase");
  });

  it("el aviso del fallo ofrece reintentar, y el reintento sí conecta", async () => {
    const s = storeFalsa();
    let intentos = 0;
    const reintentos: (() => void)[] = [];
    await resolverSalonReal(
      "the-best-shave-barber",
      "panel",
      deps({
        store: () => s,
        listSalonData: async () => {
          intentos += 1;
          if (intentos === 1) throw new Error("network down");
          return AGENDA_REAL;
        },
        avisar: (_m, reintentar) => {
          if (reintentar) reintentos.push(reintentar);
        },
      }),
    );

    expect(s.realSalonSlug).toBeNull();
    expect(reintentos).toHaveLength(1);

    reintentos[0]!();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(intentos).toBe(2);
    expect(s.realSalonSlug).toBe("the-best-shave-barber");
    expect(s.appointments).toEqual(AGENDA_REAL.appointments);
  });

  it("una demo de venta (sin fila en salons) sigue con sus datos de ejemplo y sin conectar", async () => {
    const s = storeFalsa();
    let pidioAgenda = false;
    const res = await resolverSalonReal(
      "peluqueria-inventada",
      "publica",
      deps({
        store: () => s,
        getSalonProfile: async () => ({ profile: null }),
        listSalonData: async () => {
          pidioAgenda = true;
          return AGENDA_REAL;
        },
      }),
    );

    expect(res).toBe("demo");
    expect(s.realSalonSlug).toBeNull();
    expect(pidioAgenda).toBe(false);
    // Las demos SÍ conservan sus datos de ejemplo: es de lo que viven.
    expect(s.appointments).toHaveLength(1);
    expect(s.diario).toEqual(["setRealSalonSlug:null"]);
  });

  it("si no se puede ni preguntar si es real, se trata como demo y no se conecta", async () => {
    const s = storeFalsa();
    const res = await resolverSalonReal(
      "the-best-shave-barber",
      "panel",
      deps({
        store: () => s,
        getSalonProfile: async () => {
          throw new Error("supabase caído");
        },
      }),
    );

    expect(res).toBe("demo");
    expect(s.realSalonSlug).toBeNull();
  });

  it("si el componente se desmonta a mitad, no se toca la store ni se conecta", async () => {
    const s = storeFalsa();
    let desmontado = false;
    const res = await resolverSalonReal(
      "the-best-shave-barber",
      "panel",
      deps({
        store: () => s,
        listSalonData: async () => {
          desmontado = true;
          return AGENDA_REAL;
        },
        cancelado: () => desmontado,
      }),
    );

    expect(res).toBe("cancelado");
    expect(s.realSalonSlug).toBeNull();
    expect(s.diario).not.toContain("hydrateFromServer");
  });
});
