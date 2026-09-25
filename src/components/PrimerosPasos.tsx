import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Copy, ExternalLink, Eye, EyeOff, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PASOS = [
  { titulo: "Tu carta", detalle: "Servicios, duración y precio", to: "/app/services" as const },
  { titulo: "Tu equipo", detalle: "Profesionales y horario de cada una", to: "/app/employees" as const },
  { titulo: "Horario del salón y tu web", detalle: "Cuándo abres y qué verán tus clientas", to: "/app/web" as const },
  { titulo: "Fianza y preguntas al reservar", detalle: "Decide qué necesitas saber antes de confirmar", to: "/app/settings" as const },
  { titulo: "Traer tus clientas de TPV 123", detalle: "Importa tu cartera desde Clientas", to: "/app/clients" as const },
] as const;

/** Seis pasos en total: los cinco de arriba más «compartir el enlace». */
export const TOTAL_PASOS = 6;

/**
 * Qué pasos están hechos (a mano o detectados solos) y cuáles faltan. Lo
 * usan la lista completa de aquí y el resumen del menú lateral, para que los
 * dos cuenten exactamente lo mismo.
 */
export function useProgresoPrimerosPasos() {
  const profile = useSalonStore((s) => s.salonProfile);
  const appointments = useSalonStore((s) => s.appointments);
  const automáticos = new Set<number>();
  if (profile.menu?.length) automáticos.add(0);
  if (profile.team?.length && profile.teamHours?.length && profile.teamHours.length >= profile.team.length) automáticos.add(1);
  if (appointments.some((a) => a.origen === "tpv123")) automáticos.add(4);
  const marcados = new Set([...(profile.setupChecklistDone ?? []), ...automáticos]);
  const pendientes = [...PASOS.map((p) => p.titulo), "Compartir tu enlace de reservas"].filter(
    (_, i) => !marcados.has(i),
  );
  return { automáticos, marcados, progreso: marcados.size, pendientes, oculto: !!profile.setupChecklistHidden };
}

export function PrimerosPasos({ enAjustes = false }: { enAjustes?: boolean }) {
  const profile = useSalonStore((s) => s.salonProfile);
  const update = useSalonStore((s) => s.updateSalonProfile);
  const demoActive = useSalonStore((s) => s.demoActive);
  const [abierto, setAbierto] = useState(enAjustes || !demoActive);
  const { automáticos, marcados, progreso, oculto } = useProgresoPrimerosPasos();

  if (enAjustes && oculto) return <Button variant="outline" className="gap-2" onClick={() => update({ setupChecklistHidden: false })}><Eye className="size-4" />Volver a ver los primeros pasos</Button>;
  if (oculto && !enAjustes) return null;

  const marcar = (paso: number, hecho: boolean) => {
    const siguiente = new Set(profile.setupChecklistDone ?? []);
    if (hecho) siguiente.add(paso); else siguiente.delete(paso);
    update({ setupChecklistDone: [...siguiente] });
  };
  const copiarEnlace = async () => {
    const url = `${window.location.origin}/s/${profile.slug}/book`;
    try { await navigator.clipboard.writeText(url); toast.success("Enlace de reservas copiado"); }
    catch { toast.error("No se ha podido copiar. Abre tu web y copia el enlace desde allí."); }
  };
  const tareaCompartir = 5;
  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card" aria-label="Primeros pasos">
      <button type="button" className="flex min-h-16 w-full items-center gap-3 p-4 text-left sm:px-5" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-salvia-clara text-hoja-tinta"><ListChecks className="size-5" strokeWidth={1.6} /></span>
        <span className="min-w-0 flex-1"><span className="block text-base font-extrabold">Primeros pasos</span><span className="block text-[12.5px] text-muted-foreground tabular-nums">{progreso} de 6 listos</span></span>
        {!enAjustes && <span className="mr-2 text-xs text-muted-foreground">{oculto ? "" : "Puedes ocultarlo"}</span>}
        <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", abierto && "rotate-180")} />
      </button>
      {abierto && <div className="border-t border-border p-3 sm:p-4">
        <ol className="space-y-2">
          {PASOS.map((paso, i) => {
            const done = marcados.has(i);
            const automatico = automáticos.has(i);
            return <li key={paso.titulo} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-perla">
              <button type="button" disabled={automatico} onClick={() => marcar(i, !done)} aria-label={`${done ? "Desmarcar" : "Marcar"}: ${paso.titulo}`} aria-pressed={done} className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2", done ? "border-hoja bg-hoja text-white" : "border-lino-fuerte bg-card", automatico && "cursor-default")}>
                {done && <Check className="size-4" />}
              </button>
              <Link to={paso.to} className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={cn("block text-sm font-bold", done && "text-muted-foreground line-through")}>{i + 1}. {paso.titulo}</span><span className="block text-xs text-muted-foreground">{paso.detalle}{automatico ? " · Listo" : ""}</span>
              </Link>
              <Link to={paso.to} aria-label={`Abrir: ${paso.titulo}`} className="rounded-md p-2 text-primary"><ExternalLink className="size-4" /></Link>
            </li>;
          })}
          <li className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-perla">
            <button type="button" onClick={() => marcar(tareaCompartir, !marcados.has(tareaCompartir))} aria-label={`${marcados.has(tareaCompartir) ? "Desmarcar" : "Marcar"}: Compartir enlace de reservas`} aria-pressed={marcados.has(tareaCompartir)} className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2", marcados.has(tareaCompartir) ? "border-hoja bg-hoja text-white" : "border-lino-fuerte bg-card")}>{marcados.has(tareaCompartir) && <Check className="size-4" />}</button>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">6. Comparte tu enlace de reservas</span><span className="block text-xs text-muted-foreground">En Instagram, Google o tu web</span></span>
            <Button type="button" variant="outline" size="sm" className="min-h-10 gap-2" onClick={copiarEnlace}><Copy className="size-4" /><span className="hidden sm:inline">Copiar enlace</span></Button>
          </li>
        </ol>
        {!enAjustes && <div className="mt-3 flex justify-end border-t border-border pt-3"><Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => update({ setupChecklistHidden: true })}><EyeOff className="size-4" />Ocultar estos pasos</Button></div>}
      </div>}
    </section>
  );
}
