/**
 * Envío de correo desde el servidor.
 *
 * El proyecto no tenía ningún proveedor propio (el enlace mágico del panel lo
 * manda Supabase Auth con su propio remitente). Para el recordatorio del día
 * anterior se usa Resend por su API HTTP: sin paquete nuevo, plan gratuito
 * suficiente para un salón, y la clave solo en variables de entorno.
 *
 *   RESEND_API_KEY        clave del proyecto en resend.com (secreta).
 *   REMINDER_FROM_EMAIL   remitente verificado en Resend, p. ej.
 *                         "siShow <recordatorios@tudominio.com>".
 *
 * Sin las dos variables no se envía nada y se dice por qué: el cron no
 * revienta, simplemente informa de que falta configurar el proveedor.
 */
import process from "node:process";

export interface CorreoSaliente {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

export interface ProveedorCorreo {
  nombre: string;
  enviar: (correo: CorreoSaliente) => Promise<void>;
}

export function proveedorDeCorreo(fetchImpl: typeof fetch = fetch): ProveedorCorreo | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) return null;
  return {
    nombre: "resend",
    enviar: async (correo) => {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [correo.para],
          subject: correo.asunto,
          text: correo.texto,
          html: correo.html,
        }),
      });
      if (!res.ok) {
        const detalle = await res.text().catch(() => "");
        throw new Error(`Resend ${res.status}: ${detalle.slice(0, 200)}`);
      }
    },
  };
}
