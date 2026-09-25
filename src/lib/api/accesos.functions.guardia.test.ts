import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const fuente = readFileSync(new URL("./accesos.functions.ts", import.meta.url), "utf8");
const cuerpos = [
  ...fuente.matchAll(/export const (\w+) = createServerFn[\s\S]*?(?=\nexport const |\s*$)/g),
].map((m) => ({ nombre: m[1], cuerpo: m[0] }));

describe("guardia de accesos.functions", () => {
  it("todas pasan por accesoReal (sin demo, con permiso de gestión) salvo aceptar, que va por el token", () => {
    expect(cuerpos.length).toBe(9);
    for (const { nombre, cuerpo } of cuerpos) {
      if (nombre === "aceptarInvitacionAlSalon") expect(cuerpo).toContain("usuarioDeLaPeticion()");
      else expect([nombre, cuerpo.includes("await accesoReal(data.slug)")]).toEqual([nombre, true]);
    }
  });
  it("la service role no sale del servidor: el fichero no se importa desde componentes", () => {
    expect(fuente).toContain("auth.admin.inviteUserByEmail");
  });
});
