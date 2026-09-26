/**
 * Ajustes › Calendarios / «Mi calendario» (lote 13): el cableado de servidor
 * que llama FRONTEND. La lógica real está en
 * `src/lib/calendario-externo/calendario-externo.server.ts`; aquí solo se
 * comprueba quién llama y con qué permiso, igual que el resto de
 * `src/lib/api/*.functions.ts`.
 *
 * Nunca en una demo: una demo de venta no tiene calendario real que
 * conectar (mismo criterio que `accesos.functions.ts`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { tienePermiso, type Acceso } from "./autorizacion";
import { exigirAcceso } from "./autorizacion.server";
import { exigirAcciones } from "./guardas";
import { conSesion } from "./sesion.middleware";
import {
  ajustarConexionCalendario as ajustarConexionCalendarioServer,
  conectarApple as conectarAppleServer,
  desconectarCalendario as desconectarCalendarioServer,
  iniciarConexionGoogle as iniciarConexionGoogleServer,
  listarConexiones,
  listarOcupadoExterno as listarOcupadoExternoServer,
  obtenerConexion,
} from "../calendario-externo/calendario-externo.server";

const slug = z.string().min(1).max(120);
const employeeIdOpcional = z.string().min(1).max(120).nullable().optional();

async function accesoRealMiembro(salonSlug: string): Promise<Extract<Acceso, { tipo: "miembro" }>> {
  const acceso = await exigirAcceso(salonSlug); // lanza AccesoDenegado si es ajeno
  if (acceso.tipo !== "miembro") {
    throw new Error("En una demo no hay calendarios externos que conectar: se activan con un salón real.");
  }
  return acceso;
}

/** El `employeeId` de la conexión de verdad (nunca el que mande el navegador) para exigir el permiso sobre ella. */
async function empleadaDeLaConexion(salonSlug: string, conexionId: string): Promise<string | null> {
  const conexion = await obtenerConexion(salonSlug, conexionId);
  if (!conexion) throw new Error("Esa conexión ya no existe.");
  return conexion.employeeId;
}

export const listarConexionesCalendario = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug }))
  .handler(async ({ data }) => {
    await accesoRealMiembro(data.slug);
    // Leer el estado no exige `calendario-externo.gestionar`: cualquiera que
    // entre al panel puede VER si hay un calendario conectado (es
    // informativo, como el resto de Ajustes). Lo que se recorta con el
    // permiso es poder TOCAR una conexión, no verla.
    return listarConexiones(data.slug);
  });

export const iniciarConexionGoogle = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, employeeId: employeeIdOpcional }))
  .handler(async ({ data }) => {
    const acceso = await accesoRealMiembro(data.slug);
    exigirAcciones(acceso, ["calendario-externo.gestionar"], [data.employeeId ?? null]);
    return iniciarConexionGoogleServer({ salonSlug: data.slug, employeeId: data.employeeId ?? null, userId: acceso.userId });
  });

export const conectarApple = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      employeeId: employeeIdOpcional,
      appleId: z.string().email().max(200),
      // La contraseña de aplicación de Apple tiene forma "xxxx-xxxx-xxxx-xxxx"
      // (16 letras + 3 guiones); se acepta con o sin guiones por si el
      // formulario los quita, pero nunca una contraseña normal (mucho más
      // larga o corta no encaja igual, aunque el rechazo real lo da iCloud).
      appPassword: z.string().min(8).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const acceso = await accesoRealMiembro(data.slug);
    exigirAcciones(acceso, ["calendario-externo.gestionar"], [data.employeeId ?? null]);
    return conectarAppleServer({
      salonSlug: data.slug,
      employeeId: data.employeeId ?? null,
      appleId: data.appleId,
      appPassword: data.appPassword,
      userId: acceso.userId,
    });
  });

export const desconectarCalendario = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, conexionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const acceso = await accesoRealMiembro(data.slug);
    const empleada = await empleadaDeLaConexion(data.slug, data.conexionId);
    exigirAcciones(acceso, ["calendario-externo.gestionar"], [empleada]);
    return desconectarCalendarioServer(data.slug, data.conexionId);
  });

export const ajustarConexionCalendario = createServerFn({ method: "POST" })
  .middleware([conSesion])
  .inputValidator(
    z.object({
      slug,
      conexionId: z.string().min(1),
      bloquearHuecos: z.boolean().optional(),
      escribirCitas: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const acceso = await accesoRealMiembro(data.slug);
    const empleada = await empleadaDeLaConexion(data.slug, data.conexionId);
    exigirAcciones(acceso, ["calendario-externo.gestionar"], [empleada]);
    return ajustarConexionCalendarioServer(data.slug, data.conexionId, {
      bloquearHuecos: data.bloquearHuecos,
      escribirCitas: data.escribirCitas,
    });
  });

export const listarOcupadoExterno = createServerFn({ method: "GET" })
  .middleware([conSesion])
  .inputValidator(z.object({ slug, desde: z.string().min(1), hasta: z.string().min(1) }))
  .handler(async ({ data }) => {
    // No hace falta `calendario-externo.gestionar`: esto es leer la agenda
    // (como las citas), no tocar una conexión. Mismo recorte que las citas:
    // sin `cita.ver-todas`, solo lo de la profesional que llama.
    const acceso = await exigirAcceso(data.slug);
    const todo = tienePermiso(acceso, "cita.ver-todas");
    const miEmployeeId = acceso.tipo === "miembro" ? acceso.employeeId : null;
    return listarOcupadoExternoServer(data.slug, data.desde, data.hasta, { todo, miEmployeeId });
  });
