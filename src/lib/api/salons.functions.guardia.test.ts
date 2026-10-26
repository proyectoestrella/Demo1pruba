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
import { equipoCabeEnPlan, planDe } from "../plan";
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
  "editarFichaClienta",
  "borrarFichaClienta",
  "syncAppointmentPatch",
  "listarVersiones",
  "restaurarVersion",
  "verVersion",
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
  apuntarseListaEsperaPublica:
    "la clienta se apunta sola cuando no hay hueco; solo INSERTA (no lee ni devuelve listas), con aviso de privacidad, teléfono válido, servicio de la carta, límite por IP y tope por salón",
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

  it("una reserva pública exige el aviso de privacidad y fecha el acuse desde el servidor", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const rechazo = cuerpo.indexOf("!haLeidoAvisoPrivacidad(data.privacyNoticeAccepted)");
    const escritura = cuerpo.indexOf("escribirCita(supabase, fila)");
    expect(rechazo).toBeGreaterThan(-1);
    expect(rechazo).toBeLessThan(escritura);
    expect(cuerpo).toContain("privacy_notice_acknowledged_at: new Date().toISOString()");
    expect(FUENTE).toContain(
      'const exigirAcusePrivacidad = "privacy_notice_acknowledged_at" in fila',
    );
    expect(FUENTE).toContain("exigirAcusePrivacidad && faltaColumnaAcusePrivacidad(error)");
  });

  it("apuntarse a la lista de espera desde fuera es una escritura estrecha y con topes", () => {
    const cuerpo = cuerpoDe("apuntarseListaEsperaPublica");
    expect(cuerpo).toContain("await acceso(data.slug)");
    expect(cuerpo).toContain('quien.tipo === "demo"');
    expect(cuerpo).toContain("haLeidoAvisoPrivacidad(data.privacyNoticeAccepted)");
    expect(cuerpo).toContain("admiteReservaPublicaPorIp(data.slug)");
    expect(cuerpo).toContain("MAX_LISTA_ESPERA_POR_SALON");
    // El id lo pone el servidor: quien llama no puede pisar una entrada ajena.
    expect(cuerpo).toContain("local_id: `web-${randomUUID()}`");
    expect(cuerpo).not.toContain("upsert");
  });

  it("el servidor impide guardar perfiles por encima del plan en alta y parche", () => {
    expect(cuerpoDe("saveSalonProfile")).toContain(
      "perfilDentroDelTopeDeProfesionales(data.profile, data.slug)",
    );
    expect(cuerpoDe("patchSalonProfile")).toContain(
      'if ("team" in data.patch && !perfilDentroDelTopeDeProfesionales(fusionado, data.slug))',
    );
  });

  it("el servidor pasa el slug al tope: PeluChic rechaza un cuarto profesional", () => {
    expect(
      equipoCabeEnPlan(planDe({ plan: "todo-incluido" }, false), ["a", "b", "c", "d"], "peluchic"),
    ).toBe(false);
    expect(
      equipoCabeEnPlan(planDe({ plan: "reservas" }, false), ["a", "b", "c", "d"], "otro"),
    ).toBe(true);
    expect(cuerpoDe("saveSalonProfile")).toContain("data.slug");
  });

  it("un acceso limitado a la web no puede sobrescribir ni restaurar el perfil entero", () => {
    expect(cuerpoDe("saveSalonProfile")).toContain(
      'exigirAcciones(quien, ["web.publicar", "salon.editar", "plan.gestionar"])',
    );
    expect(cuerpoDe("restaurarVersion")).toContain(
      "soloCamposWeb(v.perfil as Record<string, unknown>)",
    );
  });

  it("una reserva de fuera no puede pisar una cita que ya existe", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    expect(cuerpo).toContain("if (yaExiste)");
    expect(cuerpo.indexOf("if (yaExiste)")).toBeLessThan(
      cuerpo.indexOf("escribirCita(supabase, fila)"),
    );
    expect(cuerpo).toContain("return { synced: true as const }");
  });

  it("la comprobación de solape precede a la escritura pública", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const comprobacion = cuerpo.indexOf("await solapaEnServidor(");
    expect(comprobacion).toBeGreaterThan(-1);
    expect(comprobacion).toBeLessThan(cuerpo.indexOf("escribirCita(supabase, fila)"));
    expect(FUENTE).toContain("cabeCitaEnAgenda(");
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
    // 26-oct tarde: se comprueba para cada profesional candidata (motivoNoCabe).
    const i = cuerpo.indexOf("profesionalTrabaja(perfil, emp");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(cuerpo.indexOf("escribirCita(supabase, fila)"));
    expect(cuerpo).toContain("return (ERROR_FUERA_HORARIO)");
    expect(cuerpo).toContain("let motivo = await motivoNoCabe(data.employeeId)");
  });

  it("la reserva pública valida especialidad, preguntas y bloqueos del perfil antes de escribir", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const escritura = cuerpo.indexOf("escribirCita(supabase, fila)");
    for (const regla of [
      "profesionalHaceServicios",
      "limpiarRespuestas",
      "obligatoriasSinResponder",
      "hayBloqueoEnHueco",
    ]) {
      expect(cuerpo.indexOf(regla), regla).toBeGreaterThan(-1);
      expect(cuerpo.indexOf(regla), regla).toBeLessThan(escritura);
    }
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
    expect(cuerpo.indexOf("Backend sin configurar")).toBeLessThan(
      cuerpo.indexOf("return { profile: null }"),
    );
  });
});

describe("señal: la reserva pública no la decide el navegador", () => {
  it("todos los campos de la señal se escriben solo con mando", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    for (const c of [
      "deposit_status",
      "deposit_method",
      "deposit_received_eur",
      "deposit_applied_at",
      "deposit_applied_eur",
      "deposit_refunded_at",
      "deposit_refunded_eur",
      "deposit_retained_at",
      "deposit_note",
      "deposit_eur",
      "deposit_requested_at",
      "deposit_received_at",
      "deposit_due_at",
    ]) {
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

  it("una reserva pública recalcula carta, duración y precio antes de revisar huecos o escribir", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const recalculo = cuerpo.indexOf("datosReservaPublicaDesdeCarta(perfil, data.serviceIds)");
    const bloqueo = cuerpo.indexOf("hayBloqueoEnHueco(");
    const escritura = cuerpo.indexOf("escribirCita(supabase, fila)");
    expect(recalculo).toBeGreaterThan(-1);
    expect(recalculo).toBeLessThan(bloqueo);
    expect(recalculo).toBeLessThan(escritura);
    expect(cuerpo).toContain("reason: ERROR_DATOS_RESERVA");
    expect(cuerpo).toContain("duration_min: durationMinGuardada");
    expect(cuerpo).toContain("price_eur: priceEurGuardado");
  });

  it("la ficha pública pasa por la proyección que elimina notas internas", () => {
    const cuerpo = cuerpoDe("getSalonProfile");
    expect(cuerpo).toContain("perfilPublico({ ...profile, slug: row.slug })");
  });
});

describe("lote 13: calendarios externos en syncAppointment", () => {
  it("un hueco ocupado por lo externo solo se comprueba en la reserva PÚBLICA (dentro de !manda)", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const i = cuerpo.indexOf("hayOcupadoExternoEnHueco(");
    expect(i).toBeGreaterThan(-1);
    const bloquePanel = cuerpo.indexOf("if (manda && !data.permitirSolape)");
    expect(i).toBeLessThan(bloquePanel);
    expect(cuerpo.slice(0, i)).toContain("if (!manda) {");
  });

  it("un fallo (o tabla sin aplicar) al comprobar lo externo abre paso, no rompe la reserva", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const i = cuerpo.indexOf("hayOcupadoExternoEnHueco(");
    expect(cuerpo.slice(i, i + 200)).toContain(".catch(() => false)");
  });

  it("procesarCitaParaConexiones se espera DESPUÉS de escribir la cita, nunca antes", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    const iEscribir = cuerpo.indexOf("await escribirCita(supabase, fila)");
    const iSync = cuerpo.indexOf("procesarCitaParaConexiones(");
    expect(iEscribir).toBeGreaterThan(-1);
    expect(iSync).toBeGreaterThan(iEscribir);
    expect(cuerpo.slice(iSync - 30, iSync)).toContain("await ");
  });

  it("una cita cancelada se BORRA del externo, no se actualiza", () => {
    const cuerpo = cuerpoDe("syncAppointment");
    expect(cuerpo).toContain('fila.status === "cancelled" ? "borrar" : "upsert"');
  });
});
