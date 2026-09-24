import { expect, it } from "bun:test";
import { enlaceRecordatorio, mensajeRecordatorio } from "./avisos";

it("prepara día, hora, servicio y dirección sin enviar nada", () => {
  const datos = { clientName: "Ana", salonName: "PeluChic", startISO: "2026-09-25T10:00:00", servicio: "Color", direccion: "Calle Mayor 1" };
  const texto = mensajeRecordatorio(datos);
  expect(texto).toContain("Ana");
  expect(texto).toContain("10:00");
  expect(texto).toContain("Color");
  expect(texto).toContain("Calle Mayor 1");
  expect(texto).not.toContain("Bizum");
  expect(enlaceRecordatorio("+34 611 111 222", datos)).toContain(encodeURIComponent(texto));
});

it("recuerda con amabilidad la señal ya pedida y su plazo", () => {
  const texto = mensajeRecordatorio({ clientName: "Ana", salonName: "PeluChic", startISO: "2026-09-25T10:00:00", servicio: "Color", direccion: "Calle Mayor 1", senalPendiente: { importeEur: 10, bizumPhone: "600000000", deadlineISO: "2026-09-24T18:00:00" } });
  expect(texto).toContain("Si aún no lo has hecho");
  expect(texto).toContain("10 € por Bizum al 600000000");
  expect(texto).toContain("18:00");
});
