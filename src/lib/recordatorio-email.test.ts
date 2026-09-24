import { describe, expect, it } from "bun:test";
import {
  citasParaRecordarManana,
  emailRecordatorio,
  fechaDeManana,
  fechaEnZona,
} from "./recordatorio-email";

// Un viernes a las 19:00 de Madrid (17:00Z), cuando corre el cron.
const AHORA = new Date("2026-09-25T17:00:00.000Z");

const base = {
  status: "confirmed",
  reminder_sent_at: null,
  email: "ana@example.com",
};

describe("qué día es mañana para el salón", () => {
  it("la fecha se lee en la hora de Madrid, no en UTC", () => {
    // 23:30Z del 25 ya es el 26 en Madrid.
    expect(fechaEnZona("2026-09-25T23:30:00.000Z")).toBe("2026-09-26");
    expect(fechaEnZona("2026-09-25T21:30:00.000Z")).toBe("2026-09-25");
  });

  it("mañana desde un viernes por la tarde es el sábado", () => {
    expect(fechaDeManana(AHORA)).toBe("2026-09-26");
  });

  it("la noche del cambio de hora no salta ni repite un día", () => {
    // Sábado 24/10/2026 19:00 Madrid → mañana es el domingo 25, el del cambio.
    expect(fechaDeManana(new Date("2026-10-24T17:00:00.000Z"))).toBe("2026-10-25");
    expect(fechaDeManana(new Date("2026-10-25T18:00:00.000Z"))).toBe("2026-10-26");
  });
});

describe("selección de citas a recordar", () => {
  it("solo las confirmadas de mañana con correo y sin recordatorio previo", () => {
    const citas = [
      { id: "manana", start_at: "2026-09-26T08:00:00.000Z", ...base },
      { id: "hoy", start_at: "2026-09-25T18:30:00.000Z", ...base },
      { id: "pasado", start_at: "2026-09-27T08:00:00.000Z", ...base },
      { id: "pendiente", start_at: "2026-09-26T09:00:00.000Z", ...base, status: "pending" },
      { id: "cancelada", start_at: "2026-09-26T09:00:00.000Z", ...base, status: "cancelled" },
      { id: "ya-avisada", start_at: "2026-09-26T10:00:00.000Z", ...base, reminder_sent_at: "2026-09-25T10:00:00.000Z" },
      { id: "sin-correo", start_at: "2026-09-26T11:00:00.000Z", ...base, email: null },
      { id: "correo-vacio", start_at: "2026-09-26T11:00:00.000Z", ...base, email: "  " },
    ];
    expect(citasParaRecordarManana(citas, AHORA).map((c) => c.id)).toEqual(["manana"]);
  });

  it("una cita de mañana a última hora de Madrid también cuenta", () => {
    // 22:00Z del 26 = 00:00 del 27 en Madrid: NO es mañana. 21:30Z sí.
    const citas = [
      { id: "tarde", start_at: "2026-09-26T21:30:00.000Z", ...base },
      { id: "medianoche", start_at: "2026-09-26T22:00:00.000Z", ...base },
    ];
    expect(citasParaRecordarManana(citas, AHORA).map((c) => c.id)).toEqual(["tarde"]);
  });

  it("si el cron corre pasada la medianoche, «mañana» sigue siendo el día siguiente", () => {
    const citas = [{ id: "x", start_at: "2026-09-27T08:00:00.000Z", ...base }];
    expect(citasParaRecordarManana(citas, new Date("2026-09-26T00:30:00.000Z"))).toHaveLength(1);
    expect(citasParaRecordarManana(citas, new Date("2026-09-25T22:30:00.000Z"))).toHaveLength(1);
  });
});

describe("contenido del correo", () => {
  const datos = {
    clientName: "Ana",
    salonName: "PeluChic",
    startISO: "2026-09-26T08:00:00.000Z",
    servicio: "Color",
    direccion: "Calle Mayor 1",
  };

  it("asunto con la hora del salón y cuerpo igual que el WhatsApp", () => {
    const correo = emailRecordatorio(datos);
    expect(correo.asunto).toBe("Recordatorio: tu cita mañana a las 10:00 en PeluChic");
    expect(correo.texto).toContain("Ana");
    expect(correo.texto).toContain("Calle Mayor 1");
    expect(correo.html).toContain("Ana");
  });

  it("el html escapa lo que venga del perfil", () => {
    const correo = emailRecordatorio({ ...datos, salonName: "<b>PeluChic</b>" });
    expect(correo.html).not.toContain("<b>");
    expect(correo.html).toContain("&lt;b&gt;");
  });

  it("menciona la señal solo si está pedida y sin recibir", () => {
    const con = emailRecordatorio({ ...datos, senalPendiente: { importeEur: 10, bizumPhone: "600000000" } });
    expect(con.texto).toContain("10 € por Bizum al 600000000");
    expect(emailRecordatorio(datos).texto).not.toContain("Bizum");
  });
});
