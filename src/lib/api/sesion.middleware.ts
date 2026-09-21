/**
 * El carril por el que viaja "quién está llamando".
 *
 * Una función de servidor no sabe nada del navegador que la llama salvo lo
 * que le llegue en la petición. Este middleware añade a cada llamada la
 * cabecera `Authorization: Bearer <token>` con la sesión que tenga el
 * navegador en ese momento.
 *
 * Tres cosas importan de aquí:
 *
 *   1. Viaja un TOKEN FIRMADO por Supabase, no un correo ni un id de usuario.
 *      El navegador puede escribir lo que quiera en una cabecera; lo que no
 *      puede es falsificar una firma. El servidor lo verifica contra Supabase
 *      antes de creerse nada.
 *   2. Si no hay sesión, no se añade nada y la llamada sigue adelante. Tiene
 *      que ser así: la web pública de reservas y las ~54 demos de venta llaman
 *      a estas mismas funciones sin sesión ninguna, y no pueden dejar de
 *      funcionar. Quien decide qué se le entrega a una llamada sin sesión es
 *      el servidor (ver lib/api/autorizacion.ts), no esta cabecera.
 *   3. Esto NO es la seguridad. Esto es el sobre. La seguridad es lo que hace
 *      el servidor al abrirlo.
 */
import { createMiddleware } from "@tanstack/react-start";

import { tokenDeAcceso } from "../supabase-browser";

export const conSesion = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = await tokenDeAcceso();
  if (!token) return next();
  return next({ headers: { authorization: `Bearer ${token}` } });
});
