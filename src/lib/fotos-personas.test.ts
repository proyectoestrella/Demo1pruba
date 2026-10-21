import { describe, expect, it } from "bun:test";
import { base64DeBytes, bytesDeBase64, idPersonaValido, mimeDeBytes, recorteCuadrado, rutaFoto, validarBytesFoto, MAX_BYTES_FOTO } from "./fotos-personas";
import { comprimirFoto, ErrorFoto, type EntornoImagen } from "./fotos-compresion";

const webp = (n = 40) => { const b = new Uint8Array(n); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return b; };

describe("validación de fotos", () => {
  it("reconoce webp, jpeg y png por la firma", () => {
    expect(mimeDeBytes(webp())).toBe("image/webp");
    expect(mimeDeBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(mimeDeBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(mimeDeBytes(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("rechaza vacío, grande y formato raro", () => {
    expect(validarBytesFoto(new Uint8Array(0))).toEqual({ ok: false, motivo: "vacia" });
    expect(validarBytesFoto(webp(MAX_BYTES_FOTO + 1))).toEqual({ ok: false, motivo: "grande" });
    expect(validarBytesFoto(new Uint8Array([1, 2, 3, 4]))).toEqual({ ok: false, motivo: "formato" });
    expect(validarBytesFoto(webp()).ok).toBe(true);
  });
  it("el id de persona no puede escapar de su carpeta", () => {
    expect(idPersonaValido("c-12")).toBe(true);
    for (const malo of ["", "../x", "a/b", "a..b", " a", "a\\b"]) expect(idPersonaValido(malo)).toBe(false);
  });
  it("ruta con salón, carpeta, persona y uuid", () => {
    expect(rutaFoto("peluchic", "clienta", "c1", "u", "image/webp")).toBe("peluchic/clientas/c1/u.webp");
    expect(rutaFoto("peluchic", "equipo", "e1", "u", "image/jpeg")).toBe("peluchic/equipo/e1/u.jpg");
  });
  it("base64 ida y vuelta y recorte cuadrado centrado", () => {
    const b = webp(100000);
    expect(bytesDeBase64(base64DeBytes(b))).toEqual(b);
    expect(recorteCuadrado(1000, 600)).toEqual({ sx: 200, sy: 0, lado: 600 });
    expect(recorteCuadrado(300, 500)).toEqual({ sx: 0, sy: 100, lado: 300 });
  });
});

describe("compresión en el navegador (canvas simulado)", () => {
  /** Canvas cuyo peso depende de la calidad y del lado: 0.85@512 pesa 400 KB. */
  function entorno(opts: { sinWebp?: boolean; falla?: boolean; ancho?: number; alto?: number } = {}): { e: EntornoImagen; dibujos: Array<[number, number, number, number]> } {
    const dibujos: Array<[number, number, number, number]> = [];
    const e: EntornoImagen = {
      decodificar: async () => {
        if (opts.falla) throw new Error("HEIC");
        return { width: opts.ancho ?? 3000, height: opts.alto ?? 4000, dibujar: (_c, sx, sy, lado, d) => { dibujos.push([sx, sy, lado, d]); } };
      },
      crearCanvas: (lado) => ({
        width: lado, height: lado, getContext: () => ({}),
        toBlob: (cb, tipo, q = 1) => {
          const t = opts.sinWebp && tipo === "image/webp" ? "image/png" : tipo;
          cb(new Blob([new Uint8Array(Math.round(lado * lado * q * 1.5))], { type: t }));
        },
      }),
    };
    return { e, dibujos };
  }
  it("recorta cuadrado centrado y baja calidad hasta ≤150 KB", async () => {
    const { e, dibujos } = entorno();
    const r = await comprimirFoto(new Blob(["x"]), e);
    expect(r.blob.size).toBeLessThanOrEqual(150 * 1024);
    expect(r.mime).toBe("image/webp");
    expect(dibujos[0]).toEqual([0, 500, 3000, 512]);
  });
  it("si el navegador no hace webp, cae a jpeg", async () => {
    const r = await comprimirFoto(new Blob(["x"]), entorno({ sinWebp: true }).e);
    expect(r.mime).toBe("image/jpeg");
  });
  it("error claro si no se puede decodificar o está vacía", async () => {
    await expect(comprimirFoto(new Blob(["x"]), entorno({ falla: true }).e)).rejects.toThrow(ErrorFoto);
    await expect(comprimirFoto(new Blob([]), entorno().e)).rejects.toThrow(/No se puede leer/);
  });
});
