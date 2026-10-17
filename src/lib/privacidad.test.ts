import { expect, test } from "bun:test";
import { contactoDerechosPrivacidad, responsablePrivacidad } from "./privacidad";

test("el correo de privacidad tiene prioridad y el teléfono es el respaldo", () => {
  expect(contactoDerechosPrivacidad({ correoPrivacidad: "derechos@example.test", phone: "600 111 222" })).toBe("derechos@example.test");
  expect(contactoDerechosPrivacidad({ phone: "600 111 222" })).toBe("600 111 222");
});

test("identifica al responsable con NIF/CIF solo cuando está informado", () => {
  expect(responsablePrivacidad({ name: "PeluChic", nifResponsable: "NIF-PRUEBA" })).toBe("PeluChic (NIF NIF-PRUEBA)");
  expect(responsablePrivacidad({ name: "PeluChic" })).toBe("PeluChic");
});
