import { describe, expect, it } from "bun:test";
import {
  construirEnlaceGoogleCalendar,
  construirIcs,
  construirIcsDataUri,
  esDispositivoApple,
  type DatosCita,
} from "@/lib/calendario";

const datos: DatosCita = {
  fecha: "2026-09-25",
  hora: "10:00",
  duracionMin: 45,
  servicio: "Corte + Barba",
  salon: "Barber Hamza for Men",
  direccion: "Calle Mayor, 12, Madrid",
};

// TZ=Europe/Madrid en 25-sep-2026 está en verano (CEST, UTC+2), así que
// 10:00 local == 08:00 UTC.
describe("construirEnlaceGoogleCalendar", () => {
  it("formatea fechas en Europe/Madrid a UTC correctamente", () => {
    const url = construirEnlaceGoogleCalendar(datos);
    expect(url).toContain("dates=20260925T080000Z%2F20260925T084500Z");
  });

  it("incluye el resumen, la dirección y la zona horaria", () => {
    const url = construirEnlaceGoogleCalendar(datos);
    const params = new URL(url).searchParams;
    expect(params.get("text")).toBe("Corte + Barba en Barber Hamza for Men");
    expect(params.get("location")).toBe("Calle Mayor, 12, Madrid");
    expect(params.get("ctz")).toBe("Europe/Madrid");
    expect(params.get("action")).toBe("TEMPLATE");
  });

  it("calcula la duración correcta en el rango de fechas", () => {
    const url = construirEnlaceGoogleCalendar(datos);
    const rango = new URL(url).searchParams.get("dates")!;
    const [ini, fin] = rango.split("/");
    const msIni = Date.parse(ini.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"));
    const msFin = Date.parse(fin.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"));
    expect((msFin - msIni) / 60_000).toBe(45);
  });

  it("usa la URL base correcta de Google Calendar", () => {
    const url = construirEnlaceGoogleCalendar(datos);
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
  });
});

describe("construirIcs", () => {
  it("genera un VEVENT con DTSTART/DTEND en UTC bien formateados", () => {
    const ics = construirIcs(datos);
    expect(ics).toContain("DTSTART:20260925T080000Z");
    expect(ics).toContain("DTEND:20260925T084500Z");
  });

  it("escapa comas, puntos y coma y barras invertidas en los campos de texto", () => {
    const conCaracteres: DatosCita = {
      ...datos,
      servicio: "Corte, barba; y peinado",
      direccion: "Calle Mayor, 12; 2º B",
    };
    const ics = construirIcs(conCaracteres);
    expect(ics).toContain("SUMMARY:Corte\\, barba\\; y peinado en Barber Hamza for Men");
    expect(ics).toContain("LOCATION:Calle Mayor\\, 12\\; 2º B");
  });

  it("incluye los campos obligatorios de VCALENDAR/VEVENT", () => {
    const ics = construirIcs(datos);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Corte + Barba en Barber Hamza for Men");
    expect(ics).toContain("LOCATION:Calle Mayor\\, 12\\, Madrid");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});

describe("construirIcsDataUri", () => {
  it("devuelve un data: URI con text/calendar y el .ics codificado", () => {
    const uri = construirIcsDataUri(datos);
    expect(uri.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);
    const decoded = decodeURIComponent(uri.slice("data:text/calendar;charset=utf-8,".length));
    expect(decoded).toContain("BEGIN:VCALENDAR");
    expect(decoded).toContain("DTSTART:20260925T080000Z");
  });
});

describe("esDispositivoApple", () => {
  it("detecta iPhone", () => {
    expect(
      esDispositivoApple(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(true);
  });

  it("detecta iPad", () => {
    expect(esDispositivoApple("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
  });

  it("no detecta Android", () => {
    expect(
      esDispositivoApple("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36"),
    ).toBe(false);
  });

  it("no detecta escritorio", () => {
    expect(
      esDispositivoApple("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
    ).toBe(false);
  });
});
