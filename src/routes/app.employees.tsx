import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import type { Service } from "@/lib/mock/types";
import { citasDeCalendario, diasDeSemana, ocupacionDe } from "@/lib/calendario-arena";
import { franjasProfesional } from "@/lib/horario-equipo";
import { beforeLoadSiModuloVisible, useRedirigirSiModuloOculto } from "@/lib/route-guards";
import { useEquipo } from "@/lib/use-equipo";
import { useRealSalonSlug } from "@/lib/use-real-salon";
import { useBusinessType } from "@/lib/use-display-profile";
import { fotoDeProfesional, MAX_SALON_TEAM_ENTRIES, formatTeamEntry } from "@/lib/business-type";
import { PageHeader } from "@/components/PageHeader";
import { StylistAvatar } from "@/components/StylistAvatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DAY_LABELS_ES, parseRanges } from "@/lib/opening-hours";
import { resumenHorario } from "@/lib/horario-resumen";

export const Route = createFileRoute("/app/employees")({
  beforeLoad: beforeLoadSiModuloVisible("equipo"),
  component: Team,
});

const DAYS = ["D", "L", "M", "X", "J", "V", "S"];
const WEEK_JS = [1, 2, 3, 4, 5, 6, 0];
const horas = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const horasFin = [...horas, "24:00"];

function topServicesFor(appointments: ReturnType<typeof useSalonStore.getState>["appointments"], employeeId: string, serviceMap: Record<string, Service>) {
  const counts = new Map<string, number>();
  for (const a of appointments) {
    if (a.employeeId !== employeeId || a.status === "cancelled") continue;
    for (const id of a.serviceIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => serviceMap[id]?.name).filter((n): n is string => !!n);
}

function Team() {
  /** Profesionales con las siete filas del horario abiertas. */
  const [horarioAbierto, setHorarioAbierto] = useState<number[]>([]);
  const visible = useRedirigirSiModuloOculto("equipo");
  const appointments = useSalonStore((s) => s.appointments);
  const profile = useSalonStore((s) => s.salonProfile);
  // Lote 12: cada cambio del equipo queda en el historial y se puede deshacer.
  const update = guardarPerfil;
  const employees = useEquipo();
  const tipo = useBusinessType();
  const carta = selectServiceMap(useSalonStore((s) => s.services));
  const esSalonReal = useRealSalonSlug() === profile.slug;
  const hoy = new Date().getDay();
  if (!visible) return null;

  const guardarNombre = (indice: number, campo: "name" | "specialty", valor: string) => {
    const team = employees.map((e) => ({ name: e.name, specialty: e.specialty }));
    team[indice][campo] = valor;
    update({ team: team.map((e) => formatTeamEntry(e)), teamIds: employees.map((e) => e.id) });
  };
  const guardarHorario = (indice: number, diaPerfil: number, valor: string) => {
    const horarios = employees.map((e, i) => [...(profile.teamHours?.[i] ?? profile.openingHours)]);
    horarios[indice][diaPerfil] = valor;
    update({ teamHours: horarios, teamIds: employees.map((e) => e.id) });
  };
  const añadir = () => {
    if (employees.length >= MAX_SALON_TEAM_ENTRIES) return;
    const team = employees.map((e) => formatTeamEntry({ name: e.name, specialty: e.specialty }));
    team.push(formatTeamEntry({ name: "Nueva profesional", specialty: "" }));
    const teamIds = [...employees.map((e) => e.id), `profesional-${Date.now().toString(36)}-${employees.length + 1}`];
    const teamHours = employees.map((_, i) => [...(profile.teamHours?.[i] ?? profile.openingHours)]);
    teamHours.push([...profile.openingHours]);
    update({ team, teamHours, teamIds });
  };
  const quitar = (indice: number) => {
    if (employees.length < 2) return;
    update({
      team: employees.filter((_, i) => i !== indice).map((e) => formatTeamEntry({ name: e.name, specialty: e.specialty })),
      teamIds: employees.filter((_, i) => i !== indice).map((e) => e.id),
      teamHours: employees.filter((_, i) => i !== indice).map((_, i) => [...(profile.teamHours?.[i < indice ? i : i + 1] ?? profile.openingHours)]),
    });
  };

  // «Esta semana»: citas, horas en agenda y ocupación de cada profesional.
  // Lote 16: memoizado y con las citas de cada día calculadas UNA vez (antes,
  // 7 días x cada profesional recorrían la agenda entera en cada pintado).
  const semana = diasDeSemana(new Date(), employees);
  const servicios = useSalonStore((s) => s.services);
  const resumenSemana = useMemo(() => {
  const porDia = semana.map((d) => citasDeCalendario(appointments, d).filter((a) => a.status !== "blocked"));
  return employees.map((e) => {
    let citas = 0;
    let minutos = 0;
    let jornada = 0;
    let ocupacionPonderada = 0;
    for (const [k, d] of semana.entries()) {
      const delDia = porDia[k];
      const mias = delDia.filter((a) => a.employeeId === e.id);
      citas += mias.length;
      minutos += mias.reduce((t, a) => t + a.duration, 0);
      const j = franjasProfesional(e, d.getDay()).reduce((t, f) => t + (f.end - f.start), 0);
      jornada += j;
      ocupacionPonderada += (ocupacionDe(delDia, e, d.getDay()) * j) / 100;
    }
    return { e, citas, horas: Math.round(minutos / 6) / 10, ocupacion: jornada ? Math.round((ocupacionPonderada / jornada) * 100) : 0, top: topServicesFor(appointments, e.id, carta)[0] };
  });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, appointments, servicios, semana[0]?.toDateString()]);
  const etiqueta = "text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase";
  const selectHora = "h-9 rounded-xl border border-input bg-card px-2 text-[13px] tabular-nums";

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader title="Equipo" description="Cada profesional con los días y las horas en que trabaja. Los cambios se guardan solos." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3 lg:group-data-[panel=abierto]/panel:grid-cols-1">
        {employees.map((e, i) => {
          const services = topServicesFor(appointments, e.id, carta);
          return (
            <section key={e.id} className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-border bg-card">
              <div className="flex items-start gap-3 px-5 pt-5 pb-4" style={{ background: `var(--stylist-${["mario", "diego", "ruben"][i % 3]})` }}>
                <span className="shrink-0 rounded-full bg-card p-1 shadow-[var(--sombra-tarjeta)]"><StylistAvatar name={e.name} employeeId={e.id} photo={fotoDeProfesional(e.name, e.id, e.photo, tipo, esSalonReal)} size="lg" /></span>
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <label className="sr-only" htmlFor={`nombre-${i}`}>Nombre</label>
                  <input id={`nombre-${i}`} value={e.name} maxLength={50} onChange={(ev) => guardarNombre(i, "name", ev.target.value)} className="h-9 w-full rounded-lg bg-transparent px-1 font-display text-[22px] font-medium outline-none focus:bg-card/70" />
                  <label className="sr-only" htmlFor={`especialidad-${i}`}>Especialidad</label>
                  <input id={`especialidad-${i}`} value={e.specialty} maxLength={80} placeholder="Especialidad: corte, color…" onChange={(ev) => guardarNombre(i, "specialty", ev.target.value)} className="h-8 w-full rounded-lg bg-transparent px-1 text-[13px] text-cafe-medio outline-none placeholder:text-cafe-suave focus:bg-card/70" />
                </div>
                {employees.length > 1 && <Button type="button" variant="ghost" size="icon" className="shrink-0 hover:bg-card/60" aria-label={`Quitar a ${e.name}`} onClick={() => quitar(i)}><Trash2 className="size-[18px]" strokeWidth={1.6} /></Button>}
              </div>
              {/* El horario en una línea; las siete filas, al pedirlas. */}
              <button
                type="button"
                aria-expanded={horarioAbierto.includes(i)}
                onClick={() => setHorarioAbierto((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]))}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-beige/50"
              >
                <span className="min-w-0 flex-1">
                  <span className={cn(etiqueta, "block")}>Horario</span>
                  <span className="flex flex-wrap text-[14px] font-semibold text-cafe tabular-nums">
                    {resumenHorario(DAY_LABELS_ES.map((_, d) => profile.teamHours?.[i]?.[d] ?? profile.openingHours[d] ?? "Cerrado"))
                      .split(" · ")
                      .map((t, k) => (
                        <span key={t} className="whitespace-nowrap">
                          {k > 0 && <span className="px-1.5 text-taupe">·</span>}
                          {t}
                        </span>
                      ))}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-bold text-cafe-medio">{horarioAbierto.includes(i) ? "Cerrar" : "Editar"}</span>
                <ChevronDown className={cn("size-5 shrink-0 text-cafe-medio transition-transform", horarioAbierto.includes(i) && "rotate-180")} strokeWidth={1.6} aria-hidden="true" />
              </button>
              {horarioAbierto.includes(i) && (
              <div className="flex-1">
                <p className="px-5 pb-2 text-[12px] text-muted-foreground">Tramos de 30 min, dentro del horario del salón.</p>
                {DAY_LABELS_ES.map((label, d) => {
                  const jsDay = WEEK_JS[d];
                  const texto = profile.teamHours?.[i]?.[d] ?? profile.openingHours[d] ?? "Cerrado";
                  const rango = parseRanges(texto)[0];
                  const horarioSalon = parseRanges(profile.openingHours[d]);
                  const horaInicioSalon = horarioSalon[0]?.start ?? 600;
                  const horaFinSalon = horarioSalon[horarioSalon.length - 1]?.end ?? 1080;
                  const trabaja = !!rango;
                  const inicio = `${String(Math.floor((rango?.start ?? horaInicioSalon) / 60)).padStart(2, "0")}:${(rango?.start ?? horaInicioSalon) % 60 ? "30" : "00"}`;
                  const fin = `${String(Math.floor((rango?.end ?? horaFinSalon) / 60)).padStart(2, "0")}:${(rango?.end ?? horaFinSalon) % 60 ? "30" : "00"}`;
                  const guardar = (start: string, end: string) => guardarHorario(i, d, `${start}–${end}`);
                  return <div key={label} className={cn("grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-border px-5 py-1.5", jsDay === hoy && "bg-perla")}>
                    <label className={cn("flex min-h-9 items-center gap-2.5 text-[13px]", !trabaja && "text-muted-foreground")}><input type="checkbox" className="size-4 accent-[var(--hoja)]" checked={trabaja} onChange={(ev) => guardarHorario(i, d, ev.target.checked ? `${inicio}–${fin}` : "Cerrado")} /><span className="font-semibold">{label}</span>{jsDay === hoy && <span className="rounded-full bg-salvia-clara px-1.5 text-[11px] font-bold text-hoja-tinta">Hoy</span>}</label>
                    {trabaja ? <>
                      <select aria-label={`${label}: hora de entrada`} className={selectHora} value={inicio} onChange={(ev) => guardar(ev.target.value, fin)}>{horas.map((h) => <option key={h}>{h}</option>)}</select>
                      <select aria-label={`${label}: hora de salida`} className={selectHora} value={fin} onChange={(ev) => guardar(inicio, ev.target.value)}>{horasFin.map((h) => <option key={h}>{h}</option>)}</select>
                    </> : <span className="col-span-2 text-right text-[12.5px] text-muted-foreground">No trabaja</span>}
                  </div>;
                })}
              </div>
              )}
              {services.length > 0 && <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-5 py-3.5"><span className="mr-1 text-[12.5px] text-muted-foreground">Lo que más hace</span>{services.slice(0, 3).map((name) => <span key={name} className="inline-flex h-6 items-center rounded-full bg-nata px-2.5 text-[12.5px] font-bold text-cafe-medio">{name}</span>)}</div>}
            </section>
          );
        })}
        <button type="button" disabled={employees.length >= MAX_SALON_TEAM_ENTRIES} onClick={añadir} className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-lino-fuerte bg-card text-cafe-medio hover:bg-nata disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="size-6" strokeWidth={1.6} />
          <b>Añadir profesional</b>
          <span className="text-[12.5px] text-muted-foreground tabular-nums">{employees.length} de {MAX_SALON_TEAM_ENTRIES}</span>
        </button>
      </div>

      <section className="flex-1 overflow-hidden rounded-[20px] border border-border bg-card">
        <div className="flex flex-wrap items-baseline gap-x-2.5 px-5 py-4">
          <h2 className="text-base font-extrabold tracking-[-0.01em]">Esta semana</h2>
          <span className="text-[12.5px] text-muted-foreground">Del {semana[0]?.getDate()} al {semana[semana.length - 1]?.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}, según la agenda</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="bg-perla text-left">{["Profesional", "Citas", "Horas en agenda", "Ocupación", "Lo más pedido"].map((t) => <th key={t} className={cn(etiqueta, "px-5 py-2.5")}>{t}</th>)}</tr></thead>
            <tbody>
              {resumenSemana.map(({ e, citas, horas: h, ocupacion, top }, i) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-5 py-3"><span className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full text-[11px] font-extrabold" style={{ background: `var(--stylist-${["mario", "diego", "ruben"][i % 3]})` }}>{e.name[0]}</span><b>{e.name}</b></span></td>
                  <td className="px-5 py-3 font-bold tabular-nums">{citas}</td>
                  <td className="px-5 py-3 tabular-nums">{String(h).replace(".", ",")} h</td>
                  <td className="px-5 py-3"><span className="flex items-center gap-2.5"><span className="flex h-1.5 w-28 overflow-hidden rounded-full bg-nata"><i className="block" style={{ width: `${ocupacion}%`, background: `var(--k-pro-${(i % 3) + 1})` }} /></span><b className="tabular-nums">{ocupacion} %</b></span></td>
                  <td className="px-5 py-3 text-muted-foreground">{top ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
