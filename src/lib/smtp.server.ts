/**
 * Cliente SMTP mínimo, sin dependencias (solo `node:tls`), para mandar el
 * recordatorio desde un buzón propio (Hostinger: smtp.hostinger.com:465, TLS
 * implícito). Conversación: EHLO → AUTH LOGIN → MAIL FROM → RCPT TO → DATA → QUIT.
 *
 * La contraseña nunca aparece en errores ni registros: los mensajes de error
 * citan solo el comando (AUTH se muestra como «AUTH LOGIN») y la respuesta del
 * servidor.
 */
import tls from "node:tls";
import { randomUUID } from "node:crypto";
import type { Duplex } from "node:stream";

export interface OpcionesSmtp {
  host: string;
  puerto: number;
  usuario: string;
  contrasena: string;
  /** Tiempo máximo por respuesta del servidor, en ms. */
  timeoutMs?: number;
  /** Dominio para EHLO y Message-ID. */
  dominio?: string;
}

export interface MensajeSmtp {
  /** Remitente tal cual va en la cabecera From («PeluChic <acceso@sishow.es>» o solo la dirección). */
  de: string;
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

/** Abre el socket ya cifrado. Se inyecta en los tests. */
export type Conector = (o: OpcionesSmtp) => Duplex;

const conectorTls: Conector = (o) => tls.connect({ host: o.host, port: o.puerto, servername: o.host });

/** Extrae la dirección de «Nombre <dir@x>» o devuelve la cadena tal cual. */
export function direccionDe(remitente: string): string {
  const m = /<([^>]+)>\s*$/.exec(remitente);
  return (m ? m[1] : remitente).trim();
}

/** Cabecera RFC 2047 en UTF-8/base64 si hay algo fuera de ASCII imprimible. */
export function codificarCabecera(texto: string): string {
  if (/^[\x20-\x7e]*$/.test(texto)) return texto;
  return `=?UTF-8?B?${Buffer.from(texto, "utf8").toString("base64")}?=`;
}

/** From con el nombre visible codificado si lleva acentos. */
function cabeceraFrom(remitente: string): string {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(remitente);
  if (!m || !m[1]) return direccionDe(remitente);
  const nombre = /^[\w .-]*$/.test(m[1]) ? m[1] : codificarCabecera(m[1]);
  return `${nombre} <${m[2].trim()}>`;
}

function base64Lineas(texto: string): string {
  return (Buffer.from(texto, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

/** Mensaje RFC 5322 con MIME multipart/alternative (texto + HTML en base64). */
export function construirMensaje(m: MensajeSmtp, dominio = "sishow.es", fecha = new Date()): string {
  const frontera = `=_sishow_${randomUUID().replace(/-/g, "")}`;
  const cabeceras = [
    `From: ${cabeceraFrom(m.de)}`,
    `To: <${m.para}>`,
    `Subject: ${codificarCabecera(m.asunto)}`,
    `Date: ${fecha.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${randomUUID()}@${dominio}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${frontera}"`,
  ];
  const cuerpo = [
    `--${frontera}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lineas(m.texto),
    `--${frontera}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lineas(m.html),
    `--${frontera}--`,
  ];
  return [...cabeceras, "", ...cuerpo].join("\r\n");
}

/** Lector de respuestas SMTP (multilínea «250-…» hasta «250 …»). */
function lectorRespuestas(socket: Duplex, timeoutMs: number) {
  let bufer = "";
  let lineas: string[] = [];
  const cola: Array<{ codigo: number; texto: string }> = [];
  let espera: ((r: { codigo: number; texto: string }) => void) | null = null;
  let fallo: Error | null = null;
  let rechazo: ((e: Error) => void) | null = null;

  const fallar = (e: Error) => {
    fallo = e;
    rechazo?.(e);
  };
  socket.on("data", (trozo: Buffer) => {
    bufer += trozo.toString("utf8");
    let i: number;
    while ((i = bufer.indexOf("\n")) >= 0) {
      const linea = bufer.slice(0, i).replace(/\r$/, "");
      bufer = bufer.slice(i + 1);
      lineas.push(linea);
      if (/^\d{3} /.test(linea) || /^\d{3}$/.test(linea)) {
        const r = { codigo: Number(linea.slice(0, 3)), texto: lineas.join(" | ") };
        lineas = [];
        if (espera) {
          const e = espera;
          espera = null;
          rechazo = null;
          e(r);
        } else cola.push(r);
      }
    }
  });
  socket.on("error", (e: Error) => fallar(new Error(`SMTP: error de conexión: ${e.message}`)));
  socket.on("close", () => fallar(new Error("SMTP: el servidor cerró la conexión")));

  return (paso: string) =>
    new Promise<{ codigo: number; texto: string }>((resolve, reject) => {
      if (cola.length) return resolve(cola.shift()!);
      if (fallo) return reject(fallo);
      const t = setTimeout(() => {
        espera = null;
        reject(new Error(`SMTP: sin respuesta en ${timeoutMs} ms tras ${paso}`));
      }, timeoutMs);
      espera = (r) => {
        clearTimeout(t);
        resolve(r);
      };
      rechazo = (e) => {
        clearTimeout(t);
        reject(e);
      };
    });
}

/** Manda un correo. Lanza un Error claro (sin la contraseña) si algo falla. */
export async function enviarSmtp(o: OpcionesSmtp, m: MensajeSmtp, conectar: Conector = conectorTls): Promise<void> {
  const timeoutMs = o.timeoutMs ?? 15_000;
  const dominio = o.dominio ?? "sishow.es";
  const socket = conectar(o);
  const leer = lectorRespuestas(socket, timeoutMs);

  const paso = async (comando: string | null, esperado: number, etiqueta = comando ?? "conexión") => {
    if (comando !== null) socket.write(`${comando}\r\n`);
    const r = await leer(etiqueta);
    if (r.codigo !== esperado) throw new Error(`SMTP: ${etiqueta} → ${r.texto.slice(0, 200)}`);
    return r;
  };

  try {
    await paso(null, 220, "saludo");
    await paso(`EHLO ${dominio}`, 250);
    await paso("AUTH LOGIN", 334);
    await paso(Buffer.from(o.usuario).toString("base64"), 334, "AUTH LOGIN (usuario)");
    await paso(Buffer.from(o.contrasena).toString("base64"), 235, "AUTH LOGIN (contraseña)");
    await paso(`MAIL FROM:<${direccionDe(m.de)}>`, 250);
    await paso(`RCPT TO:<${m.para}>`, 250);
    await paso("DATA", 354);
    // Dot-stuffing: una línea que empieza por «.» se dobla.
    const datos = construirMensaje(m, dominio).replace(/(^|\r\n)\./g, "$1..");
    await paso(`${datos}\r\n.`, 250, "fin de DATA");
    socket.write("QUIT\r\n");
    await leer("QUIT").catch(() => undefined);
  } finally {
    socket.end();
    socket.destroy();
  }
}
