import { expect, test } from "bun:test";
import { emailCitaCambiada } from "./recordatorio-email";

test("correo de cita cambiada: antes, ahora en hora de Madrid y WhatsApp con 34 (26-oct)", () => {
  const c = emailCitaCambiada({ clientName: "Lucía Pérez", salonName: "PeluChic", antesISO: "2026-10-28T09:00:00Z", nuevaISO: "2026-10-29T15:30:00Z" }, "Europe/Madrid", "666 77 67 31");
  expect(c.asunto).toContain("jueves, 29 de octubre a las 16:30");
  expect(c.texto).toContain("Antes: miércoles, 28 de octubre a las 10:00");
  expect(c.texto).toContain("wa.me/34666776731");
  expect(c.html).not.toContain("<script");
});

test("debeAvisarCambioDeCita: deshacer, vuelta a la hora conocida y cambios reales (26-oct tarde)", async () => {
  const { debeAvisarCambioDeCita } = await import("./recordatorio-email");
  const ahora = new Date("2026-10-26T10:00:00Z");
  const base = { antesISO: "2026-10-28T09:00:00Z", nuevaISO: "2026-10-28T10:00:00Z", ahora };
  expect(debeAvisarCambioDeCita(base)).toBe(true);
  expect(debeAvisarCambioDeCita({ ...base, deshacer: true })).toBe(false);
  // Se le avisó de las 11:00 y se deshace a las 10:00: hay que decírselo.
  expect(debeAvisarCambioDeCita({ ...base, deshacer: true, avisadaISO: "2026-10-28T11:00:00Z" })).toBe(true);
  expect(debeAvisarCambioDeCita({ ...base, deshacer: true, avisadaISO: "2026-10-28T10:00:00Z" })).toBe(false);
  // Se avisó de las 10:00; ahora vuelve a las 10:00 tras un arrastre intermedio: no se repite.
  expect(debeAvisarCambioDeCita({ antesISO: "2026-10-28T11:00:00Z", nuevaISO: "2026-10-28T10:00:00Z", avisadaISO: "2026-10-28T10:00:00Z", ahora })).toBe(false);
  // Vuelve a la hora original de la que nunca se avisó otra: tampoco.
  expect(debeAvisarCambioDeCita({ antesISO: "2026-10-28T09:00:00Z", nuevaISO: "2026-10-28T09:00:00Z", ahora })).toBe(false);
  expect(debeAvisarCambioDeCita({ ...base, estado: "cancelled" })).toBe(false);
  expect(debeAvisarCambioDeCita({ ...base, nuevaISO: "2026-10-20T10:00:00Z" })).toBe(false);
});
