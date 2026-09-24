import { afterEach, describe, expect, it, mock } from "bun:test";

/**
 * La garantía más importante de todo el backend: una demo de venta (las ~54 del
 * rutero, sin fila en `salons`) no llama a Supabase NUNCA. Se prueba contando
 * las llamadas reales a las server functions con el módulo interceptado.
 */
const llamadas: string[] = [];
/** Cuando está a `true`, TODA subida falla: es como tener la red caída. */
let fallarTodo = false;
const registra =
  (nombre: string) =>
  (...args: unknown[]) => {
    llamadas.push(nombre);
    void args;
    if (fallarTodo) return Promise.reject(new Error("red caída"));
    return Promise.resolve({ synced: true as const });
  };

mock.module("./api/salons.functions", () => ({
  syncAppointment: registra("syncAppointment"),
  deleteAppointment: registra("deleteAppointment"),
  saveSalonProfile: registra("saveSalonProfile"),
  patchSalonProfile: registra("patchSalonProfile"),
  applyClientPenalty: registra("applyClientPenalty"),
  clearClientPenalty: registra("clearClientPenalty"),
  saveClientNotes: registra("saveClientNotes"),
  saveClient: registra("saveClient"),
  syncWaitlistEntry: registra("syncWaitlistEntry"),
  deleteWaitlistEntry: registra("deleteWaitlistEntry"),
  getSalonProfile: registra("getSalonProfile"),
  listSalonData: registra("listSalonData"),
  checkClientPenalty: registra("checkClientPenalty"),
}));

const {
  pushAppointment,
  pushAppointmentDeletion,
  pushSalonProfile,
  pushSalonProfilePatch,
  pushPenalty,
  pushPenaltyCleared,
  pushClientNotes,
  pushClient,
} = await import("./salon-sync");
const { salon } = await import("./mock/salon");
const { leerAvisos, limpiarAvisos } = await import("./avisos-sync");

const cita = {
  id: "a-new-1",
  clientId: "c-1",
  clientName: "Marta",
  serviceIds: ["corte"],
  employeeId: "mario" as const,
  start: "2026-09-26T13:00:00.000Z",
  duration: 30,
  priceEur: 15,
  status: "pending" as const,
};

const cliente = {
  id: "c-1",
  name: "Marta",
  phone: "+34 600 111 222",
  createdAt: "2026-09-01T00:00:00.000Z",
  notes: "Usa el número 8",
};

it("el alta de una ficha sin cita se sube solo en un salón real", () => {
  pushClient(null, cliente);
  expect(llamadas).toEqual([]);
  pushClient("salon-real", cliente);
  expect(llamadas).toEqual(["saveClient"]);
});

afterEach(() => {
  llamadas.length = 0;
  fallarTodo = false;
  limpiarAvisos();
});

describe("salon-sync con slug null (demo de venta)", () => {
  it("no hace ni una sola llamada a Supabase", () => {
    pushAppointment(null, cita);
    pushAppointmentDeletion(null, "a-new-1");
    pushSalonProfile(null, salon);
    pushSalonProfilePatch(null, { phone: "600 111 222" });
    pushPenalty(null, cliente, 7, "No vino");
    pushPenaltyCleared(null, cliente, "Perdonada");
    pushClientNotes(null, cliente);
    expect(llamadas).toEqual([]);
  });
});

describe("salon-sync con un salón real", () => {
  it("sube la cita, el borrado y el perfil", () => {
    pushAppointment("the-best-shave-barber", cita);
    pushAppointmentDeletion("the-best-shave-barber", "a-new-1");
    pushSalonProfile("the-best-shave-barber", salon);
    expect(llamadas).toEqual(["syncAppointment", "deleteAppointment", "saveSalonProfile"]);
  });

  it("sube penalización, perdón y notas del cliente", () => {
    pushPenalty("the-best-shave-barber", cliente, 7, "No vino");
    pushPenaltyCleared("the-best-shave-barber", cliente, "Perdonada");
    pushClientNotes("the-best-shave-barber", cliente);
    expect(llamadas).toEqual(["applyClientPenalty", "clearClientPenalty", "saveClientNotes"]);
  });

  it("sin teléfono no hay ficha que marcar: no se llama a nada", () => {
    const sinTelefono = { ...cliente, phone: "" };
    pushPenalty("the-best-shave-barber", sinTelefono, 7);
    pushPenaltyCleared("the-best-shave-barber", sinTelefono);
    pushClientNotes("the-best-shave-barber", sinTelefono);
    pushPenalty("the-best-shave-barber", undefined, 7);
    expect(llamadas).toEqual([]);
  });
});

/**
 * Lo que el dueño ve cuando algo NO se guarda. Antes de esto, un fallo de red
 * acababa en la consola del navegador y en ningún otro sitio: el cambio se
 * veía hecho en pantalla y no lo estaba.
 */
describe("un fallo de guardado se ve en pantalla y se puede reintentar", () => {
  it("la cita que no sube deja un aviso en español, con el nombre del cliente", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", cita);
    await esperarAvisos();

    expect(leerAvisos()).toHaveLength(1);
    expect(leerAvisos()[0]!.mensaje).toBe(
      "No hemos podido guardar la cita de Marta. Se ve en esta pantalla, pero todavía no está guardado.",
    );
  });

  it("ningún aviso menciona tecnologías ni códigos de error", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", cita);
    pushSalonProfile("the-best-shave-barber", salon);
    pushPenalty("the-best-shave-barber", cliente, 7, "No vino");
    pushClientNotes("the-best-shave-barber", cliente);
    await esperarAvisos();

    expect(leerAvisos().length).toBeGreaterThanOrEqual(4);
    for (const aviso of leerAvisos()) {
      for (const jerga of ["Supabase", "sync", "Sync", "error", "PGRST", "fetch", "null"]) {
        expect(aviso.mensaje).not.toContain(jerga);
      }
    }
  });

  it("el perfil que no sube se cuenta sin hablar de perfiles ni de bases de datos", async () => {
    fallarTodo = true;
    pushSalonProfile("the-best-shave-barber", salon);
    await esperarAvisos();
    expect(leerAvisos()[0]!.mensaje).toContain("los datos de tu salón");
  });

  it("el botón de reintentar vuelve a subir, y si ya va bien no deja aviso nuevo", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", cita);
    await esperarAvisos();
    const reintentar = leerAvisos()[0]!.reintentar;
    expect(reintentar).toBeDefined();

    llamadas.length = 0;
    limpiarAvisos();
    fallarTodo = false;
    reintentar!();
    await esperarAvisos();

    expect(llamadas).toEqual(["syncAppointment"]);
    expect(leerAvisos()).toEqual([]);
  });

  it("si el reintento también falla, el aviso vuelve a aparecer", async () => {
    fallarTodo = true;
    pushAppointment("the-best-shave-barber", cita);
    await esperarAvisos();
    const reintentar = leerAvisos()[0]!.reintentar!;

    // El componente descarta el aviso al pulsar; la red sigue caída.
    limpiarAvisos();
    reintentar();
    await esperarAvisos();

    expect(leerAvisos()).toHaveLength(1);
    expect(leerAvisos()[0]!.mensaje).toContain("la cita de Marta");
    // Y sigue ofreciendo reintentar: el bucle lo cierra el dueño, no el código.
    expect(leerAvisos()[0]!.reintentar).toBeDefined();
  });

  it("cuando va bien no aparece ningún aviso", async () => {
    pushAppointment("the-best-shave-barber", cita);
    pushSalonProfile("the-best-shave-barber", salon);
    await esperarAvisos();
    expect(leerAvisos()).toEqual([]);
  });
});

/** Las subidas son fire-and-forget: hay que dejar correr la cola de promesas. */
async function esperarAvisos() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/**
 * El perfil ya no se sube entero desde Ajustes. Subirlo entero era lo que
 * permitía que un navegador con el perfil viejo en `localStorage` revirtiera
 * un campo cambiado desde otro dispositivo.
 */
describe("el perfil sube el parche, no el perfil entero", () => {
  it("usa patchSalonProfile, no saveSalonProfile", () => {
    pushSalonProfilePatch("the-best-shave-barber", { phone: "600 999 888" });
    expect(llamadas).toEqual(["patchSalonProfile"]);
  });

  it("un parche sin nada que decir no toca la red", () => {
    pushSalonProfilePatch("the-best-shave-barber", {});
    pushSalonProfilePatch("the-best-shave-barber", { phone: undefined });
    expect(llamadas).toEqual([]);
  });

  it("si el parche no sube, el dueño se entera", async () => {
    fallarTodo = true;
    pushSalonProfilePatch("the-best-shave-barber", { phone: "600 999 888" });
    await esperarAvisos();
    expect(leerAvisos()[0]!.mensaje).toContain("los datos de tu salón");
  });
});
