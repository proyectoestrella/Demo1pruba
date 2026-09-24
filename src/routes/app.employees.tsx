import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { serviceMap } from "@/lib/mock/salon";
import { beforeLoadSiModuloVisible, useRedirigirSiModuloOculto } from "@/lib/route-guards";
import { useEquipo } from "@/lib/use-equipo";
import { useRealSalonSlug } from "@/lib/use-real-salon";
import { useBusinessType } from "@/lib/use-display-profile";
import { fotoDeProfesional, MAX_SALON_TEAM_ENTRIES, formatTeamEntry } from "@/lib/business-type";
import { PageHeader } from "@/components/PageHeader";
import { StylistAvatar } from "@/components/StylistAvatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { DAY_LABELS_ES, parseRanges } from "@/lib/opening-hours";

export const Route = createFileRoute("/app/employees")({
  beforeLoad: beforeLoadSiModuloVisible("equipo"),
  component: Team,
});

const DAYS = ["D", "L", "M", "X", "J", "V", "S"];
const WEEK_JS = [1, 2, 3, 4, 5, 6, 0];
const horas = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const horasFin = [...horas, "24:00"];

function topServicesFor(appointments: ReturnType<typeof useSalonStore.getState>["appointments"], employeeId: string) {
  const counts = new Map<string, number>();
  for (const a of appointments) {
    if (a.employeeId !== employeeId || a.status === "cancelled") continue;
    for (const id of a.serviceIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => serviceMap[id]?.name).filter((n): n is string => !!n);
}

function Team() {
  const visible = useRedirigirSiModuloOculto("equipo");
  const appointments = useSalonStore((s) => s.appointments);
  const profile = useSalonStore((s) => s.salonProfile);
  const update = useSalonStore((s) => s.updateSalonProfile);
  const employees = useEquipo();
  const tipo = useBusinessType();
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

  return (
    <div className="space-y-6">
      <PageHeader title="Equipo" description="Añade a cada profesional y marca los días y las horas en que trabaja." />
      <div className="mx-auto max-w-5xl space-y-4">
        {employees.map((e, i) => {
          const services = topServicesFor(appointments, e.id);
          return (
            <section key={e.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
              <div className="flex items-start gap-4">
                <StylistAvatar name={e.name} employeeId={e.id} photo={fotoDeProfesional(e.name, e.id, e.photo, tipo, esSalonReal)} size="lg" />
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor={`nombre-${i}`}>Nombre</Label><Input id={`nombre-${i}`} value={e.name} maxLength={50} onChange={(ev) => guardarNombre(i, "name", ev.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor={`especialidad-${i}`}>Especialidad</Label><Input id={`especialidad-${i}`} value={e.specialty} maxLength={80} placeholder="Corte, color…" onChange={(ev) => guardarNombre(i, "specialty", ev.target.value)} /></div>
                </div>
                {employees.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Quitar a ${e.name}`} onClick={() => quitar(i)}><Trash2 className="size-4" /></Button>}
              </div>
              <div className="mt-5 border-t border-border/60 pt-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-medium">Horario de {e.name || "esta profesional"}</h3><span className="text-xs text-muted-foreground">En tramos de 30 min · dentro del horario del salón</span></div>
                <div className="space-y-2">
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
                    return <div key={label} className={cn("grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-2 sm:grid-cols-[minmax(100px,1fr)_minmax(110px,150px)_minmax(110px,150px)]", jsDay === hoy && "bg-primary/5")}>
                      <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={trabaja} onChange={(ev) => guardarHorario(i, d, ev.target.checked ? `${inicio}–${fin}` : "Cerrado")} /><span>{label}{jsDay === hoy && <span className="ml-1 text-xs text-muted-foreground">Hoy</span>}</span></label>
                      {trabaja ? <>
                        <select aria-label={`${label}: hora de entrada`} className="h-11 rounded-md border border-input bg-background px-2 text-sm" value={inicio} onChange={(ev) => guardar(ev.target.value, fin)}>{horas.map((h) => <option key={h}>{h}</option>)}</select>
                        <select aria-label={`${label}: hora de salida`} className="h-11 rounded-md border border-input bg-background px-2 text-sm" value={fin} onChange={(ev) => guardar(inicio, ev.target.value)}>{horasFin.map((h) => <option key={h}>{h}</option>)}</select>
                      </> : <span className="col-span-2 text-sm text-muted-foreground sm:col-span-2">No trabaja</span>}
                    </div>;
                  })}
                </div>
              </div>
              {services.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{services.slice(0, 4).map((name) => <Badge key={name} variant="secondary" className="font-normal">{name}</Badge>)}</div>}
            </section>
          );
        })}
        <Button type="button" variant="outline" className="h-12 w-full" disabled={employees.length >= MAX_SALON_TEAM_ENTRIES} onClick={añadir}><Plus className="mr-2 size-4" />Añadir profesional <span className="ml-1 text-muted-foreground">({employees.length}/{MAX_SALON_TEAM_ENTRIES})</span></Button>
      </div>
    </div>
  );
}
