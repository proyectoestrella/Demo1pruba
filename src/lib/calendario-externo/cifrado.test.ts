import { describe, expect, it } from "bun:test";
import { cifrar, cifrarCredencial, descifrar, descifrarCredencial, generarClave } from "./cifrado";

const CLAVE = generarClave();
const OTRA_CLAVE = generarClave();

describe("cifrado ida y vuelta", () => {
  it("descifra exactamente lo que cifró", () => {
    const blob = cifrar("un-refresh-token-secreto", CLAVE);
    expect(descifrar(blob, CLAVE)).toBe("un-refresh-token-secreto");
  });

  it("dos cifrados del mismo texto no son iguales (IV aleatorio)", () => {
    expect(cifrar("hola", CLAVE)).not.toBe(cifrar("hola", CLAVE));
  });

  it("no descifra con la clave equivocada", () => {
    const blob = cifrar("secreto", CLAVE);
    expect(() => descifrar(blob, OTRA_CLAVE)).toThrow();
  });

  it("un blob manipulado falla (autenticado, no solo cifrado)", () => {
    const blob = cifrar("secreto", CLAVE);
    const partes = blob.split(".");
    const bytes = Buffer.from(partes[3], "base64");
    bytes[0] = bytes[0] ^ 0xff;
    partes[3] = bytes.toString("base64");
    expect(() => descifrar(partes.join("."), CLAVE)).toThrow();
  });

  it("un formato desconocido lanza en vez de devolver basura", () => {
    expect(() => descifrar("no-es-un-blob-cifrado", CLAVE)).toThrow();
  });

  it("sin clave en el entorno ni pasada a mano, lanza", () => {
    const antes = process.env.CALENDARIO_CLAVE_CIFRADO;
    delete process.env.CALENDARIO_CLAVE_CIFRADO;
    try {
      expect(() => cifrar("x")).toThrow(/CALENDARIO_CLAVE_CIFRADO/);
    } finally {
      if (antes !== undefined) process.env.CALENDARIO_CLAVE_CIFRADO = antes;
    }
  });

  it("rechaza una clave que no decodifica a 32 bytes", () => {
    expect(() => cifrar("x", Buffer.from("demasiado-corta").toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("cifrado de credenciales tipadas", () => {
  it("cifra y descifra un objeto con su forma", () => {
    const cred = { tipo: "google" as const, refreshToken: "1//abc", cuenta: "noelia@gmail.com" };
    const blob = cifrarCredencial(cred, CLAVE);
    const de = descifrarCredencial<typeof cred>(blob, CLAVE);
    expect(de).toEqual(cred);
  });

  it("rechaza un JSON sin `tipo`", () => {
    const blob = cifrar(JSON.stringify({ refreshToken: "x" }), CLAVE);
    expect(() => descifrarCredencial(blob, CLAVE)).toThrow();
  });
});
