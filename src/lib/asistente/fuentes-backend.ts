/**
 * Adaptador de BACKEND: FuentesAsistente sobre los datos de la store de esta
 * rama (Appointment, Client, Employee, Service, WaitlistEntry, SalonProfile).
 * FRONTEND tiene el suyo (fuentes-panel.ts). Lo que esta rama no sabe calcular
 * devuelve `null` y va marcado CONECTAR: el motor dice «eso no lo tengo».
 */
import { mensajeRecordatorio } from "../avisos";
import { inferBusinessType } from "../business-type";
import { buildCampanas, resumenDelMes, segundaVisita as campSegunda, resenaTrasLaCita, DIAS_RESENA, DIAS_SEGUNDA_VISITA } from "../campanas";
import { fichaDeClienta } from "../ficha-clienta";
import { franjasProfesional } from "../horario-equipo";
import type { Appointment, Client, Employee, SalonProfile, Service, WaitlistEntry } from "../mock/types";
import { isBookingBlocked } from "../no-show";
import { parseRanges } from "../opening-hours";
import { comparar, resumenDePeriodo } from "../periodos";
import { isPenaltyActive } from "../plantones";
import { preguntasAplicables, preguntasDelSalon } from "../preguntas-reserva";
import { recargoActivo } from "../recargo-activo";
import { estadoSenal, reglaSenal, resumenCancelacionSenal, vencimientoSenal } from "../senal";
import { isoDelSalon, zonaDelSalon } from "../zona-horaria";
import { diaEnZona, minutoEnZona } from "./reloj";
import { diaSemana, sumarDias } from "./entidades";
import type { CitaA, FuentesAsistente, HuecoA, JornadaA, PlanSishow } from "./fuentes";
import { euros } from "./resolutores/tipos";

export interface DatosBackend {
  citas: Appointment[];
  clientes: Client[];
  equipo: Employee[];
  servicios: Service[];
  listaEspera: WaitlistEntry[];
  perfil: SalonProfile;
  ahora?: Date;
  /** Enlace público ya resuelto (usePanelPublicLink en el panel). */
  enlace?: string | null;
  plan?: PlanSishow;
  /** ¿El salón tiene activa la suscripción de calendario? CONECTAR: el token vive en el servidor. */
  calendarioSuscrito?: boolean | null;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const ABREV = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** «Mar–Vie 10:00–20:00 · Sáb 9:00–14:00» a partir de 7 cadenas lunes→domingo. */
export function resumenSemana(dias: string[]): string | null {
  const txt = dias.map((d) => parseRanges(d).map((r) => `${hhmm(r.start).replace(/^0/, "")}–${hhmm(r.end)}`).join(", "));
  if (txt.every((t) => !t)) return null;
  const grupos: Array<{ desde: number; hasta: number; t: string }> = [];
  txt.forEach((t, i) => {
    if (!t) return;
    const g = grupos[grupos.length - 1];
    if (g && g.t === t && g.hasta === i - 1) g.hasta = i;
    else grupos.push({ desde: i, hasta: i, t });
  });
  return grupos.map((g) => `${ABREV[g.desde]}${g.hasta > g.desde ? `–${ABREV[g.hasta]}` : ""} ${g.t}`).join(" · ");
}

export function crearFuentesBackend(d: DatosBackend): FuentesAsistente {
  const tz = zonaDelSalon(d.perfil);
  const ahora = () => d.ahora ?? new Date();
  const regla = () => reglaSenal(d.perfil);
  const porId = new Map(d.citas.map((c) => [c.id, c]));
  let porClienta: Map<string, Appointment[]> | null = null;
  /** Citas de una clienta (fichaDeClienta filtra por ella: pasarle solo las suyas ahorra recorrer toda la agenda). */
  const citasDe = (clientId: string): Appointment[] => {
    if (!porClienta) {
      porClienta = new Map();
      for (const c of d.citas) {
        let l = porClienta.get(c.clientId);
        if (!l) porClienta.set(c.clientId, (l = []));
        l.push(c);
      }
    }
    return porClienta.get(clientId) ?? [];
  };
  let indice: Map<string, Appointment[]> | null = null;
  /** Citas que ocupan agenda (ni anuladas ni plantones), por día del salón. */
  const ocupanDia = (dia: string): Appointment[] => {
    if (!indice) {
      indice = new Map();
      for (const c of d.citas) {
        if (c.status === "cancelled" || c.status === "no-show") continue;
        const k = diaEnZona(c.start, tz);
        let l = indice.get(k);
        if (!l) indice.set(k, (l = []));
        l.push(c);
      }
    }
    return indice.get(dia) ?? [];
  };
  const empleado = (id: string) => d.equipo.find((e) => e.id === id);
  /** getDay() del día (0 = domingo), para franjasProfesional. */
  const getDay = (dia: string) => diaSemana(dia);

  const jornada = (profesionalId: string, dia: string): JornadaA | null => {
    const e = empleado(profesionalId);
    if (!e) return null;
    const f = franjasProfesional(e, getDay(dia));
    return { trabaja: f.length > 0, franjas: f.map((r) => ({ desde: hhmm(r.start), hasta: hhmm(r.end) })) };
  };

  const huecos = (dia: string, o: { profesionalId?: string; minMinutos?: number } = {}): HuecoA[] | null => {
    const min = o.minMinutos ?? 30;
    const out: HuecoA[] = [];
    const equipo = o.profesionalId ? d.equipo.filter((e) => e.id === o.profesionalId) : d.equipo;
    const delDia = ocupanDia(dia);
    for (const e of equipo) {
      const citas = delDia.filter((c) => c.employeeId === e.id).map((c) => ({ a: Date.parse(c.start), b: Date.parse(c.start) + c.duration * 60_000 })).sort((x, y) => x.a - y.a);
      for (const r of franjasProfesional(e, getDay(dia))) {
        let cur = Date.parse(isoDelSalon(dia, hhmm(r.start), tz));
        const finFranja = Date.parse(isoDelSalon(dia, hhmm(r.end), tz));
        for (const c of citas) {
          if (c.b <= cur || c.a >= finFranja) continue;
          if (c.a - cur >= min * 60_000) out.push({ profesionalId: e.id, desde: new Date(cur).toISOString(), hasta: new Date(c.a).toISOString(), minutos: Math.round((c.a - cur) / 60_000) });
          cur = Math.max(cur, c.b);
        }
        if (finFranja - cur >= min * 60_000) out.push({ profesionalId: e.id, desde: new Date(cur).toISOString(), hasta: new Date(finFranja).toISOString(), minutos: Math.round((finFranja - cur) / 60_000) });
      }
    }
    return out.sort((a, b) => a.desde.localeCompare(b.desde));
  };

  /** Memoriza un cálculo pesado durante el cuarto de hora de «ahora». */
  function porTramo<T>(f: () => T): () => T {
    let c: { tramo: number; v: T } | null = null;
    return () => {
      const tramo = Math.floor(ahora().getTime() / 900_000);
      if (!c || c.tramo !== tramo) c = { tramo, v: f() };
      return c.v;
    };
  }

  // buildCampanas recorre toda la agenda (~90 ms con 3.300 citas): se calcula
  // una vez por cuarto de hora, no en cada pregunta.
  let campCache: { tramo: number; v: ReturnType<typeof buildCampanas> } | null = null;
  const campanas = () => {
    const tramo = Math.floor(ahora().getTime() / 900_000);
    if (!campCache || campCache.tramo !== tramo) {
      campCache = { tramo, v: buildCampanas({ appointments: d.citas, clients: d.clientes, services: d.servicios, employees: d.equipo, salonName: d.perfil.name, salonAddress: d.perfil.address, now: ahora(), timeZone: tz }) };
    }
    return campCache.v;
  };

  return {
    estado: () => ({
      salonNombre: d.perfil.name,
      plan: d.plan ?? (d.perfil as { plan?: PlanSishow }).plan ?? "reservas-asistente",
      ahora: ahora(),
      timeZone: tz,
      citas: d.citas as CitaA[],
      clientas: d.clientes.map((c) => ({ ...c, penaltyEur: isPenaltyActive(c, ahora()) ? c.penaltyEur : 0 })),
      equipo: d.equipo,
      servicios: d.servicios,
      listaEspera: d.listaEspera.map((w) => ({ ...w, preferredEmployeeId: w.preferredEmployeeId === "any" ? undefined : w.preferredEmployeeId })),
    }),

    fichaClienta: (id) => {
      if (!d.clientes.some((c) => c.id === id)) return null;
      const f = fichaDeClienta(id, { citas: citasDe(id), clientes: d.clientes, servicios: d.servicios, equipo: d.equipo, ahora: ahora() });
      const prox = f.resumen.proximaCita ? d.citas.find((c) => c.clientId === id && c.start === f.resumen.proximaCita) : undefined;
      return {
        visitas: f.visitas.map((v) => ({ fecha: v.fecha, servicios: v.servicios, profesional: v.profesional, importe: v.importe, duracion: v.duracion })),
        ultimoColor: f.resumen.ultimoColor ?? null,
        frecuenciaMediaDias: f.resumen.frecuenciaMediaDias ?? null,
        gastoTotal: f.resumen.gastoTotal,
        gastoUltimos12Meses: f.resumen.gastoUltimos12Meses,
        profesionalHabitual: f.resumen.profesionalHabitual ?? null,
        proximaCita: prox ? { fecha: prox.start, servicios: prox.serviceIds.map((s) => d.servicios.find((x) => x.id === s)?.name ?? s), profesional: empleado(prox.employeeId)?.name ?? "" } : null,
        avisos: f.avisos.filter((a) => !a.startsWith("Observaciones:")),
        duracionRecordada: (ids) => {
          const v = f.visitas.find((x) => {
            const c = porId.get(x.id);
            return !!c && ids.every((s) => c.serviceIds.includes(s));
          });
          return v?.duracion ?? null;
        },
      };
    },

    resumenPeriodo: ({ tipo, desde, hasta }) => {
      const r = resumenDePeriodo(d.citas, tipo, d.equipo, ahora(), tipo === "personalizado" && desde && hasta ? { desde, hasta } : null, undefined, tz);
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
    huecos,
    jornada,
    horarioResumen: (profesionalId) => {
      if (!profesionalId) return resumenSemana(d.perfil.openingHours ?? []);
      const e = empleado(profesionalId);
      if (!e) return null;
      // Lunes→domingo desde getDay (0 = domingo).
      const dias = [1, 2, 3, 4, 5, 6, 0].map((wd) => franjasProfesional(e, wd).map((r) => `${hhmm(r.start)}–${hhmm(r.end)}`).join(", "));
      return resumenSemana(dias);
    },
    aperturaDelDia: (dia) => {
      const r = parseRanges(d.perfil.openingHours?.[(diaSemana(dia) + 6) % 7]);
      return { trabaja: r.length > 0, franjas: r.map((x) => ({ desde: hhmm(x.start), hasta: hhmm(x.end) })) };
    },

    senal: {
      regla: () => {
        const r = regla();
        if (!r.activa) return { activa: false, resumen: "" };
        const cuanto = r.modo === "porcentaje" ? `el ${r.porcentaje} %` : euros(r.importeFijoEur);
        const aQuien = r.aplicaA === "nuevas" ? " en la primera visita" : r.aplicaA === "duracion" ? ` en los servicios de ${r.minutosMinimos} minutos o más` : r.aplicaA === "servicios" ? " en algunos servicios" : " en todas las citas";
        return { activa: true, resumen: `${cuanto}${aQuien}, con ${r.ventanaHoras} h de plazo; se devuelve si cancelan con más de ${r.horasCancelacion} h` };
      },
      estado: (cita) => {
        const c = porId.get(cita.id);
        if (!c) return null;
        const e = estadoSenal(c, ahora());
        return { estado: e, importeEur: c.depositEur, venceISO: vencimientoSenal(c, regla().ventanaHoras), recibidaEur: c.depositReceivedEur };
      },
      politicaCancelacion: () => {
        const r = regla();
        if (r.activa) return resumenCancelacionSenal(r, euros);
        if (recargoActivo(d.perfil)) return `si no vienen o cancelan con menos de ${d.perfil.noShowNoticeHours ?? 2} h, se cobra un recargo de ${euros(d.perfil.noShowFeeEur ?? 0)}.`;
        return null;
      },
    },

    preguntasReserva: (serviceIds) => {
      const p = preguntasDelSalon(d.perfil, inferBusinessType(d.perfil.name, ...d.servicios.map((s) => s.name)));
      return (serviceIds ? preguntasAplicables(p, serviceIds) : p).map((x) => x.texto);
    },
    recargo: () => ({ activo: recargoActivo(d.perfil), eur: d.perfil.noShowFeeEur, horasAviso: d.perfil.noShowNoticeHours }),
    duracionFlexible: () => !!d.perfil.duracionFlexible,
    plantillas: () => {
      const cita = d.citas.find((c) => Date.parse(c.start) > ahora().getTime() && c.status === "confirmed");
      if (!cita) return null;
      const sv = cita.serviceIds.map((s) => d.servicios.find((x) => x.id === s)?.name).filter(Boolean).join(" + ");
      return { recordatorio: mensajeRecordatorio({ clientName: cita.clientName.split(" ")[0], salonName: d.perfil.name, startISO: cita.start, servicio: sv, direccion: d.perfil.address }) };
    },
    enlaceReservas: () => d.enlace ?? (d.perfil.slug ? `/s/${d.perfil.slug}` : null),
    calendarioSuscrito: () => d.calendarioSuscrito ?? null,
    // CONECTAR: los nombres de color en palabras los tiene FRONTEND (colorElegidoProfesional).
    colores: () => null,
    bloqueo: (id) => {
      const c = d.clientes.find((x) => x.id === id);
      if (!c) return null;
      const b = isBookingBlocked(c, d.perfil, ahora());
      return { bloqueada: b, motivo: b ? (c.manualBlock ? "bloqueada a mano" : "tiene un recargo por plantón sin pagar") : undefined };
    },

    marketing: {
      campanas: () => campanas().map((c) => ({ titulo: c.titulo, personas: c.cifra, motivo: c.resumenAQuien })),
      recuperables: () => {
        const r = resumenDelMes(campanas());
        return { clientas: r.recuperables, huecos: r.huecos };
      },
      franjaFloja: porTramo(() => {
        // Últimas 4 semanas, por día de la semana y mañana/tarde, con la jornada del equipo.
        const hoy = diaEnZona(ahora(), tz);
        const acum = new Map<string, { jornada: number; citado: number }>();
        for (let i = 1; i <= 28; i++) {
          const dia = sumarDias(hoy, -i);
          const wd = getDay(dia);
          for (const e of d.equipo) {
            for (const r of franjasProfesional(e, wd)) {
              for (const [nombre, a, b] of [["mañana", 0, 14 * 60], ["tarde", 14 * 60, 24 * 60]] as const) {
                const j = Math.max(0, Math.min(r.end, b) - Math.max(r.start, a));
                if (!j) continue;
                const k = `${(diaSemana(dia) + 6) % 7}|${nombre}`;
                const v = acum.get(k) ?? { jornada: 0, citado: 0 };
                v.jornada += j;
                acum.set(k, v);
              }
            }
          }
          for (const c of ocupanDia(dia)) {
            const k = `${(diaSemana(dia) + 6) % 7}|${minutoEnZona(c.start, tz) < 14 * 60 ? "mañana" : "tarde"}`;
            const v = acum.get(k);
            if (v) v.citado += c.duration;
          }
        }
        const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
        const peor = [...acum].filter(([, v]) => v.jornada > 0).map(([k, v]) => ({ k, pct: Math.round((v.citado / v.jornada) * 100) })).sort((a, b) => a.pct - b.pct)[0];
        if (!peor) return null;
        const [i, f] = peor.k.split("|");
        return { etiqueta: `el ${DIAS[Number(i)]} por la ${f}`, pct: Math.min(100, peor.pct) };
      }),
      segundaVisita: porTramo(() => {
        const c = campSegunda(d.citas, d.clientes, d.servicios, d.equipo, d.perfil.name, ahora());
        return { personas: c?.personas.length ?? 0, dias: DIAS_SEGUNDA_VISITA };
      }),
      resenas: porTramo(() => {
        const c = resenaTrasLaCita(d.citas, d.clientes, d.perfil.name, d.perfil.address, ahora());
        return { personas: c?.personas.length ?? 0, dias: DIAS_RESENA };
      }),
    },
  };
}
