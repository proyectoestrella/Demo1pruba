import { afterEach, describe, expect, it } from "bun:test";
import net from "node:net";
import { codificarCabecera, construirMensaje, direccionDe, enviarSmtp, type Conector } from "./smtp.server";
import { proveedorDeCorreo } from "./email.server";

/** Servidor SMTP simulado en texto plano; `fallarEn` fuerza un código de error. */
function servidorFalso(opciones: { fallarEn?: string; mudo?: boolean } = {}) {
  const recibidos: string[] = [];
  let datos = "";
  const server = net.createServer((s) => {
    if (opciones.mudo) return;
    let enDatos = false;
    let bufer = "";
    let pasoAuth = 0;
    s.write("220 falso ESMTP\r\n");
    s.on("data", (b) => {
      bufer += b.toString("utf8");
      if (enDatos) {
        const fin = bufer.indexOf("\r\n.\r\n");
        if (fin < 0) return;
        datos = bufer.slice(0, fin);
        bufer = bufer.slice(fin + 5);
        enDatos = false;
        s.write("250 2.0.0 aceptado\r\n");
      }
      let i: number;
      while (!enDatos && (i = bufer.indexOf("\r\n")) >= 0) {
        const l = bufer.slice(0, i);
        bufer = bufer.slice(i + 2);
        recibidos.push(l);
        const cmd = pasoAuth ? `AUTH${pasoAuth}` : l.split(/[ :]/)[0].toUpperCase();
        if (opciones.fallarEn && cmd === opciones.fallarEn) { s.write("535 5.7.8 credenciales malas\r\n"); continue; }
        if (cmd === "EHLO") s.write("250-falso\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n");
        else if (cmd === "AUTH") { pasoAuth = 1; s.write("334 VXNlcm5hbWU6\r\n"); }
        else if (cmd === "AUTH1") { pasoAuth = 2; s.write("334 UGFzc3dvcmQ6\r\n"); }
        else if (cmd === "AUTH2") { pasoAuth = 0; s.write("235 2.7.0 ok\r\n"); }
        else if (cmd === "MAIL" || cmd === "RCPT") s.write("250 ok\r\n");
        else if (cmd === "DATA") { enDatos = true; s.write("354 adelante\r\n"); }
        else if (cmd === "QUIT") { s.write("221 adiós\r\n"); s.end(); }
      }
    });
  });
  return new Promise<{ puerto: number; recibidos: string[]; datos: () => string; cerrar: () => void }>((r) =>
    server.listen(0, "127.0.0.1", () =>
      r({ puerto: (server.address() as net.AddressInfo).port, recibidos, datos: () => datos, cerrar: () => server.close() }),
    ),
  );
}

const conectorPlano: Conector = (o) => net.connect({ host: o.host, port: o.puerto });
const mensaje = {
  de: "PeluChic <acceso@sishow.es>",
  para: "clienta@example.com",
  asunto: "Recordatorio: tu cita mañana a las 10:00",
  texto: "Hola Ana, te esperamos mañana.\n.punto al inicio",
  html: "<p>Hola Ana, te esperamos <b>mañana</b>.</p>",
};

describe("enviarSmtp contra un servidor simulado", () => {
  it("sigue EHLO → AUTH LOGIN → MAIL → RCPT → DATA → QUIT y manda un MIME correcto", async () => {
    const srv = await servidorFalso();
    try {
      await enviarSmtp({ host: "127.0.0.1", puerto: srv.puerto, usuario: "acceso@sishow.es", contrasena: "secreta" }, mensaje, conectorPlano);
      expect(srv.recibidos).toEqual([
        "EHLO sishow.es",
        "AUTH LOGIN",
        Buffer.from("acceso@sishow.es").toString("base64"),
        Buffer.from("secreta").toString("base64"),
        "MAIL FROM:<acceso@sishow.es>",
        "RCPT TO:<clienta@example.com>",
        "DATA",
        "QUIT",
      ]);
      const d = srv.datos();
      expect(d).toContain("From: PeluChic <acceso@sishow.es>\r\n");
      expect(d).toContain("To: <clienta@example.com>\r\n");
      expect(d).toContain(`Subject: =?UTF-8?B?${Buffer.from(mensaje.asunto).toString("base64")}?=\r\n`);
      expect(d).toMatch(/\r\nDate: \w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} \+0000\r\n/);
      expect(d).toMatch(/\r\nMessage-ID: <[0-9a-f-]+@sishow\.es>\r\n/);
      expect(d).toContain("Content-Type: multipart/alternative; boundary=");
      expect(d).toContain("Content-Type: text/plain; charset=UTF-8");
      expect(d).toContain("Content-Type: text/html; charset=UTF-8");
      const partes = d.split(/\r\n\r\n/).slice(1);
      const textoB64 = partes[1].split("\r\n--")[0].replace(/\r\n/g, "");
      expect(Buffer.from(textoB64, "base64").toString("utf8")).toBe(mensaje.texto);
    } finally {
      srv.cerrar();
    }
  });

  it("da un error claro sin la contraseña si falla la autenticación", async () => {
    const srv = await servidorFalso({ fallarEn: "AUTH2" });
    try {
      const err = await enviarSmtp({ host: "127.0.0.1", puerto: srv.puerto, usuario: "u", contrasena: "supersecreta" }, mensaje, conectorPlano).catch((e) => e as Error);
      expect(err).toBeInstanceOf(Error);
      expect(err!.message).toContain("AUTH LOGIN (contraseña)");
      expect(err!.message).toContain("535");
      expect(err!.message).not.toContain("supersecreta");
      expect(err!.message).not.toContain(Buffer.from("supersecreta").toString("base64"));
    } finally {
      srv.cerrar();
    }
  });

  it("corta con timeout si el servidor no saluda", async () => {
    const srv = await servidorFalso({ mudo: true });
    try {
      const err = await enviarSmtp({ host: "127.0.0.1", puerto: srv.puerto, usuario: "u", contrasena: "p", timeoutMs: 200 }, mensaje, conectorPlano).catch((e) => e as Error);
      expect(err!.message).toContain("sin respuesta en 200 ms tras saludo");
    } finally {
      srv.cerrar();
    }
  });
});

describe("cabeceras", () => {
  it("codifica en RFC 2047 solo si hace falta y extrae la dirección", () => {
    expect(codificarCabecera("Hola")).toBe("Hola");
    expect(codificarCabecera("Mañana")).toBe(`=?UTF-8?B?${Buffer.from("Mañana").toString("base64")}?=`);
    expect(direccionDe("PeluChic <acceso@sishow.es>")).toBe("acceso@sishow.es");
    expect(direccionDe("acceso@sishow.es")).toBe("acceso@sishow.es");
    expect(construirMensaje({ ...mensaje, de: "Peluquería Ñ <a@sishow.es>" })).toContain(
      `From: =?UTF-8?B?${Buffer.from("Peluquería Ñ").toString("base64")}?= <a@sishow.es>`,
    );
  });
});

describe("proveedorDeCorreo: SMTP > Resend > nada", () => {
  const claves = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "RESEND_API_KEY", "REMINDER_FROM_EMAIL"];
  const antes = Object.fromEntries(claves.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of claves) {
      if (antes[k] === undefined) delete process.env[k];
      else process.env[k] = antes[k];
    }
  });
  const limpiar = () => claves.forEach((k) => delete process.env[k]);

  it("elige SMTP con las SMTP_* aunque haya Resend, y envía por él", async () => {
    limpiar();
    const srv = await servidorFalso();
    try {
      Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(srv.puerto), SMTP_USER: "acceso@sishow.es", SMTP_PASSWORD: "x", RESEND_API_KEY: "re", REMINDER_FROM_EMAIL: "PeluChic <acceso@sishow.es>" });
      const p = proveedorDeCorreo(fetch, conectorPlano);
      expect(p?.nombre).toBe("smtp");
      await p!.enviar({ para: "c@example.com", asunto: "a", texto: "t", html: "<p>t</p>" });
      expect(srv.datos()).toContain("From: PeluChic <acceso@sishow.es>");
    } finally {
      srv.cerrar();
    }
  });

  it("sin SMTP_PASSWORD cae a Resend; sin nada, null", () => {
    limpiar();
    Object.assign(process.env, { SMTP_HOST: "h", SMTP_USER: "u", RESEND_API_KEY: "re", REMINDER_FROM_EMAIL: "a@b.es" });
    expect(proveedorDeCorreo()?.nombre).toBe("resend");
    limpiar();
    expect(proveedorDeCorreo()).toBeNull();
  });
});
