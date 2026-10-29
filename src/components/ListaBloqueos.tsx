import { useMemo, useState } from "react";
import { toast } from "sonner";
import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { bloqueosFuturos, quitarBloqueos } from "@/lib/bloqueos-agenda";
import { fechaEnZona, horaEnZona, zonaDelSalon } from "@/lib/zona-horaria";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import type { BloqueoAgenda } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DIAS_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

function cuando(b: BloqueoAgenda, zona: string): string {
  const horas = `${horaEnZona(b.inicio, zona)}–${horaEnZona(b.fin, zona)}`;
  if (b.recurrente) return `Todos los ${DIAS_PLURAL[b.recurrente.diaSemana]} · ${horas}`;
  const [a, m, d] = fechaEnZona(b.inicio, zona).split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${dia} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a} · ${horas}`;
}

/** Todos los bloqueos que quedan, con filtro por profesional y borrado de uno o de varios a la vez. */
export function ListaBloqueos({ ahoraISO }: { ahoraISO?: string }) {
  const perfil = useSalonStore((s) => s.salonProfile);
  const equipo = useEquipo();
  const zona = zonaDelSalon(perfil);
  const [filtro, setFiltro] = useState("todos");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<string[] | null>(null);
  const lista = useMemo(
    () => bloqueosFuturos(perfil.bloqueosAgenda, ahoraISO ?? new Date().toISOString(), filtro),
    [perfil.bloqueosAgenda, ahoraISO, filtro],
  );
  const nombre = (id: string) => (id === "salon" ? "Todo el salón" : (equipo.find((e) => e.id === id)?.name ?? "Profesional"));
  const idsVisibles = lista.map((b) => b.id);
  const marcadosVisibles = idsVisibles.filter((id) => marcados.has(id));
  const todosMarcados = idsVisibles.length > 0 && marcadosVisibles.length === idsVisibles.length;
  const alternar = (id: string, on: boolean) =>
    setMarcados((prev) => {
      const sig = new Set(prev);
      if (on) sig.add(id);
      else sig.delete(id);
      return sig;
    });
  const quitar = () => {
    if (!confirmar) return;
    guardarPerfil({ bloqueosAgenda: quitarBloqueos(perfil.bloqueosAgenda, confirmar) });
    toast.success(confirmar.length === 1 ? "Bloqueo quitado" : `${confirmar.length} bloqueos quitados`, { description: "Esas horas vuelven a estar libres en la agenda y en la web de reservas." });
    setMarcados(new Set());
    setConfirmar(null);
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2 text-sm font-bold">
          Ver los de
          <select aria-label="Filtrar bloqueos por profesional" className="h-10 rounded-xl border border-input bg-blanco px-3 font-normal" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="salon">Todo el salón</option>
            {equipo.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        {lista.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox aria-label="Marcar todos los bloqueos" checked={todosMarcados} onCheckedChange={(v) => setMarcados(v === true ? new Set([...marcados, ...idsVisibles]) : new Set([...marcados].filter((id) => !idsVisibles.includes(id))))} />
            Marcar todos
          </label>
        )}
        <Button type="button" variant="destructive" disabled={marcadosVisibles.length === 0} onClick={() => setConfirmar(marcadosVisibles)}>
          Quitar {marcadosVisibles.length > 0 ? `${marcadosVisibles.length} marcado${marcadosVisibles.length === 1 ? "" : "s"}` : "marcados"}
        </Button>
      </div>
      {lista.length === 0 ? (
        <p className="rounded-2xl bg-nata p-3.5 text-sm text-muted-foreground">No hay bloqueos{filtro === "todos" ? "" : " con ese filtro"}. Todo el horario está libre.</p>
      ) : (
        <ul className="divide-y rounded-2xl border border-lino" aria-label="Bloqueos">
          {lista.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-3.5 py-2 text-sm">
              <Checkbox aria-label={`Marcar bloqueo ${cuando(b, zona)}`} checked={marcados.has(b.id)} onCheckedChange={(v) => alternar(b.id, v === true)} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{cuando(b, zona)}</p>
                <p className="truncate text-muted-foreground">{nombre(b.profesionalId)}{b.motivo ? ` · ${b.motivo}` : ""}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmar([b.id])}>Quitar</Button>
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={confirmar !== null} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar?.length === 1 ? "¿Quitar este bloqueo?" : `¿Quitar ${confirmar?.length ?? 0} bloqueos?`}</AlertDialogTitle>
            <AlertDialogDescription>Esas horas volverán a estar libres para reservar. Si te equivocas, puedes deshacerlo desde el aviso que aparece después.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={quitar}>Sí, quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function BloqueosDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Bloqueos</DialogTitle>
          <DialogDescription>Las horas que están cerradas en la agenda. Marca las que ya no hagan falta y quítalas.</DialogDescription>
        </DialogHeader>
        <ListaBloqueos />
      </DialogContent>
    </Dialog>
  );
}
