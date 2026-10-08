import { useEffect, useState } from "react";
import { toast } from "sonner";
import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { isoDelSalon, zonaDelSalon } from "@/lib/zona-horaria";
import { useSalonStore } from "@/lib/store";
import type { Employee } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function fecha(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export function BloquearTiempoDialog({ open, onOpenChange, date, equipo }: { open: boolean; onOpenChange: (v: boolean) => void; date: Date; equipo: Employee[] }) {
  const profile = useSalonStore((s) => s.salonProfile);
  const [dia, setDia] = useState(fecha(date));
  const [profesionalId, setProfesionalId] = useState<string>(equipo[0]?.id ?? "salon");
  const [inicio, setInicio] = useState("14:00");
  const [fin, setFin] = useState("15:00");
  const [motivo, setMotivo] = useState("");
  const [repetir, setRepetir] = useState(false);
  useEffect(() => { if (open) setDia(fecha(date)); }, [open, date]);
  const guardar = () => {
    const limite = new Date(); limite.setFullYear(limite.getFullYear() + 1);
    const elegida = new Date(`${dia}T12:00:00`);
    if (!dia || elegida > limite) return toast.error("El bloqueo debe estar dentro del próximo año.");
    if (!/^\d\d:\d\d$/.test(inicio) || !/^\d\d:\d\d$/.test(fin) || fin <= inicio) return toast.error("Revisa las horas del bloqueo.");
    const zona = zonaDelSalon(profile);
    const inicioISO = isoDelSalon(dia, inicio, zona);
    const finISO = isoDelSalon(dia, fin, zona);
    guardarPerfil({ bloqueosAgenda: [...(profile.bloqueosAgenda ?? []), { id: `bloqueo-${crypto.randomUUID()}`, profesionalId: profesionalId === "salon" ? "salon" : profesionalId, inicio: inicioISO, fin: finISO, ...(motivo.trim() ? { motivo: motivo.trim() } : {}), ...(repetir ? { recurrente: { diaSemana: elegida.getDay() } } : {}) }] });
    onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Bloquear tiempo</DialogTitle><DialogDescription>Reserva este hueco para una profesional o para todo el salón, sin crear una cita con clienta.</DialogDescription></DialogHeader><div className="grid gap-3"><label className="grid gap-1 text-sm font-bold">Fecha<Input type="date" value={dia} min={fecha(new Date())} onChange={(e) => setDia(e.target.value)} /></label><label className="grid gap-1 text-sm font-bold">A quién bloqueas<select className="h-10 rounded-xl border border-input bg-blanco px-3" value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)}><option value="salon">Todo el salón</option>{equipo.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-bold">Desde<Input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label><label className="grid gap-1 text-sm font-bold">Hasta<Input type="time" value={fin} onChange={(e) => setFin(e.target.value)} /></label></div><label className="grid gap-1 text-sm font-bold">Motivo <span className="font-normal text-muted-foreground">· opcional</span><Input value={motivo} maxLength={100} onChange={(e) => setMotivo(e.target.value)} placeholder="Comida, recado…" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} /> Repetir cada semana</label></div><DialogFooter><Button type="button" onClick={guardar}>Bloquear tiempo</Button></DialogFooter></DialogContent></Dialog>;
}
