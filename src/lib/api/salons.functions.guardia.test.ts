/**
 * La otra mitad de la prueba.
 *
 * `autorizacion.test.ts` demuestra que la puerta cierra. Esto demuestra que
 * la puerta está PUESTA en cada sitio, que es la forma habitual de que un
 * agujero así se vuelva a abrir: alguien añade una función nueva dentro de
 * seis meses, copia y pega la de al lado, y se deja la primera línea.
 *
 * Se lee el fichero como texto a propósito. Una función de servidor de
 * TanStack no se puede llamar desde una prueba sin levantar el servidor
 * entero con su petición, sus cabeceras y su Supabase, así que la alternativa
 * honesta a esto no es una prueba mejor: es ninguna prueba.
 *
 * Si esta prueba se pone roja, NO se cambia la lista de abajo para que pase.
 * Se mira qué función se ha quedado sin guarda.
 */
import { describe, expect, it } from "bun:test";

const FUENTE = await Bun.file(new URL("./salons.functions.ts", import.meta.url)).text();

/**
 * Las funciones que SOLO puede usar el dueño del salón. Cortan con un error.
 * Cada una empieza por `exigirAcceso(data.slug)`.
 */
const DEL_DUENO = [
  "saveSalonProfile",
  "patchSalonProfile",
  "syncWaitlistEntry",
  "deleteWaitlistEntry",
  "deleteAppointment",
  "applyClientPenalty",
  "clearClientPenalty",
  "saveClientNotes",
  "saveClient",
  "syncAppointmentPatch",
  "listarVersiones",
  "restaurarVersion",
];

/**
 * Las que no cortan pero sí recortan: miran quién llama con `acceso(...)` y
 * entregan menos según la respuesta.
 */
const RECORTADAS = ["listSalonData", "syncAppointment", "accesoAlPanel"];

/**
 * Las que son públicas A PROPÓSITO, y por qué. Ninguna devuelve una lista de
 * personas: o hablan del salón, que es público, o de un solo teléfono que
 * quien llama ya conocía.
 */
const PUBLICAS_A_PROPOSITO: Record<string, string> = {
  esSalonRealPublico: "solo dice si un slug existe; el slug ya está en la URL pública",
  getSalonProfile: "la ficha que el propio salón enseña en su web",
  checkClientPenalty: "si ESE teléfono debe dinero, para poder reservar; no devuelve listas",
};

/** El cuerpo de una función exportada, desde su `export const X` hasta el siguiente. */
function cuerpoDe(nombre: string): string {
  const inicio = FUENTE.indexOf(`export const ${nombre} = createServerFn`);
  expect(inicio, `no existe la función de servidor ${nombre}`).toBeGreaterThan(-1);
  const resto = FUENTE.slice(inicio);
  const fin = resto.indexOf("\nexport const ", 1);
  return fin === -1 ? resto : resto.slice(0, fin);
}

/** Todas las funciones de servidor que hay en el fichero, sacadas del propio texto. */
const TODAS = [...FUENTE.matchAll(/export const (\w+) = createServerFn/g)].map((m) => m[1]);

describe("la guarda está puesta en todas las funciones de servidor", () => {
  it("el fichero tiene exactamente las funciones que esta prueba vigila", () => {
    // Si alguien añade una función nueva, esta prueba se pone roja hasta que
    // decida —y escriba aquí— en cuál de los tres grupos va.
    expect(TODAS.sort()).toEqual(
      [...DEL_DUENO, ...RECORTADAS, ...Object.keys(PUBLICAS_A_PROPOSITO)].sort(),
    );
  });

  it("todas reciben la sesión de quien llama", () => {
    for (const nombre of TODAS) {
      expect(cuerpoDe(nombre), `${nombre} no lleva .middleware([conSesion])`).toContain(
        ".middleware([conSesion])",
      );
    }
  });

  for (const nombre of DEL_DUENO) {
    it(`${nombre} exige mando sobre el salón antes de tocar nada`, () => {
      const cuerpo = cuerpoDe(nombre);
      expect(cuerpo).toContain("await exigirAcceso(data.slug)");
      // Y lo hace ANTES de abrir Supabase: comprobar después de haber leído
      // ya la fila no sirve de nada.
      const guarda = cuerpo.indexOf("await exigirAcceso(data.slug)");
      const primerSupabase = cuerpo.indexOf("supabase\n      .from");
      if (primerSupabase > -1) expect(guarda).toBeLessThan(primerSupabase);
    });
  }

  for (const nombre of RECORTADAS) {
    it(`${nombre} mira quién llama para decidir qué entrega`, () => {
      expect(cuerpoDe(nombre)).toContain("acceso(data.slug)");
    });
  }

  it("listSalonData ya no deja que el navegador elija qué ve", () => {
    const cuerpo = cuerpoDe("listSalonData");
    // El parámetro se llama `vista` y es una preferencia; lo que manda es
    // `vistaEfectiva`, que la recorta con el acceso de quien llama.
    expect(cuerpo).toContain("const quien = await acceso(data.slug)");
    expect(cuerpo).toContain("vistaEfectiva(data.vista, quien)");
    // Y el panel sale recortado por rol (lote 8).
    expect(cuerpo).toContain("recortarDatosPanel(quien, todo)");
    // Y no queda ni rastro del `scope` que elegía el cliente.
    expect(cuerpo).not.toContain("data.scope");
  });

  it("una reserva de fuera no puede marcarse como pagada ni confirmarse sola", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    for (const campo of [
      'status: manda ? data.status : "pending"',
      "client_confirmed_at: manda ?",
      "payment_method: manda ?",
      "paid_at: manda ?",
      "deposit_requested_at: manda ?",
      "deposit_received_at: manda ?",
      "deposit_eur: manda ?",
    ]) {
      expect(cuerpo).toContain(campo);
    }
  });

  it("una reserva de fuera no puede pisar una cita que ya existe", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    expect(cuerpo).toContain("if (yaExiste)");
    expect(cuerpo.indexOf("if (yaExiste)")).toBeLessThan(cuerpo.indexOf("escribirCita(supabase, fila)"));
    expect(cuerpo).toContain("return { synced: true as const }");
  });

  it("la comprobación de solape precede a la escritura pública", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    expect(cuerpo.indexOf("haySolape(data.startISO")).toBeLessThan(cuerpo.indexOf("escribirCita(supabase, fila)"));
  });

  it("el panel solo solapa diciéndolo: sin permitirSolape se rechaza antes de escribir", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const i = cuerpo.indexOf("manda && !data.permitirSolape");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(cuerpo.indexOf("escribirCita(supabase, fila)"));
    expect(cuerpo).toContain("reason: ERROR_SOLAPE_PANEL");
    const parche = cuerpoDe("syncAppointmentPatch");
    expect(parche).toContain("reason: ERROR_SOLAPE_PANEL");
    expect(parche.indexOf("ERROR_SOLAPE_PANEL")).toBeLessThan(parche.indexOf(".update(columnas)"));
  });

  it("el horario por profesional se comprueba en el servidor antes de escribir", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const i = cuerpo.indexOf("profesionalTrabaja(perfil, data.employeeId");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(cuerpo.indexOf("escribirCita(supabase, fila)"));
    expect(cuerpo).toContain("reason: ERROR_FUERA_HORARIO");
  });

  it("cada función pública lleva escrito por qué lo es", () => {
    for (const [nombre, motivo] of Object.entries(PUBLICAS_A_PROPOSITO)) {
      expect(motivo.length, `${nombre} sin motivo escrito`).toBeGreaterThan(20);
      expect(TODAS).toContain(nombre);
    }
  });
});

describe("sin backend en producción no hay degradación silenciosa a demo", () => {
  it("getSalonProfile lanza «Backend sin configurar» en vez de responder demo", () => {
    const cuerpo = cuerpoDe("getSalonProfile");
    // VERCEL_ENV y no NODE_ENV: los previews corren con NODE_ENV=production
    // sin Supabase y no pueden dejar todas las demos en «fallo».
    expect(cuerpo).toContain('process.env.VERCEL_ENV === "production"');
    expect(cuerpo).not.toContain('process.env.NODE_ENV === "production"');
    expect(cuerpo).toContain('throw new Error("Backend sin configurar")');
    expect(cuerpo.indexOf("Backend sin configurar")).toBeLessThan(cuerpo.indexOf("return { profile: null }"));
  });
});

describe("señal: la reserva pública no la decide el navegador", () => {
  it("todos los campos de la señal se escriben solo con mando", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    for (const c of ["deposit_status", "deposit_method", "deposit_received_eur", "deposit_applied_at", "deposit_applied_eur", "deposit_refunded_at", "deposit_refunded_eur", "deposit_retained_at", "deposit_note", "deposit_eur", "deposit_requested_at", "deposit_received_at", "deposit_due_at"]) {
      expect(cuerpo, c).toContain(`${c}: manda ?`);
    }
  });

  it("en una reserva de fuera la señal sale de la regla del salón, antes de escribir", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const i = cuerpo.indexOf("senalDeReservaNueva(");
    expect(i).toBeGreaterThan(-1);
    expect(cuerpo.slice(i - 200, i)).toContain("!manda && perfilPublico");
    expect(i).toBeLessThan(cuerpo.indexOf("escribirCita(supabase, fila)"));
  });
});
