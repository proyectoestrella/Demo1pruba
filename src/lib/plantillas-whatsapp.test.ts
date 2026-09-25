import { describe, expect, test } from "bun:test";
import { mensajeRecordatorio } from "./avisos";
import { mensajeConfirmacionDe, mensajeRecordatorioDe, rellenar } from "./plantillas-whatsapp";

const r = { clientName: "Lucía", salonName: "PeluChic", startISO: "2026-09-26T10:30:00", servicio: "Corte y peinado", direccion: "Calle Mayor 1", profesional: "Sara" };

describe("plantillas de WhatsApp", () => {
  test("sin plantilla, el recordatorio es exactamente el de siempre", () => {
    expect(mensajeRecordatorioDe(undefined, r)).toBe(mensajeRecordatorio(r));
    expect(mensajeRecordatorioDe("   ", r)).toBe(mensajeRecordatorio(r));
  });
  test("con plantilla, cambia los marcadores y deja los desconocidos", () => {
    const m = mensajeRecordatorioDe("¡Hola {nombre}! Te vemos {cuando} con {profesional} en {salon}. {otro}", r);
    expect(m).toContain("¡Hola Lucía!");
    expect(m).toContain("con Sara en PeluChic");
    expect(m).toContain("{otro}");
    expect(m).not.toContain("{cuando}");
  });
  test("si la señal sigue pendiente, se añade su frase aunque la plantilla sea propia", () => {
    const m = mensajeRecordatorioDe("Hola {nombre}.", { ...r, senalPendiente: { importeEur: 20, bizumPhone: "600111222" } });
    expect(m).toBe("Hola Lucía. Si aún no lo has hecho, puedes enviarnos la señal de 20 € por Bizum al 600111222.");
  });
  test("confirmación: texto por defecto o el de la dueña", () => {
    const d = { nombre: "Lucía", salon: "PeluChic", startISO: r.startISO, servicio: "Tinte", profesional: "Sara", direccion: "Calle Mayor 1" };
    expect(mensajeConfirmacionDe(undefined, d)).toContain("tu cita en PeluChic queda confirmada");
    expect(mensajeConfirmacionDe("Listo, {nombre}: {servicio}.", d)).toBe("Listo, Lucía: Tinte.");
    expect(rellenar("  a   b ", d)).toBe("a b");
  });
});
