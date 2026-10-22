import { useState } from "react";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { DiaEspecial, FranjaEspecial } from "@/lib/mock/types";
import { validarFranjasEspeciales } from "@/lib/opening-hours";

const FESTIVOS_MADRID_2026 = ["2026-10-12", "2026-11-02", "2026-11-09", "2026-12-07", "2026-12-08", "2026-12-25"];

function parseFranjas(value: string): FranjaEspecial[] {
  return validarFranjasEspeciales(value).ranges.map((r) => ({
    inicio: `${String(Math.floor(r.start / 60)).padStart(2, "0")}:${String(r.start % 60).padStart(2, "0")}`,
    fin: `${String(Math.floor(r.end / 60)).padStart(2, "0")}:${String(r.end % 60).padStart(2, "0")}`,
  }));
}

function textoFranjas(franjas: FranjaEspecial[] | undefined): string {
  return (franjas ?? []).map((f) => `${f.inicio}–${f.fin}`).join(", ");
}

type Form = { fecha: string; nota: string; cerrado: boolean; franjas: string; solo: Record<string, string> };
const vacio = (): Form => ({ fecha: "", nota: "", cerrado: false, franjas: "", solo: {} });

function aForm(d?: DiaEspecial): Form {
  return {
    fecha: d?.fecha ?? "",
    nota: d?.nota ?? "",
    cerrado: !!d?.cerrado,
    franjas: textoFranjas(d?.franjas),
    solo: Object.fromEntries(Object.entries(d?.soloProfesionales ?? {}).map(([id, f]) => [id, textoFranjas(f)])),
  };
}

/** Excepciones de fecha del perfil: no requieren una tabla ni una migración. */
export function AjustesDiasEspeciales() {
  const perfil = useSalonStore((s) => s.salonProfile);
  const equipo = useEquipo();
  const [form, setForm] = useState<Form>(vacio);
  const [editando, setEditando] = useState<string | null>(null);
  const lista = [...(perfil.diasEspeciales ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cambiar = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const erroresFranjas = form.cerrado ? [] : validarFranjasEspeciales(form.franjas).errores;
  const erroresSolo = form.cerrado
    ? {} as Record<string, string[]>
    : Object.fromEntries(Object.entries(form.solo).map(([id, valor]) => [id, validarFranjasEspeciales(valor).errores]));
  const hayErrores = erroresFranjas.length > 0 || Object.values(erroresSolo).some((errores) => errores.length > 0);

  const guardar = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha) || hayErrores) return;
    const franjas = parseFranjas(form.franjas);
    const soloProfesionales = Object.fromEntries(Object.entries(form.solo).map(([id, valor]) => [id, parseFranjas(valor)]).filter(([, rangos]) => rangos.length));
    const siguiente: DiaEspecial = {
      fecha: form.fecha,
      ...(form.nota.trim() ? { nota: form.nota.trim() } : {}),
      ...(form.cerrado ? { cerrado: true } : {}),
      ...(!form.cerrado && franjas.length ? { franjas } : {}),
      ...(!form.cerrado && Object.keys(soloProfesionales).length ? { soloProfesionales } : {}),
    };
    const anteriores = (perfil.diasEspeciales ?? []).filter((d) => d.fecha !== (editando ?? form.fecha));
    guardarPerfil({ diasEspeciales: [...anteriores, siguiente].sort((a, b) => a.fecha.localeCompare(b.fecha)) });
    setForm(vacio());
    setEditando(null);
  };
  const editar = (d: DiaEspecial) => { setForm(aForm(d)); setEditando(d.fecha); };
  const borrar = (fecha: string) => guardarPerfil({ diasEspeciales: (perfil.diasEspeciales ?? []).filter((d) => d.fecha !== fecha) });
  const cargarFestivos = () => {
    const existentes = new Set((perfil.diasEspeciales ?? []).map((d) => d.fecha));
    const nuevos = FESTIVOS_MADRID_2026.filter((fecha) => !existentes.has(fecha)).map((fecha) => ({ fecha, cerrado: true as const, nota: "Festivo" }));
    if (nuevos.length) guardarPerfil({ diasEspeciales: [...(perfil.diasEspeciales ?? []), ...nuevos].sort((a, b) => a.fecha.localeCompare(b.fecha)) });
  };
  const campo = "h-10 rounded-xl border border-input bg-blanco px-3 text-sm";

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-[15px] font-extrabold">Festivos y días especiales</h3><p className="mt-1 text-sm text-muted-foreground">Un cierre o apertura por fecha manda sobre el horario semanal.</p></div>
      <Button type="button" variant="outline" className="gap-1.5" onClick={cargarFestivos}><CalendarPlus className="size-4" /> Cargar festivos Madrid 2026</Button>
    </div>
    {lista.length > 0 && <ul className="divide-y rounded-2xl border border-lino">
      {lista.map((d) => {
        // 22-oct: «lun 12/10/2026» en vez de la clave ISO; plural correcto; botones de 44 px.
        const [a, m, dd] = d.fecha.split("-").map(Number);
        const dia = new Date(Date.UTC(a, m - 1, dd)).toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" }).replace(".", "");
        const fechaEs = `${dia} ${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
        const nPros = d.soloProfesionales ? Object.keys(d.soloProfesionales).length : 0;
        return (
          <li key={d.fecha} className="flex items-center gap-2 px-3.5 py-1.5 text-sm">
            <b className="shrink-0 tabular-nums">{fechaEs}</b>
            <span className="min-w-0 flex-1 text-muted-foreground">
              {d.cerrado ? "Cerrado" : d.soloProfesionales ? `Solo ${nPros} ${nPros === 1 ? "profesional" : "profesionales"}` : textoFranjas(d.franjas) || "Horario habitual"}
              {d.nota ? ` · ${d.nota}` : ""}
            </span>
            <button aria-label={`Editar ${fechaEs}`} type="button" onClick={() => editar(d)} className="grid size-11 shrink-0 place-items-center rounded-full text-cafe-medio hover:bg-nata"><Pencil className="size-4" /></button>
            <button aria-label={`Borrar ${fechaEs}`} type="button" onClick={() => borrar(d.fecha)} className="grid size-11 shrink-0 place-items-center rounded-full text-melocoton-tinta hover:bg-nata"><Trash2 className="size-4" /></button>
          </li>
        );
      })}
    </ul>}
    <div className="grid gap-3 rounded-2xl bg-nata p-3.5">
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-[13px] font-bold">Fecha<Input type="date" value={form.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} className={campo} /></label><label className="grid gap-1 text-[13px] font-bold">Nota (opcional)<Input value={form.nota} maxLength={100} onChange={(e) => cambiar({ nota: e.target.value })} placeholder="Por ejemplo, Nochebuena" className={campo} /></label></div>
      <div className="flex items-center justify-between gap-4"><span className="text-sm font-bold">Cerrado todo el día</span><Switch aria-label="Cerrar todo el día" checked={form.cerrado} onCheckedChange={(cerrado) => cambiar({ cerrado })} /></div>
      {!form.cerrado && <><label className="grid gap-1 text-[13px] font-bold">Horario especial del salón <span className="font-normal text-muted-foreground">· opcional, 10:00–15:00</span><Input value={form.franjas} onChange={(e) => cambiar({ franjas: e.target.value })} placeholder="10:00–15:00" className={campo} />{erroresFranjas.length > 0 && <span role="alert" className="text-xs font-medium text-destructive">Corrige las franjas: {erroresFranjas.join(", ")}. El final debe ser posterior al inicio.</span>}</label><div><p className="text-[13px] font-bold">Solo trabajan estas profesionales <span className="font-normal text-muted-foreground">· reemplaza su semana y puede abrir un día cerrado</span></p><div className="mt-2 grid gap-2 sm:grid-cols-2">{equipo.map((e) => { const activo = e.id in form.solo; const errores = erroresSolo[e.id] ?? []; return <label key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-lino bg-card px-3 py-2"><input type="checkbox" checked={activo} onChange={(ev) => { const solo = { ...form.solo }; if (ev.target.checked) solo[e.id] = "10:00–20:00"; else delete solo[e.id]; cambiar({ solo }); }} /><span className="min-w-0 flex-1 text-sm font-bold">{e.name}</span>{activo && <input aria-label={`Horario de ${e.name}`} value={form.solo[e.id]} onChange={(ev) => cambiar({ solo: { ...form.solo, [e.id]: ev.target.value } })} className="h-8 w-28 rounded-lg border border-input px-2 text-xs" />}{errores.length > 0 && <span role="alert" className="w-full text-xs font-medium text-destructive">Corrige: {errores.join(", ")}.</span>}</label>; })}</div></div></>}
      <div className="flex gap-2"><Button type="button" onClick={guardar} disabled={!form.fecha || hayErrores}>{editando ? "Guardar día" : "Añadir día"}</Button>{editando && <Button type="button" variant="ghost" onClick={() => { setForm(vacio()); setEditando(null); }}>Cancelar</Button>}</div>
    </div>
  </div>;
}
