import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { citasFuturasAfectadas, resumenCambioServicios } from "@/lib/servicios-profesional";
import type { Appointment, Service } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

/**
 * Servicios de una profesional, en lote: se marcan casillas en un borrador y no
 * pasa nada hasta «Guardar». Resume los cambios («+3 / −1») y pide confirmar si
 * se quitan servicios con citas futuras. Tras guardar, el aviso «Deshacer» lo
 * pone `guardarPerfil`.
 */
export function EditorServiciosProfesional({
  empleado,
  carta,
  asignados,
  citas,
  onGuardar,
}: {
  empleado: { id: string; name: string };
  carta: Service[];
  asignados: string[];
  citas: Appointment[];
  onGuardar: (ids: string[]) => void;
}) {
  const [borrador, setBorrador] = useState<string[] | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const total = carta.length;
  const nombresPorId = new Map(carta.map((s) => [s.id, s.name]));

  if (!borrador) {
    return (
      <div className="flex items-center gap-3 border-t border-border px-5 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">Servicios</span>
          <span className="text-[14px] font-semibold text-cafe tabular-nums">
            {asignados.length === total ? `Toda la carta · ${total}` : `${asignados.length} de ${total}`}
          </span>
        </span>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setBorrador(asignados)}>
          Editar servicios
        </Button>
      </div>
    );
  }

  const resumen = resumenCambioServicios(asignados, borrador);
  const afectadas = citasFuturasAfectadas(resumen.quitados, citas, empleado.id, new Date());
  const porCategoria = carta.reduce<Record<string, Service[]>>((out, s) => {
    (out[s.category?.trim() || "Sin categoría"] ??= []).push(s);
    return out;
  }, {});
  const alternar = (id: string) => setBorrador(borrador.includes(id) ? borrador.filter((x) => x !== id) : [...borrador, id]);
  const guardar = () => {
    onGuardar(borrador);
    setBorrador(null);
    setConfirmar(false);
  };

  return (
    <div className="border-t border-border bg-beige/40 px-5 py-4">
      <p className="text-[13px] font-bold">Servicios de {empleado.name}</p>
      <div className="mt-3 space-y-3">
        {Object.entries(porCategoria).map(([categoria, lista]) => (
          <fieldset key={categoria}>
            <legend className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{categoria}</legend>
            <div className="mt-1 grid gap-0.5">
              {lista.map((s) => (
                <label key={s.id} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-[13.5px] hover:bg-card">
                  <input type="checkbox" className="size-4 accent-[var(--hoja)]" checked={borrador.includes(s.id)} onChange={() => alternar(s.id)} />
                  <span className={cn(!borrador.includes(s.id) && "text-muted-foreground")}>{s.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span role="status" className={cn("mr-auto rounded-full px-2.5 py-1 text-[12.5px] font-extrabold tabular-nums", resumen.hayCambios ? "bg-salvia-clara text-hoja-tinta" : "text-muted-foreground")}>
          {resumen.texto}
        </span>
        <Button type="button" variant="ghost" className="rounded-full" onClick={() => setBorrador(null)}>Cancelar</Button>
        <Button type="button" className="rounded-full" disabled={!resumen.hayCambios} onClick={() => (afectadas.length ? setConfirmar(true) : guardar())}>Guardar</Button>
      </div>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar servicios con citas futuras?</AlertDialogTitle>
            <AlertDialogDescription>
              {empleado.name} tiene {afectadas.length} {afectadas.length === 1 ? "cita futura" : "citas futuras"} con {resumen.quitados.filter((id) => afectadas.some((c) => c.serviceIds.includes(id))).map((id) => nombresPorId.get(id) ?? id).join(", ")}.
              Las citas no se cancelan, pero dejará de salir para ese servicio en nuevas reservas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={guardar}>Quitar y guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
