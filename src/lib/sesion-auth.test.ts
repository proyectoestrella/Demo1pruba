import { expect, spyOn, test } from "bun:test";

import { pedirEnlaceMagicoConCliente } from "./sesion";

test("pide el enlace mágico con el correo recortado y la ruta de retorno del panel", async () => {
  let enviada: { email: string; options: { emailRedirectTo: string } } | undefined;
  const solicitar = async (datos: { email: string; options: { emailRedirectTo: string } }) => {
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
    options: { emailRedirectTo: "https://peluchic.sishow.es/app?s=peluchic" },
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
