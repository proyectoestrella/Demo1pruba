import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { crearDobleSupabase } from "@/lib/api/doble-supabase";
import { mockTransitorio } from "@/lib/api/doble-start";
import { codificarEstado, decodificarEstado } from "./google-oauth";

const CLAVE = Buffer.alloc(32, 7).toString("base64");
let doble = crearDobleSupabase({});
const mocks = [
  await mockTransitorio("@/lib/supabase.server", { getSupabaseServerClient: () => doble as never }),
  await mockTransitorio("@/lib/calendario-externo/google-oauth", {
    intercambiarCodigo: (async () => ({ accessToken: "acc", refreshToken: "ref", expiresIn: 3600 })) as never,
    correoDeLaCuenta: (async () => "ana@example.test") as never,
  }),
];
beforeAll(() => {
  mocks.forEach((m) => m.activar());
  Object.assign(process.env, {
    GOOGLE_CALENDAR_CLIENT_ID: "cliente-prueba",
    GOOGLE_CALENDAR_CLIENT_SECRET: "secreto-prueba",
    GOOGLE_CALENDAR_REDIRECT_URI: "https://sishow.test/api/calendario-externo/google/callback",
    CALENDARIO_CLAVE_CIFRADO: CLAVE,
  });
});
afterAll(() => mocks.forEach((m) => m.desactivar()));

const { completarConexionGoogle, iniciarConexionGoogle } = await import("./calendario-externo.server");

describe("OAuth de Google: state y autorización al volver", () => {
  it("firma los nuevos state con una subclave, no directamente con la clave AES", () => {
    const url = new URL(iniciarConexionGoogle({ salonSlug: "salon", employeeId: null, userId: "u1" }).url);
    const state = url.searchParams.get("state")!;
    expect(decodificarEstado(state, CLAVE)).toBeNull();
  });

  it("un state legado válido no restaura la conexión de quien ya perdió el acceso", async () => {
    doble = crearDobleSupabase({
      salon_members: [{ user_id: "u1", salon_slug: "salon", rol: "gerente", estado: "baja" }],
    });
    // Los state emitidos antes del cambio siguen verificándose durante sus
    // diez minutos de vida, pero no sustituyen la autorización actual.
    const stateLegado = codificarEstado({ salonSlug: "salon", employeeId: null, userId: "u1" }, CLAVE);
    const resultado = await completarConexionGoogle("codigo", stateLegado);
    expect(resultado).toEqual({ ok: false, salonSlug: "salon", error: "Ya no tienes permiso para conectar este calendario." });
    expect(doble.escrituras.some((e) => e.tabla === "calendario_conexiones")).toBe(false);
  });
});
