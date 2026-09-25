import type { Appointment, Client, Employee, SalonProfile, Service, WaitlistEntry } from "../mock/types";
import { citasDelDia, terminada, enCurso, faltaPara } from "../hoy-arena";
import { agendaDeHoy, dineroDelRango } from "../dinero";
import { esCobrable, cierreDelDia } from "../caja";
import { citasSinDesenlace, clientesConDeuda, resumenDeDeuda } from "../deuda";
import { citasDeCalendario, huecosDe, mismoDia } from "../calendario-arena";
import { fichaDeClienta } from "../ficha-clienta";
import { buscarClientas } from "../buscar-clientas";
import { findNextAvailableSlot } from "../reparto";
import { franjasProfesional } from "../horario-equipo";
import { resumenDePeriodo, type Rango } from "../periodos";
import type { PeriodoId } from "../periodos";
import { barrasDelPeriodo, citasDelRango, nuevasYRecurrentes, ocupacionPorProfesional, serviciosDelRango } from "../analitica-arena";
import { franjaMasFloja, patronDeRegreso, duracionRecordada } from "../derive";
import { hojaDelDia, fechaLocal } from "../hoja-del-dia";
import { buildCampanas, resumenDelMes, type Campana } from "../campanas";
import { isOpenNow, todayOpenInfo, weekSchedule } from "../opening-hours";
import { resumenHorario } from "../horario-resumen";
import { isBookingBlocked } from "../no-show";
import { recargoActivo } from "../recargo-activo";
import { duracionFlexibleActiva } from "../duracion-flexible";
import { indiceColorServicio } from "../hoy-arena";
import { colorElegidoProfesional } from "../colores-elegidos";
import { preguntasAplicables, preguntasDelSalon } from "../preguntas-maqueta";
import { CONFIRMACION_POR_DEFECTO, RECORDATORIO_POR_DEFECTO } from "../plantillas-whatsapp";
import { estadoSenal, reglaSenal, respuestaFaqSenal } from "../senal-maqueta";

/**
 * Fuentes de datos del asistente para la rama «Arena» (lote 10). Una función
 * por familia de preguntas-universo.md, agrupadas por categoría. Devuelven
 * DATOS (cifras, listas, la entidad resuelta), nunca texto: el texto con
 * carisma lo pone el motor de BACKEND.
 *
 * CONECTAR: la firma es tentativa. Cuando BACKEND publique
 * `src/lib/asistente/fuentes.ts` (interfaz `FuentesAsistente`), este fichero
 * se ajusta a ella. Nada aquí importa del motor: el motor recibe esto
 * inyectado, porque varias funciones solo existen en esta rama.
 */

export interface EstadoArena {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  waitlist: WaitlistEntry[];
  salonProfile: SalonProfile;
  equipo: Employee[];
  /** Salón real (con slug) o demo: cambia el aviso de «sin cobros marcados». */
  esDemo: boolean;
}

const DIA = 86_400_000;
const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const rangoDelDia = (d: Date): Rango => ({ inicio: inicioDia(d), fin: new Date(+inicioDia(d) + DIA) });
const minutos = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

export function crearFuentesArena(e: EstadoArena, ahora: Date = new Date()) {
  const { appointments: citas, clients, services, waitlist, salonProfile: perfil, equipo } = e;
  const carta = Object.fromEntries(services.map((s) => [s.id, s]));
  const hoy = citasDelDia(citas, ahora);
  const agenda = () => agendaDeHoy(hoy, equipo, ahora);
  const ficha = (clientId: string) => fichaDeClienta(clientId, { citas, clientes: clients, servicios: services, equipo, ahora });
  const cuenta = (a: Appointment) => a.status !== "cancelled" && a.status !== "blocked";
  const regla = reglaSenal(perfil);
  const campanas = (): Campana[] =>
    buildCampanas({ appointments: citas, clients, services, employees: equipo, salonName: perfil.name, salonAddress: perfil.address, now: ahora });
  const deProfesional = (id?: string) => (a: Appointment) => !id || a.employeeId === id;

  return {
    /** Resolver entidades: la clienta por nombre o teléfono (puede devolver varias: desambiguar). */
    entidades: {
      clientas: (texto: string) => buscarClientas(texto, { clientes: clients, citas }).slice(0, 5),
      profesional: (texto: string) => equipo.find((p) => p.name.toLowerCase() === texto.toLowerCase()) ?? null,
      servicio: (texto: string) => services.find((s) => s.name.toLowerCase().includes(texto.toLowerCase())) ?? null,
    },

    hoy: {
      citasHoy: () => {
        const a = agenda();
        return { total: a.total, porProfesional: a.porPro.map((x) => ({ profesional: x.e.name, citas: x.citas })) };
      },
      citasHoyProfesional: (profesionalId: string) => {
        const suyas = hoy.filter((a) => a.employeeId === profesionalId && cuenta(a));
        const siguiente = suyas.find((a) => !terminada(a, ahora));
        return { citas: suyas.length, siguiente: siguiente ?? null };
      },
      proximaCita: (profesionalId?: string) => {
        const lista = hoy.filter(deProfesional(profesionalId)).filter(cuenta);
        const ahoraMismo = lista.filter((a) => enCurso(a, ahora));
        const siguiente = lista.find((a) => +new Date(a.start) > +ahora) ?? null;
        return { enCurso: ahoraMismo, siguiente, faltan: siguiente ? faltaPara(siguiente, ahora) : null };
      },
      listaCitasHoy: (o: { profesionalId?: string; franja?: "manana" | "tarde" } = {}) =>
        hoy
          .filter(deProfesional(o.profesionalId))
          .filter((a) => cuenta(a) && !terminada(a, ahora))
          .filter((a) => !o.franja || (o.franja === "manana" ? minutos(a.start) < 840 : minutos(a.start) >= 840)),
      huecosHoy: (profesionalId?: string) => {
        const a = agenda();
        const huecos = a.huecos.filter((h) => !profesionalId || h.e.id === profesionalId);
        return { huecos: huecos.length, minutosLibres: huecos.reduce((s, h) => s + h.fin - h.ini, 0), detalle: a.detalleHuecos, lista: huecos };
      },
      ocupacionHoy: () => ({ pct: agenda().ocupacionPct }),
      pendienteDeTi: () => {
        const solicitudes = citas.filter((a) => a.status === "pending").length;
        const porMarcar = citasSinDesenlace(citas, ahora).length;
        const vencidas = citas.filter((a) => estadoSenal(a, regla, ahora) === "vencida").length;
        return { total: solicitudes + porMarcar + vencidas, solicitudes, porMarcar, senalesVencidas: vencidas };
      },
      solicitudesPendientes: () => citas.filter((a) => a.status === "pending").sort((x, y) => +new Date(x.start) - +new Date(y.start)),
      porMarcar: () => citasSinDesenlace(citas, ahora),
      coloresHoy: () =>
        hojaDelDia(citas, fechaLocal(ahora)).map(({ cita }) => ({ cita, ultimoColor: ficha(cita.clientId).resumen.ultimoColor ?? null })),
    },

    agenda: {
      citasDia: (dia: Date, profesionalId?: string) => citasDeCalendario(citas, dia).filter(deProfesional(profesionalId)).filter(cuenta),
      citasManana: (profesionalId?: string) => {
        const m = new Date(+inicioDia(ahora) + DIA);
        return hojaDelDia(citas, fechaLocal(m)).map((f) => f.cita).filter(deProfesional(profesionalId));
      },
      huecosDia: (dia: Date, profesionalId?: string, minimo = 30) => {
        const delDia = citasDeCalendario(citas, dia);
        const desde = mismoDia(dia, ahora) ? minutos(ahora.toISOString()) : undefined;
        return equipo
          .filter((p) => !profesionalId || p.id === profesionalId)
          .flatMap((p) => huecosDe(delDia, p, dia.getDay(), { desde }).map((t) => ({ profesional: p.name, profesionalId: p.id, ...t })))
          .filter((t) => t.fin - t.ini >= minimo);
      },
      primerHuecoServicio: (serviceId: string, profesionalId?: string, desde?: Date) => {
        const s = carta[serviceId];
        if (!s) return null;
        const hueco = findNextAvailableSlot(equipo, citas, s.durationMin, profesionalId ?? "any", { fromDate: desde ?? ahora, maxDays: 30 });
        return hueco ? { servicio: s.name, duracion: s.durationMin, hueco } : { servicio: s.name, duracion: s.durationMin, hueco: null };
      },
      citasPeriodo: (periodo: PeriodoId, rango?: { desde: string; hasta: string }) => {
        const r = resumenDePeriodo(citas, periodo, equipo, ahora, rango);
        return { citas: r.actual.citas, anteriores: r.previo.citas, comparacion: r.textoComparacion };
      },
      ocupacionPeriodo: (rango: Rango) => ocupacionPorProfesional(citas, rango, equipo).map((x) => ({ profesional: x.e.name, pct: x.pct, citas: x.citas })),
      proximaCitaClienta: (clientId: string) => {
        const f = ficha(clientId);
        const cita = citas.find((a) => a.clientId === clientId && a.start === f.resumen.proximaCita) ?? null;
        return { cuando: f.resumen.proximaCita ?? null, cita };
      },
      recordatoriosManana: () => {
        const m = new Date(+inicioDia(ahora) + DIA);
        return hojaDelDia(citas, fechaLocal(m)).map((f) => f.cita).filter((c) => !c.reminderSentAt);
      },
      listaEspera: (o: { serviceId?: string; profesionalId?: string } = {}) =>
        waitlist.filter((w) => (!o.serviceId || w.serviceId === o.serviceId) && (!o.profesionalId || w.preferredEmployeeId === o.profesionalId)),
      franjaFloja: () => franjaMasFloja(citas, ahora),
      diaMasLleno: (periodo: PeriodoId, rango: Rango) => {
        const barras = barrasDelPeriodo(citas, periodo, rango, equipo, ahora);
        return barras.reduce((m, b) => (b.valor > (m?.valor ?? -1) ? b : m), null as (typeof barras)[number] | null);
      },
      cancelaciones: (rango: Rango) => citas.filter((a) => a.status === "cancelled" && +new Date(a.start) >= +rango.inicio && +new Date(a.start) < +rango.fin).length,
      plantones: (rango: Rango) => {
        const fallos = citasDelRango(citas, rango).filter((a) => a.status === "no-show");
        const porClienta = new Map<string, number>();
        for (const a of fallos) porClienta.set(a.clientName, (porClienta.get(a.clientName) ?? 0) + 1);
        return { total: fallos.length, masRepite: [...porClienta.entries()].sort((a, b) => b[1] - a[1])[0] ?? null };
      },
    },

    clientas: {
      ultimaVisita: (clientId: string) => ficha(clientId).visitas[0] ?? null,
      ultimoColor: (clientId: string) => ficha(clientId).resumen.ultimoColor ?? null,
      frecuencia: (clientId: string) => {
        const r = ficha(clientId).resumen;
        return { dias: r.frecuenciaMediaDias ?? null, ultimaVisita: r.ultimaVisita ?? null };
      },
      gasto: (clientId: string) => {
        const r = ficha(clientId).resumen;
        return { total: r.gastoTotal, ultimos12Meses: r.gastoUltimos12Meses, visitas: r.numeroVisitas, orientativo: true };
      },
      datos: (clientId: string) => {
        const c = clients.find((x) => x.id === clientId);
        return c ? { nombre: c.name, telefono: c.phone, correo: c.email ?? null, cumpleanos: c.birthday ?? null } : null;
      },
      notas: (clientId: string) => ({ notas: clients.find((x) => x.id === clientId)?.notes ?? null, avisos: ficha(clientId).avisos }),
      total: () => clients.length,
      nuevas: (rango: Rango) => nuevasYRecurrentes(citas, rango).nuevas,
      recurrentes: (rango: Rango) => ({ ...nuevasYRecurrentes(citas, rango), patron: patronDeRegreso(citas, ahora) }),
      inactivas: () => campanas().find((c) => c.id === "no-vuelven") ?? null,
      mejores: (n = 5) =>
        clients
          .map((c) => ({ clienta: c, gasto: ficha(c.id).resumen.gastoTotal }))
          .sort((a, b) => b.gasto - a.gasto)
          .slice(0, n),
      colorPendiente: () => {
        const hasta = +ahora + 14 * DIA;
        const proximas = citas.filter((a) => cuenta(a) && +new Date(a.start) >= +ahora && +new Date(a.start) < hasta);
        const ids = [...new Set(proximas.map((a) => a.clientId))];
        return ids.filter((id) => !ficha(id).resumen.ultimoColor).map((id) => clients.find((c) => c.id === id)).filter(Boolean) as Client[];
      },
      cumpleanos: (rango: Rango) =>
        clients.filter((c) => {
          if (!c.birthday) return false;
          const [, m, d] = c.birthday.split("-").map(Number);
          for (let t = +rango.inicio; t < +rango.fin; t += DIA) {
            const x = new Date(t);
            if (x.getMonth() + 1 === m && x.getDate() === d) return true;
          }
          return false;
        }),
      conDeuda: () => ({ ...resumenDeDeuda(clients), clientas: recargoActivo(perfil) ? clientesConDeuda(clients) : [], recargoActivo: recargoActivo(perfil) }),
      bloqueada: (clientId: string) => {
        const c = clients.find((x) => x.id === clientId);
        return c ? { bloqueada: isBookingBlocked(c, perfil, ahora), aMano: !!c.manualBlock } : null;
      },
      profesionalHabitual: (clientId: string) => ficha(clientId).resumen.profesionalHabitual ?? null,
    },

    equipo: {
      horario: (profesionalId: string) => {
        const i = equipo.findIndex((p) => p.id === profesionalId);
        return i < 0 ? null : resumenHorario((perfil.teamHours?.[i] ?? perfil.openingHours) as string[]);
      },
      quienTrabaja: (dia: Date) => equipo.filter((p) => franjasProfesional(p, dia.getDay()).length > 0).map((p) => p.name),
      citasProfesional: (profesionalId: string, rango: Rango) => ocupacionPorProfesional(citas, rango, equipo).find((x) => x.e.id === profesionalId)?.citas ?? 0,
      ocupacionProfesional: (rango: Rango) => ocupacionPorProfesional(citas, rango, equipo).map((x) => ({ profesional: x.e.name, pct: x.pct })),
      dineroProfesional: (profesionalId: string, rango: Rango) => dineroDelRango(citas.filter((a) => a.employeeId === profesionalId), rango, ahora),
      loQueMasHace: (profesionalId: string, rango: Rango) => serviciosDelRango(citas.filter((a) => a.employeeId === profesionalId), rango, services).slice(0, 3),
    },

    servicios: {
      precio: (serviceId: string) => carta[serviceId] ?? null,
      duracion: (serviceId: string, clientId?: string) => {
        const s = carta[serviceId];
        if (!s) return null;
        return { carta: s.durationMin, recordada: clientId ? (duracionRecordada(citas, clientId, [serviceId], s.durationMin)?.minutos ?? null) : null };
      },
      masPedido: (rango: Rango) => serviciosDelRango(citas, rango, services).slice(0, 3),
      masRentable: (rango: Rango) =>
        serviciosDelRango(citas, rango, services)
          .map((x) => ({ servicio: x.sv.name, eurPorHora: Math.round((x.euros / Math.max(1, x.veces * x.sv.durationMin)) * 60) }))
          .sort((a, b) => b.eurPorHora - a.eurPorHora),
      carta: () => services.filter((s) => s.active !== false),
      veces: (serviceId: string, rango: Rango) => serviciosDelRango(citas, rango, services).find((x) => x.sv.id === serviceId) ?? null,
    },

    dinero: {
      ingresosHoy: () => {
        const valor = hoy.filter(esCobrable).reduce((s, a) => s + a.priceEur, 0);
        const d = dineroDelRango(citas, rangoDelDia(ahora), ahora);
        return { valorDelDia: valor, cobrado: d.cobrado, porCobrar: Math.max(0, valor - d.cobrado), sinCobrosMarcados: !e.esDemo && d.cobrado === 0 && d.sinCobroMarcado > 0 };
      },
      cobrado: (rango: Rango) => dineroDelRango(citas, rango, ahora),
      previsto: (rango: Rango) => dineroDelRango(citas, rango, ahora),
      estimacionMes: () => {
        const r: Rango = { inicio: new Date(ahora.getFullYear(), ahora.getMonth(), 1), fin: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1) };
        const d = dineroDelRango(citas, r, ahora);
        return { cobrado: d.cobrado, previsto: d.previsto, estimacion: d.cobrado + d.previsto, esEstimacion: true };
      },
      cobroPorMetodo: (dia: Date) => cierreDelDia(citas, equipo, dia).porMetodo,
      comparar: (periodo: PeriodoId) => {
        const r = resumenDePeriodo(citas, periodo, equipo, ahora);
        return { actual: r.actual, previo: r.previo, texto: r.textoComparacion };
      },
      precioMedio: (rango: Rango) => {
        const hechas = citasDelRango(citas, rango).filter((a) => a.status !== "no-show");
        return hechas.length ? Math.round(hechas.reduce((s, a) => s + a.priceEur, 0) / hechas.length) : 0;
      },
      dineroServicio: (serviceId: string, rango: Rango) => serviciosDelRango(citas, rango, services).find((x) => x.sv.id === serviceId) ?? null,
      resumenMes: () => {
        const r: Rango = { inicio: new Date(ahora.getFullYear(), ahora.getMonth(), 1), fin: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1) };
        return { dinero: dineroDelRango(citas, r, ahora), citas: citasDelRango(citas, r).length, ocupacion: resumenDePeriodo(citas, "mes", equipo, ahora).actual.ocupacion };
      },
    },

    senal: {
      regla: () => ({ ...regla, textoWeb: respuestaFaqSenal(regla, (n) => `${n} €`) }),
      pendientes: () => citas.filter((a) => estadoSenal(a, regla, ahora) === "pedida"),
      vencidas: () => citas.filter((a) => estadoSenal(a, regla, ahora) === "vencida"),
      deCita: (clientId: string) => {
        const proxima = citas.filter((a) => a.clientId === clientId && +new Date(a.start) >= +ahora && cuenta(a)).sort((x, y) => +new Date(x.start) - +new Date(y.start))[0];
        return proxima ? { cita: proxima, estado: estadoSenal(proxima, regla, ahora) } : null;
      },
      recibidas: (rango: Rango) => {
        const l = citas.filter((a) => (a.depositStatus === "recibida" || a.depositStatus === "aplicada") && a.depositReceivedAt && +new Date(a.depositReceivedAt) >= +rango.inicio && +new Date(a.depositReceivedAt) < +rango.fin);
        return { cuantas: l.length, eur: l.reduce((s, a) => s + (a.depositReceivedEur ?? a.depositEur ?? 0), 0) };
      },
    },

    marketing: {
      campanas: () => campanas(),
      recuperables: () => resumenDelMes(campanas()),
      huecosFlojos: () => campanas().find((c) => c.id === "huecos-flojos") ?? null,
      segundaVisita: () => campanas().find((c) => c.id === "segunda-visita") ?? null,
      resenas: () => campanas().find((c) => c.id === "resena") ?? null,
    },

    configuracion: {
      abiertoAhora: () => ({ abierto: isOpenNow(perfil.openingHours, ahora), texto: todayOpenInfo(perfil.openingHours, ahora) }),
      horarioSalon: () => ({ resumen: resumenHorario(perfil.openingHours), dias: weekSchedule(perfil.openingHours) }),
      politicaCancelacion: () => ({ recargo: recargoActivo(perfil), senal: respuestaFaqSenal(regla, (n) => `${n} €`) }),
      preguntas: (serviceId?: string) => {
        const lista = preguntasDelSalon(perfil);
        return serviceId ? preguntasAplicables(lista, [serviceId]) : lista.filter((q) => q.activa);
      },
      plantones: () => ({ activo: recargoActivo(perfil), eur: perfil.noShowFeeEur ?? 0, horas: perfil.noShowNoticeHours ?? 2 }),
      mensajes: () => ({ confirmacion: perfil.plantillas?.confirmacion ?? CONFIRMACION_POR_DEFECTO, recordatorio: perfil.plantillas?.recordatorio ?? RECORDATORIO_POR_DEFECTO }),
      duracionFlexible: () => duracionFlexibleActiva(perfil, null, !e.esDemo),
      colores: () => ({
        servicios: services.map((s) => ({ servicio: s.name, color: indiceColorServicio(s.id, services) })),
        profesionales: equipo.map((p, i) => ({ profesional: p.name, color: colorElegidoProfesional(p.id) ?? (i % 4) + 1 })),
      }),
    },
  };
}

export type FuentesArena = ReturnType<typeof crearFuentesArena>;
