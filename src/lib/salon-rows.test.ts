import { describe, expect, it } from "bun:test";

import {
  findPenaltyRow,
  phoneKey,
  resolveActiveProfile,
  rowToAppointment,
  rowToClient,
  type AppointmentRow,
  type ClientRow,
} from "./salon-rows";
import { salon } from "./mock/salon";
import type { SalonProfile } from "./mock/types";

const adam: SalonProfile = {
  ...salon,
  id: "the-best-shave-barber",
  slug: "the-best-shave-barber",
  name: "THE BEST SHAVE & BARBER",
  tagline: "Barbería",
  team: ["Adam~Cortes, barba y afeitado clásico"],
};

describe("resolveActiveProfile — la frontera entre salón real y demo de venta", () => {
  it("un null de Supabase NO pisa el perfil que ya se estaba enseñando", () => {
    const { profile, real } = resolveActiveProfile(salon, null);
    expect(real).toBe(false);
    expect(profile).toBe(salon);
    expect(profile.name).toBe("Barbería Pepe");
  });

  it("undefined se trata igual que null (la consulta falló o no respondió)", () => {
    const { profile, real } = resolveActiveProfile(salon, undefined);
    expect(real).toBe(false);
    expect(profile.name).toBe("Barbería Pepe");
  });

  it("un perfil de Supabase SÍ pisa lo que hubiera en el navegador", () => {
    const { profile, real } = resolveActiveProfile(salon, adam);
    expect(real).toBe(true);
    expect(profile.name).toBe("THE BEST SHAVE & BARBER");
    expect(profile.team).toEqual(["Adam~Cortes, barba y afeitado clásico"]);
  });

  it("el perfil real pisa también lo que venga de un enlace ?d= ya aplicado", () => {
    // Así es como llega: el `?d=` ya escribió su salón en la store, y la
    // respuesta de Supabase llega después. Debe ganar la de Supabase.
    const desdeEnlace: SalonProfile = { ...salon, name: "Cardedal", slug: "the-best-shave-barber" };
    const { profile, real } = resolveActiveProfile(desdeEnlace, adam);
    expect(real).toBe(true);
    expect(profile.name).toBe("THE BEST SHAVE & BARBER");
  });
});

describe("phoneKey", () => {
  it("reduce a los últimos 9 dígitos, da igual cómo se teclee", () => {
    expect(phoneKey("+34 622 87 46 38")).toBe("622874638");
    expect(phoneKey("622874638")).toBe("622874638");
    expect(phoneKey("34 622 87 46 38")).toBe("622874638");
  });

  it("aguanta vacío y nulo", () => {
    expect(phoneKey("")).toBe("");
    expect(phoneKey(null)).toBe("");
    expect(phoneKey(undefined)).toBe("");
  });
});

const fila: AppointmentRow = {
  id: "84f52ef8-b888-4ad3-a0f1-ee62ebf6e445",
  local_id: "a-new-1758200000000",
  client_id: "fde14486-ecfc-4016-b6a1-4d4c819c568b",
  client_name: "Marta Ruiz",
  service_id: "corte,barba",
  employee_id: "mario",
  start_at: "2026-09-26T13:00:00+00:00",
  duration_min: 50,
  // `numeric` de Postgres llega como CADENA en JSON, no como número.
  price_eur: "25.00",
  status: "pending",
  client_confirmed_at: null,
  note: "Viene con su hijo",
};

describe("rowToAppointment", () => {
  it("usa el id local del navegador, no el uuid", () => {
    expect(rowToAppointment(fila).id).toBe("a-new-1758200000000");
  });

  it("cae al uuid cuando la fila no tiene id local (reservas anteriores)", () => {
    expect(rowToAppointment({ ...fila, local_id: null }).id).toBe(fila.id);
  });

  it("parte los servicios por comas y convierte el precio a número", () => {
    const a = rowToAppointment(fila);
    expect(a.serviceIds).toEqual(["corte", "barba"]);
    expect(a.priceEur).toBe(25);
    expect(a.duration).toBe(50);
  });

  it("una cita sin servicios no produce un id vacío en la lista", () => {
    expect(rowToAppointment({ ...fila, service_id: "" }).serviceIds).toEqual([]);
  });

  it("en modo anónimo (web pública) no viajan ni el nombre ni la nota interna", () => {
    const a = rowToAppointment(fila, true);
    expect(a.clientName).toBe("Reservado");
    expect(a.note).toBeUndefined();
    // Pero el hueco sí: es para lo único que la necesita la web pública.
    expect(a.start).toBe(fila.start_at);
    expect(a.duration).toBe(50);
  });

  it("un walk-in sin ficha de cliente no rompe el mapeo", () => {
    const a = rowToAppointment({ ...fila, client_id: null, client_name: "Cliente sin cita" });
    expect(a.clientId).toBe("");
    expect(a.clientName).toBe("Cliente sin cita");
  });
});

const ficha: ClientRow = {
  id: "fde14486-ecfc-4016-b6a1-4d4c819c568b",
  name: "Marta Ruiz",
  phone: "+34 622 87 46 38",
  email: null,
  notes: null,
  penalty_eur: "7",
  penalty_note: "No vino el 12 sept · Corte",
  created_at: "2026-09-17T06:41:31.119878+00:00",
};

describe("rowToClient", () => {
  it("convierte la penalización a número", () => {
    const c = rowToClient(ficha);
    expect(c.penaltyEur).toBe(7);
    expect(c.penaltyNote).toBe("No vino el 12 sept · Corte");
  });

  it("una penalización a 0 o nula es 'no debe nada', no un 0 que bloquee", () => {
    expect(rowToClient({ ...ficha, penalty_eur: null }).penaltyEur).toBeUndefined();
    expect(rowToClient({ ...ficha, penalty_eur: 0 }).penaltyEur).toBeUndefined();
  });
});

describe("findPenaltyRow", () => {
  const filas: ClientRow[] = [
    { ...ficha, penalty_eur: null },
    { ...ficha, id: "otro", phone: "600111222", penalty_eur: "7" },
  ];

  it("encuentra al penalizado aunque el teléfono se teclee con prefijo y espacios", () => {
    expect(findPenaltyRow(filas, "+34 600 11 12 22")?.id).toBe("otro");
  });

  it("no bloquea a quien no debe nada", () => {
    expect(findPenaltyRow(filas, "+34 622 87 46 38")).toBeUndefined();
  });

  it("no bloquea mientras la persona sigue escribiendo el teléfono", () => {
    expect(findPenaltyRow(filas, "6001")).toBeUndefined();
  });
});
