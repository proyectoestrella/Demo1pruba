import { expect, test } from "bun:test";
import { emailCitaCambiada } from "./recordatorio-email";

test("correo de cita cambiada: antes, ahora en hora de Madrid y WhatsApp con 34 (26-oct)", () => {
  const c = emailCitaCambiada({ clientName: "Lucía Pérez", salonName: "PeluChic", antesISO: "2026-10-28T09:00:00Z", nuevaISO: "2026-10-29T15:30:00Z" }, "Europe/Madrid", "666 77 67 31");
  expect(c.asunto).toContain("jueves, 29 de octubre a las 16:30");
  expect(c.texto).toContain("Antes: miércoles, 28 de octubre a las 10:00");
  expect(c.texto).toContain("wa.me/34666776731");
  expect(c.html).not.toContain("<script");
});
