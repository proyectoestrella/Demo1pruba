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
 * Alternativa preferente (sin Resend): SMTP propio, p. ej. Hostinger.
 *   SMTP_HOST, SMTP_PORT (465, TLS implícito), SMTP_USER, SMTP_PASSWORD.
 *   REMINDER_FROM_EMAIL   «PeluChic <acceso@sishow.es>»; si falta, SMTP_USER.
 * Ver docs/correo-smtp.md.
 *
 * Sin las dos variables no se envía nada y se dice por qué: el cron no
 * revienta, simplemente informa de que falta configurar el proveedor.
 */
import process from "node:process";
import { enviarSmtp, type Conector } from "./smtp.server";

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

/**
 * Lote 17: el remitente tal cual lo espera Resend (`siShow <recordatorios@sishow.es>`
 * o solo la dirección). Si al pegarlo en Vercel se cuelan espacios o unas
 * comillas envolviendo TODO el valor, se quitan; unas comillas solo en el
 * nombre (`"siShow" <…>`) son válidas y se respetan.
 */
export function remitenteDeCorreo(valor: string | undefined): string | undefined {
  let v = valor?.trim();
  if (!v) return undefined;
  const envuelto = /^(["'])(.*)\1$/.exec(v);
  if (envuelto && !envuelto[2].includes(envuelto[1])) v = envuelto[2].trim();
  return v || undefined;
}

/** SMTP si están las cuatro SMTP_*; si no, Resend; si no, null. */
export function proveedorDeCorreo(fetchImpl: typeof fetch = fetch, conectorSmtp?: Conector): ProveedorCorreo | null {
  const smtp = proveedorSmtp(conectorSmtp);
  if (smtp) return smtp;
  return proveedorResend(fetchImpl);
}

function proveedorSmtp(conector?: Conector): ProveedorCorreo | null {
  const host = process.env.SMTP_HOST?.trim();
  const puerto = Number(process.env.SMTP_PORT?.trim() || "465");
  const usuario = process.env.SMTP_USER?.trim();
  const contrasena = process.env.SMTP_PASSWORD;
  if (!host || !usuario || !contrasena || !Number.isInteger(puerto) || puerto <= 0) return null;
  const de = remitenteDeCorreo(process.env.REMINDER_FROM_EMAIL) ?? usuario;
  return {
    nombre: "smtp",
    enviar: (correo) =>
      enviarSmtp(
        { host, puerto, usuario, contrasena },
        { de, para: correo.para, asunto: correo.asunto, texto: correo.texto, html: correo.html },
        conector,
      ),
  };
}

function proveedorResend(fetchImpl: typeof fetch): ProveedorCorreo | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = remitenteDeCorreo(process.env.REMINDER_FROM_EMAIL);
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
