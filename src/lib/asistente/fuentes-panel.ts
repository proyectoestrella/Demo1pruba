import type { Appointment, Client, Employee, SalonProfile, Service, WaitlistEntry } from "../mock/types";
import type { CitaA, FichaA, FuentesAsistente, HuecoA, JornadaA, PlanSishow } from "./fuentes";
import { fichaDeClienta } from "../ficha-clienta";
import { duracionRecordada } from "../derive";
import { citasDeCalendario, huecosDe, mismoDia } from "../calendario-arena";
import { franjasProfesional } from "../horario-equipo";
import { resumenHorario } from "../horario-resumen";
import { parseRanges } from "../opening-hours";
import { estadoSenal, reglaSenal, respuestaFaqSenal, vencimientoSenal } from "../senal";
import { preguntasAplicables, preguntasDelSalon } from "../preguntas-reserva";
import { inferBusinessType } from "../business-type";
import { recargoActivo } from "../recargo-activo";
import { duracionFlexibleActiva } from "../duracion-flexible";
import { isBookingBlocked } from "../no-show";
import { indiceColorServicio } from "../hoy-arena";
import { colorElegidoProfesional } from "../colores-elegidos";
import { buildCampanas, calcularHuecoFlojo, resumenDelMes } from "../campanas";
import { DIAS_SEGUNDA_VISITA, DIAS_RESENA } from "../campanas";
import { comparar, resumenDePeriodo } from "../periodos";

/**
 * Adaptador de esta rama a la interfaz `FuentesAsistente` de BACKEND
 * (src/lib/asistente/fuentes.ts, commit b90796f de codex/peluchic-backend).
 * El motor no importa nada de aquí: lo recibe inyectado. Lee la store en
 * cada pregunta (`leer()`), así ve la cita creada hace un segundo.
 */
export interface EstadoPanel {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  waitlist: WaitlistEntry[];
  salonProfile: SalonProfile;
  realSalonSlug: string | null;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const deDia = (dia: string) => {
  const [y, m, d] = dia.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const iso = (dia: Date, min: number) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Math.floor(min / 60), min % 60).toISOString();

/** Colores en palabras, como los ve la dueña en el calendario. */
const COLOR_SERVICIO = ["", "azul cielo", "lavanda", "verde menta", "rosa", "melocotón", "amarillo"];
const COLOR_PROFESIONAL = ["", "melocotón", "salvia", "lavanda", "cielo"];

export function crearFuentesPanel(
  leer: () => EstadoPanel,
  equipo: () => Employee[],
  opciones: { plan?: PlanSishow | (() => PlanSishow); enlace?: () => string | null; ahora?: () => Date } = {},
): FuentesAsistente {
  const ahora = () => opciones.ahora?.() ?? new Date();
  const perfil = () => leer().salonProfile;
  return {
    estado() {
      const s = leer();
      return {
        salonNombre: s.salonProfile.name,
        plan: (typeof opciones.plan === "function" ? opciones.plan() : opciones.plan) ?? "reservas-asistente",
        ahora: ahora(),
        timeZone: "Europe/Madrid",
        citas: s.appointments,
        clientas: s.clients,
        equipo: equipo().map((e) => ({ id: e.id, name: e.name })),
        servicios: s.services,
        listaEspera: s.waitlist,
      };
    },

    fichaClienta(clientaId) {
      const s = leer();
      if (!s.clients.some((c) => c.id === clientaId)) return null;
      const f = fichaDeClienta(clientaId, { citas: s.appointments, clientes: s.clients, servicios: s.services, equipo: equipo(), ahora: ahora() });
      const proxima = s.appointments.find((a) => a.clientId === clientaId && a.start === f.resumen.proximaCita);
      const nombreServicio = (id: string) => s.services.find((x) => x.id === id)?.name ?? id;
      const ficha: FichaA = {
        visitas: f.visitas.map((v) => ({ fecha: v.fecha, servicios: v.servicios, profesional: v.profesional, importe: v.importe, duracion: v.duracion })),
        ultimoColor: f.resumen.ultimoColor ?? null,
        frecuenciaMediaDias: f.resumen.frecuenciaMediaDias ?? null,
        gastoTotal: f.resumen.gastoTotal,
        gastoUltimos12Meses: f.resumen.gastoUltimos12Meses,
        profesionalHabitual: f.resumen.profesionalHabitual ?? null,
        proximaCita: proxima
          ? { fecha: proxima.start, servicios: proxima.serviceIds.map(nombreServicio), profesional: equipo().find((e) => e.id === proxima.employeeId)?.name ?? "" }
          : null,
        avisos: f.avisos,
        duracionRecordada: (serviceIds) => {
          const carta = serviceIds.reduce((t, id) => t + (s.services.find((x) => x.id === id)?.durationMin ?? 0), 0);
          return duracionRecordada(s.appointments, clientaId, serviceIds, carta)?.minutos ?? null;
        },
      };
      return ficha;
    },

    // El mismo cálculo que Analítica: compara solo si hay periodo previo y el salón no está cerrado.
    resumenPeriodo({ tipo, desde, hasta }) {
      const r = resumenDePeriodo(leer().appointments, tipo, equipo(), ahora(), tipo === "personalizado" && desde && hasta ? { desde, hasta } : null);
      const ok = r.hayComparacion && !r.cerrado;
      const oc = comparar(r.actual.ocupacion ?? 0, ok ? r.previo.ocupacion : null);
      return {
        citas: r.actual.citas,
        citasPrevias: ok ? r.previo.citas : null,
        variacionCitas: ok ? comparar(r.actual.citas, r.previo.citas).variacionPct : null,
        ocupacion: r.actual.ocupacion,
        ocupacionPrevia: ok ? r.previo.ocupacion : null,
        variacionOcupacion: r.actual.ocupacion === null ? null : oc.variacionPct,
        parcial: r.parcial,
      };
    },

    huecos(dia, o = {}) {
      const s = leer();
      const d = deDia(dia);
      const delDia = citasDeCalendario(s.appointments, d);
      const n = ahora();
      const desde = mismoDia(d, n) ? Math.ceil((n.getHours() * 60 + n.getMinutes()) / 5) * 5 : undefined;
      const lista: HuecoA[] = equipo()
        .filter((e) => !o.profesionalId || e.id === o.profesionalId)
        .flatMap((e) => huecosDe(delDia, e, d.getDay(), { desde }).map((t) => ({ profesionalId: e.id, desde: iso(d, t.ini), hasta: iso(d, t.fin), minutos: t.fin - t.ini })))
        .filter((h) => h.minutos >= (o.minMinutos ?? 30));
      return lista.sort((a, b) => +new Date(a.desde) - +new Date(b.desde));
    },

    jornada(profesionalId, dia) {
      const e = equipo().find((x) => x.id === profesionalId);
      if (!e) return null;
      const franjas = franjasProfesional(e, deDia(dia).getDay());
      return { trabaja: franjas.length > 0, franjas: franjas.map((f) => ({ desde: hhmm(f.start), hasta: hhmm(f.end) })) };
    },

    horarioResumen(profesionalId) {
      const p = perfil();
      if (!profesionalId) return resumenHorario(p.openingHours);
      const i = equipo().findIndex((e) => e.id === profesionalId);
      return i < 0 ? null : resumenHorario((p.teamHours?.[i] ?? p.openingHours) as string[]);
    },

    aperturaDelDia(dia) {
      const idx = (deDia(dia).getDay() + 6) % 7;
      const franjas = parseRanges(perfil().openingHours[idx]);
      const j: JornadaA = { trabaja: franjas.length > 0, franjas: franjas.map((f) => ({ desde: hhmm(f.start), hasta: hhmm(f.end) })) };
      return j;
    },

    senal: {
      regla() {
        const r = reglaSenal(perfil());
        if (!r.activa) return { activa: false, resumen: "Sin señal" };
        const cuanto = r.modo === "porcentaje" ? `el ${r.porcentaje} % del servicio` : `${r.importeFijoEur} €`;
        const aQuien = { todas: "en todas las reservas", nuevas: "a las clientas nuevas", duracion: `en los servicios de ${r.minutosMinimos} min o más`, servicios: "en algunos servicios" }[r.aplicaA];
        return { activa: true, resumen: `${cuanto} ${aQuien}, con ${r.ventanaHoras} h de plazo` };
      },
      estado(cita: CitaA) {
        const s = leer();
        const real = s.appointments.find((a) => a.id === cita.id);
        if (!real) return null;
        const r = reglaSenal(s.salonProfile);
        return {
          estado: estadoSenal(real, ahora()),
          importeEur: real.depositEur ?? undefined,
          venceISO: vencimientoSenal(real, r.ventanaHoras) ?? undefined,
          recibidaEur: real.depositReceivedEur ?? undefined,
        };
      },
      politicaCancelacion() {
        return respuestaFaqSenal(reglaSenal(perfil()), (n) => `${n} €`);
      },
    },

    preguntasReserva(serviceIds) {
      const lista = preguntasDelSalon(perfil(), inferBusinessType(perfil().tagline, perfil().name));
      return (serviceIds?.length ? preguntasAplicables(lista, serviceIds) : lista.filter((q) => q.activa)).map((q) => q.texto);
    },
    recargo() {
      const p = perfil();
      return { activo: recargoActivo(p), eur: p.noShowFeeEur ?? undefined, horasAviso: p.noShowNoticeHours ?? undefined };
    },
    duracionFlexible() {
      return duracionFlexibleActiva(perfil(), null, !!leer().realSalonSlug);
    },
    plantillas() {
      return perfil().plantillas ?? {};
    },
    enlaceReservas() {
      return opciones.enlace?.() ?? null;
    },
    calendarioSuscrito() {
      // La suscripción existe solo en un salón real; si hay enlace creado, no se sabe desde aquí.
      return leer().realSalonSlug ? null : false;
    },
    colores() {
      const s = leer();
      const eq = equipo();
      return {
        servicios: Object.fromEntries(s.services.map((x) => [x.name, COLOR_SERVICIO[indiceColorServicio(x.id, s.services)] ?? ""])),
        profesionales: Object.fromEntries(eq.map((e, i) => [e.name, COLOR_PROFESIONAL[colorElegidoProfesional(e.id) ?? (i % 4) + 1]])),
      };
    },
    bloqueo(clientaId) {
      const s = leer();
      const c = s.clients.find((x) => x.id === clientaId);
      if (!c) return null;
      const bloqueada = isBookingBlocked(c, s.salonProfile, ahora());
      return { bloqueada, motivo: bloqueada ? (c.manualBlock ? "bloqueada a mano" : "recargo pendiente") : undefined };
    },

    marketing: (() => {
      const campanas = () => {
        const s = leer();
        return buildCampanas({ appointments: s.appointments, clients: s.clients, services: s.services, employees: equipo(), salonName: s.salonProfile.name, salonAddress: s.salonProfile.address, now: ahora() });
      };
      return {
        campanas: () => campanas().map((c) => ({ titulo: c.titulo, personas: c.personas.length, motivo: c.resumenAQuien })),
        recuperables: () => {
          const r = resumenDelMes(campanas());
          return { clientas: r.recuperables, huecos: r.huecos };
        },
        franjaFloja: () => {
          // La ocupación real de la franja más floja, la misma que usa la campaña «Llena los…».
          const f = calcularHuecoFlojo(leer().appointments, equipo(), ahora());
          return f ? { etiqueta: `${f.diaLabel} por la ${f.franjaLabel}`, pct: f.ocupacionPct } : null;
        },
        segundaVisita: () => {
          const c = campanas().find((x) => x.id === "segunda-visita");
          return c ? { personas: c.personas.length, dias: DIAS_SEGUNDA_VISITA } : null;
        },
        resenas: () => {
          const c = campanas().find((x) => x.id === "resena");
          return c ? { personas: c.personas.length, dias: DIAS_RESENA } : null;
        },
      };
    })(),
  };
}
