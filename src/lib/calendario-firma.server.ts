import { createHmac } from "node:crypto";

/**
 * Enlace personal de una profesional (25-oct noche): no lleva el token del
 * salón, sino una firma de su id con él. Con el enlace de Patricia solo se
 * ven las citas de Patricia, y no se puede quitar el filtro para ver el resto.
 */
export async function firmaCalendarioProfesional(tokenSalon: string, slug: string, profesional: string): Promise<string> {
  return createHmac("sha256", tokenSalon).update(`${slug}:${profesional}`).digest("base64url");
}
