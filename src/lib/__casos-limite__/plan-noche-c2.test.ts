import { describe, expect, it } from "bun:test";

import { buscarClientas } from "../buscar-clientas";
import { duracionDeAgenda } from "../duracion-flexible";
import {
  detectarColumnas,
  leerCsv,
  normalizarDniCif,
  normalizarFechaTpv,
  normalizarTelefono,
  tieneFormaDniCif,
  vistaPreviaClientas,
} from "../importar-clientas";
import { employeesForType } from "../mock/salon";
import type { Appointment, Client } from "../mock/types";
import { ordenarCitasProximasPrimero } from "../orden-citas";
import { profesionalesDisponiblesEnHueco } from "../reparto";
import {
  datosReservaPublicaDesdeCarta,
  haySolape,
  inicioReservaPublicaEsFuturo,
  mensajeErrorReserva,
  profesionalTrabaja,
} from "../reserva-publica";
import { duracionCartaParaSenal, importeSenal, importeSenalTexto, reglaSenal, textoSenalPublico } from "../senal";
import { isoDelSalon } from "../zona-horaria";
import { PELUCHIC } from "../demos/peluchic";

const equipoPeluChic = employeesForType(
  "peluqueria",
  PELUCHIC.team,
  PELUCHIC.teamHours,
  PELUCHIC.openingHours,
  PELUCHIC.teamIds,
  undefined,
  PELUCHIC.serviciosPorProfesional,
);
const FUENTE_RESERVA_PUBLICA = await Bun.file(new URL("../api/salons.functions.ts", import.meta.url)).text();

const disponiblesPeluChic = (
  fecha: string,
  hora: string,
  duracion: number,
  serviceIds: string[],
  appointments: Appointment[] = [],
  serviciosPorProfesional = PELUCHIC.serviciosPorProfesional,
) => profesionalesDisponiblesEnHueco({
  employees: equipoPeluChic,
  appointments,
  dateKey: fecha,
  startMin: Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)),
  durationMin: duracion,
  startISO: isoDelSalon(fecha, hora),
  timeZone: "Europe/Madrid",
  diasEspeciales: PELUCHIC.diasEspeciales,
  bloqueosAgenda: PELUCHIC.bloqueosAgenda,
  serviceIds,
  serviciosPorProfesional,
});

describe("plan noche C2 · regresiones descubiertas", () => {
  it("no propaga NaN ni importes negativos a una fianza visible", () => {
    const fija = reglaSenal({ depositEnabled: true, depositAmountEur: 10 });
    const porcentaje = reglaSenal({ depositEnabled: true, depositMode: "porcentaje", depositPercent: 25 });

    for (const regla of [fija, porcentaje]) {
      expect(importeSenal(regla, { serviceIds: ["corte"], durationMin: Number.NaN, priceEur: Number.NaN })).toBe(0);
      expect(importeSenal(regla, { serviceIds: ["corte"], durationMin: -30, priceEur: -20 })).toBe(0);
    }
    expect(importeSenalTexto(-10)).toBe("0 €");
    expect(textoSenalPublico(fija, { serviceIds: ["corte"], durationMin: 30, priceEur: Number.NaN }, "PeluChic", (n) => `${n} €`)).toBeNull();
  });

  it("importa las fechas europeas de TPV 123 con año de dos cifras", () => {
    expect(normalizarFechaTpv("05/11/85", true)).toBe("1985-11-05");
    expect(normalizarFechaTpv("05-11-26 13:40", true)).toBe("2026-11-05");
  });

  it("rechaza una reserva pública pasada, de medianoche inválida o sin fecha", () => {
    const ahora = new Date("2026-10-17T10:00:00.000Z");
    expect(inicioReservaPublicaEsFuturo("2026-10-17T09:59:59.999Z", ahora)).toBe(false);
    expect(inicioReservaPublicaEsFuturo("2026-10-17T00:00:00.000Z", ahora)).toBe(false);
    expect(inicioReservaPublicaEsFuturo("no es una fecha", ahora)).toBe(false);
    expect(inicioReservaPublicaEsFuturo("2026-10-17T10:00:00.001Z", ahora)).toBe(true);
    expect(mensajeErrorReserva(new Error("RESERVA_PASADA"))).toBe("Esa hora ya ha pasado. Elige otra hora disponible.");
    const guarda = FUENTE_RESERVA_PUBLICA.indexOf("!inicioReservaPublicaEsFuturo(data.startISO)");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(FUENTE_RESERVA_PUBLICA.indexOf("escribirCita(supabase, fila)"));
  });
});

describe("plan noche C2 · fianza por duración de carta", () => {
  const carta = {
    cuarto: { durationMin: 15 },
    media: { durationMin: 30 },
    hora: { durationMin: 60 },
    larga: { durationMin: 120 },
  };
  const porHora = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 5 });

  it("usa la carta para cero, fracciones, combinaciones y servicios desconocidos", () => {
    expect(duracionCartaParaSenal([], carta, 0)).toBe(0);
    expect(duracionCartaParaSenal(["cuarto"], carta, 30)).toBe(15);
    expect(duracionCartaParaSenal(["media", "hora"], carta, 150)).toBe(90);
    expect(duracionCartaParaSenal(["otro"], carta, 47.6)).toBe(48);
    expect(duracionCartaParaSenal(["media", "otro"], carta, 47.6)).toBe(48);
    expect(duracionCartaParaSenal(["hora"], carta, Number.NaN)).toBe(60);
  });

  it("redondea exactamente a euros para cada múltiplo de cinco minutos hasta cuatro horas", () => {
    for (let minutos = 0; minutos <= 4 * 60; minutos += 5) {
      // Tabla independiente: 5 €/h = 500 céntimos/hora, medio euro sube.
      const esperado = Math.floor((500 * minutos + 3_000) / 6_000);
      expect(importeSenal(porHora, { serviceIds: ["x"], durationMin: minutos, priceEur: 0 })).toBe(esperado);
    }
  });

  it("admite tarifa cero y decimal sin superar el redondeo documentado", () => {
    const cero = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 0 });
    const decimal = reglaSenal({ depositEnabled: true, depositMode: "hora", depositHourlyRateEur: 5.25 });
    expect(importeSenal(cero, { serviceIds: ["x"], durationMin: 240, priceEur: 0 })).toBe(0);
    expect(importeSenal(decimal, { serviceIds: ["x"], durationMin: 60, priceEur: 0 })).toBe(5);
    expect(importeSenal(decimal, { serviceIds: ["x"], durationMin: 120, priceEur: 0 })).toBe(11);
  });
});

describe("plan noche C2 · duración flexible y agenda", () => {
  it("bloquea el extremo alto para 15, 30, 60 y 120 minutos, también combinado", () => {
    expect([15, 30, 60, 120].map((min) => duracionDeAgenda(min, true))).toEqual([30, 45, 90, 180]);
    expect(duracionDeAgenda(120, false)).toBe(120);
    expect(datosReservaPublicaDesdeCarta(PELUCHIC, ["lavado", "cortar-caballero-nino"])).toMatchObject({ durationMin: 75 });
  });

  it("no ofrece un servicio por el extremo alto si ya no cabe antes del cierre", () => {
    expect(disponiblesPeluChic("2026-10-20", "19:00", 60, ["peinar"]).length).toBeGreaterThan(0);
    expect(disponiblesPeluChic("2026-10-20", "19:30", 60, ["peinar"])).toEqual([]);
    expect(disponiblesPeluChic("2026-10-17", "13:30", 60, ["peinar"])).toEqual([]);
    expect(disponiblesPeluChic("2026-10-17", "13:30", 30, ["peinar"]).map((p) => p.id)).toEqual(["anca"]);
  });
});

describe("plan noche C2 · reservas que intentan saltarse la agenda", () => {
  it("detecta solapes y deja pasar solo citas contiguas", () => {
    const existente = { start_at: isoDelSalon("2026-10-20", "10:00"), duration_min: 60, status: "confirmed" };
    expect(haySolape(isoDelSalon("2026-10-20", "10:30"), 30, [existente])).toBe(true);
    expect(haySolape(isoDelSalon("2026-10-20", "11:00"), 30, [existente])).toBe(false);
  });

  it("cierra festivos, bloqueos y jornadas personales", () => {
    expect(disponiblesPeluChic("2026-10-12", "10:00", 30, ["peinar"])).toEqual([]);
    expect(disponiblesPeluChic("2026-11-02", "10:00", 30, ["peinar"])).toEqual([]);
    expect(disponiblesPeluChic("2026-10-23", "14:00", 30, ["peinar"])).toEqual([]); // comida del viernes
    expect(profesionalTrabaja(PELUCHIC, "maria", isoDelSalon("2026-10-13", "11:00"), 30)).toBe(false);
    expect(profesionalTrabaja(PELUCHIC, "patricia", isoDelSalon("2026-10-20", "00:00"), 30)).toBe(false);
  });

  it("con «cualquiera» elige solo profesionales habilitadas para todos los servicios", () => {
    expect(disponiblesPeluChic("2026-10-20", "11:00", 60, ["dermapen-facial"]).map((p) => p.id)).toEqual(["patricia"]);
    const nadieHaceEseServicio = { maria: ["peinar"], anca: ["peinar"], patricia: ["peinar"] };
    expect(disponiblesPeluChic("2026-10-20", "11:00", 30, ["sin-asignar"], [], nadieHaceEseServicio)).toEqual([]);
  });

  it("conserva exactamente los minutos reales en los cambios de hora de marzo y octubre", () => {
    for (const [fecha, hora] of [["2026-03-29", "03:00"], ["2026-10-25", "03:00"]]) {
      const inicio = isoDelSalon(fecha, hora);
      const fin = new Date(Date.parse(inicio) + 60 * 60_000).toISOString();
      expect(Date.parse(fin) - Date.parse(inicio)).toBe(60 * 60_000);
    }
  });
});

describe("plan noche C2 · importación TPV 123 hostil", () => {
  it("lee CSV con BOM, separadores, comillas y saltos de línea sin perder los campos", () => {
    const coma = leerCsv('\uFEFFNOMBRE,OBSERVACIONES,MÓVIL\n"Ana O’Ñe","primera línea\nsegunda línea",(+34) 612-345-678\n');
    const puntoYComa = leerCsv("NOMBRE;MÓVIL;EXTRA\nBerta;622 333 444;columna desconocida\n\n");
    expect(coma.filas[0]).toEqual(["Ana O’Ñe", "primera línea\nsegunda línea", "(+34) 612-345-678"]);
    expect(puntoYComa.filas).toHaveLength(1);
    expect(detectarColumnas(["CÓDIGO", "NOMBRE", "APELLIDOS", "MÓVIL", "E-MAIL", "DIRECCIÓN", "F.ALTA", "ÚLT.VISITA", "CUMPLEAÑOS"])).toMatchObject({
      codigo: 0, nombre: 1, apellidos: 2, telefono: 3, email: 4, direccion: 5, alta: 6, ultimaVisita: 7, cumple: 8,
    });
  });

  it("clasifica códigos, teléfonos, correos, fechas y filas parciales sin crear duplicados", () => {
    const existentes: Client[] = [{ id: "ya", name: "Ya Existía", phone: "600000000", createdAt: "2020-01-01", tpvCode: "YA-1" }];
    const tabla = leerCsv(
      "CÓDIGO;NOMBRE;APELLIDOS;MÓVIL;TEL. FIJO;E-MAIL;DNI/CIF;DIRECCIÓN;F.ALTA;ÚLT.VISITA;CUMPLEAÑOS;EXTRA\n"
      + "C-1;Nerea;O'Ñe;(+34) 612-345-678;;nerea@example.test;12 345 678-z;Calle Ñ 1;01/02/26;2026-02-03 10:00;05/11/85;ignorada\n"
      + "C-1;Otra;Ficticia;622333444;;otra@example.test;X-1234567-L;;;;duplicada\n"
      + "C-2;Fija;Válida;;911 222 333;fija@example.test;A1234567B;;;;\n"
      + "C-3;Ocho;Dígitos;61234567;;ocho@example.test;;;;;\n"
      + "C-4;Diez;Dígitos;6123456789;;diez@example.test;;;;;\n"
      + "C-5;Correo;Inválido;633444555;;correo.invalido;;;;;\n"
      + "YA-1;Ya;Existía;600000000;;ya@example.test;;;;;\n"
      + "C-6;;;;;;;;;;;\n",
    );
    const previa = vistaPreviaClientas(tabla, existentes);
    expect([previa.nuevas, previa.duplicadas, previa.errores]).toEqual([2, 2, 4]);
    expect(previa.filas[0]).toMatchObject({
      nombre: "Nerea O'Ñe", telefono: "612345678", taxId: "12345678-Z", tpvAltaDate: "2026-02-01", tpvLastVisit: "2026-02-03", birthday: "1985-11-05", estado: "nueva",
    });
    expect(previa.filas[1]).toMatchObject({ estado: "duplicada", motivo: "Ya está importada con ese código de TPV 123" });
    expect(previa.filas[2]).toMatchObject({ telefono: "911222333", estado: "nueva" });
    expect(previa.filas.slice(3).map((f) => f.estado)).toEqual(["error", "error", "error", "duplicada", "error"]);
    expect(previa.filas[7]).toMatchObject({ motivo: "Falta el nombre" });
  });

  it("normaliza formatos TPV sin aceptar fechas imposibles ni teléfonos deformados", () => {
    expect(normalizarTelefono("+34 612 345 678")).toBe("612345678");
    expect(normalizarTelefono("0034 612-345-678")).toBe("612345678");
    expect(normalizarTelefono("(612) 345 678")).toBe("612345678");
    expect(normalizarFechaTpv("45123.75")).toBe("2023-07-16");
    expect(normalizarFechaTpv("31/02/2026")).toBeUndefined();
    expect(normalizarFechaTpv("05/11", true)).toBeUndefined();
    expect(normalizarDniCif(" x-1234567-l ")).toBe("X-1234567-L");
    expect(tieneFormaDniCif("X-1234567-L")).toBe(true);
    expect(tieneFormaDniCif("A1234567B")).toBe(true);
  });
});

describe("plan noche C2 · rendimiento con datos ficticios", () => {
  it("mantiene importación, citas y búsqueda por debajo de los objetivos", () => {
    const existentes: Client[] = Array.from({ length: 600 }, (_, i) => ({
      id: `existente-${i}`,
      name: `Existente ficticia ${i}`,
      phone: `6${String(i).padStart(8, "0")}`,
      createdAt: "2026-01-01",
      tpvCode: `ANT-${i}`,
    }));
    const csv = ["Código;Nombre;Móvil;E-mail", ...Array.from({ length: 1_500 }, (_, i) =>
      `C2-${i};Importada ficticia ${i};6${String(10_000_000 + i)};importada-${i}@example.test`,
    )].join("\n");
    const tabla = leerCsv(csv);
    const inicioImportacion = performance.now();
    const previa = vistaPreviaClientas(tabla, existentes);
    const msImportacion = performance.now() - inicioImportacion;
    expect(previa.nuevas).toBe(1_500);
    expect(msImportacion).toBeLessThan(300);

    const ahora = new Date("2026-10-17T10:00:00.000Z");
    const citas = Array.from({ length: 3_300 }, (_, i) => ({
      start: new Date(Date.UTC(2025, 0, 1) + ((i * 7_919) % (1_100 * 24 * 60 * 60_000))).toISOString(),
      duration: 15 + (i % 8) * 15,
    }));
    const inicioOrden = performance.now();
    const ordenadas = ordenarCitasProximasPrimero(citas, ahora);
    const msOrden = performance.now() - inicioOrden;
    expect(ordenadas).toHaveLength(3_300);
    expect(msOrden).toBeLessThan(50);

    const buscables: Client[] = Array.from({ length: 1_500 }, (_, i) => ({
      id: `buscar-${i}`,
      name: `Clienta ficticia C2 ${i}`,
      phone: `6${String(20_000_000 + i)}`,
      createdAt: "2026-01-01",
      notes: i % 5 === 0 ? "Nota ficticia de color" : undefined,
    }));
    const inicioBusqueda = performance.now();
    const encontradas = buscarClientas("C2 1499", { clientes: buscables, citas: [] });
    const msBusqueda = performance.now() - inicioBusqueda;
    expect(encontradas.map((c) => c.id)).toEqual(["buscar-1499"]);
    expect(msBusqueda).toBeLessThan(30);

    console.info(`[C2 rendimiento] importación ${msImportacion.toFixed(2)} ms · citas ${msOrden.toFixed(2)} ms · búsqueda ${msBusqueda.toFixed(2)} ms`);
  });
});
