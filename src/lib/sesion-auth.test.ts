import { expect, spyOn, test } from "bun:test";

import { pedirEnlaceMagicoConCliente, verificarCodigo } from "./sesion";

test("pide el enlace mágico con el correo recortado y la ruta de retorno del panel", async () => {
  let enviada: { email: string; options: { emailRedirectTo: string; shouldCreateUser: false } } | undefined;
  const solicitar = async (datos: { email: string; options: { emailRedirectTo: string; shouldCreateUser: false } }) => {
    enviada = datos;
    return { error: null };
  };

  await expect(
    pedirEnlaceMagicoConCliente(
      "  maria@example.test  ",
      "https://peluchic.sishow.es/app?s=peluchic",
      solicitar,
    ),
  ).resolves.toEqual({ ok: true });
  expect(enviada).toEqual({
    email: "maria@example.test",
    options: { emailRedirectTo: "https://peluchic.sishow.es/app?s=peluchic", shouldCreateUser: false },
  });
});

test("no intenta enviar correo cuando falta la configuración de autenticación", async () => {
  await expect(
    pedirEnlaceMagicoConCliente("maria@example.test", "/app?s=peluchic"),
  ).resolves.toMatchObject({ ok: false });
});

test("un error del proveedor deja un mensaje neutro para la persona usuaria", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  const solicitar = async () => ({ error: { message: "fallo interno de transporte" } });

  await expect(
    pedirEnlaceMagicoConCliente("maria@example.test", "/app?s=peluchic", solicitar),
  ).resolves.toEqual({
    ok: false,
    motivo: "No hemos podido enviar el correo. Inténtalo otra vez en un minuto.",
  });
  expect(log).toHaveBeenCalledWith("signInWithOtp:", "fallo interno de transporte");
  log.mockRestore();
});

test("verifica seis cifras como email OTP y normaliza el correo", async () => {
  let recibido: unknown;
  expect(await verificarCodigo(" MARIA@example.test ", "123456", async d => { recibido = d; return { error: null }; })).toEqual({ ok: true });
  expect(recibido).toEqual({ email: "maria@example.test", token: "123456", type: "email" });
});
test("no verifica códigos incompletos y explica caducidad y error de red", async () => {
  let llamadas = 0;
  await verificarCodigo("a@b.es", "123", async () => { llamadas++; return { error: null }; });
  expect(llamadas).toBe(0);
  expect(await verificarCodigo("a@b.es", "123456", async () => ({ error: { code: "otp_expired", message: "expired" } }))).toMatchObject({ ok: false, motivo: expect.stringContaining("caducado") });
  expect(await verificarCodigo("a@b.es", "123456", async () => { throw Error("network"); })).toMatchObject({ ok: false });
});

test("un correo no invitado recibe la indicación de pedir acceso", async () => {
  expect(await pedirEnlaceMagicoConCliente("sin@correo.es", "https://peluchic.sishow.es/app", async () => ({ error: { code: "signup_disabled", message: "Signups not allowed" } }))).toMatchObject({ ok: false, motivo: expect.stringContaining("Pide a María") });
});
