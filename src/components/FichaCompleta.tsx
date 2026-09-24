import { useState } from "react";
import { BookingAnswersSummary } from "./BookingAnswersSummary";
import { eur } from "@/lib/copy";
import type { fichaDeClienta } from "@/lib/ficha-clienta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Ficha = ReturnType<typeof fichaDeClienta>;
const fecha = (iso?: string) => iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Cuaderno técnico de la clienta, con la fórmula a la vista en cada visita. */
export interface DatosColorTPV { fecha: string; producto: string; cantidad: string; raiz: string; medios: string; puntas: string; tiempo: string; notas: string }
export function FichaCompleta({ ficha, onAddColor }: { ficha: Ficha; onAddColor?: (datos: DatosColorTPV) => void }) {
  const { resumen, avisos, visitas } = ficha;
  const [formularioColor, setFormularioColor] = useState(false);
  const [mensajeColor, setMensajeColor] = useState("");
  const [color, setColor] = useState<DatosColorTPV>({ fecha: new Date().toLocaleDateString("sv-SE"), producto: "", cantidad: "", raiz: "", medios: "", puntas: "", tiempo: "", notas: "" });
  function guardarColor() {
    if (!onAddColor || !color.fecha || !color.producto.trim()) return;
    onAddColor(color);
    setMensajeColor("Color añadido a la ficha.");
    setColor((actual) => ({ ...actual, producto: "", cantidad: "", raiz: "", medios: "", puntas: "", tiempo: "", notas: "" }));
  }
  return <section className="space-y-4" aria-label="Ficha completa">
    {onAddColor && <div className="rounded-xl border border-primary/30 bg-primary/5 p-4" data-vaul-no-drag>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold">Ficha técnica del color</h3><p className="text-sm text-muted-foreground">Anota aquí el color que consultas en TPV 123.</p></div>
        <Button type="button" variant={formularioColor ? "outline" : "default"} onClick={() => { setFormularioColor((v) => !v); setMensajeColor(""); }} className="min-h-11">{formularioColor ? "Cerrar" : "Añadir color de TPV 123"}</Button>
      </div>
      {formularioColor && <div className="mt-4 space-y-3">
        <label className="block space-y-1 text-sm">Fecha<Input type="date" max={new Date().toLocaleDateString("sv-SE")} value={color.fecha} onChange={(e) => setColor({ ...color, fecha: e.target.value })} className="min-h-11" /></label>
        <label className="block space-y-1 text-sm">Producto / tinte<Input value={color.producto} onChange={(e) => setColor({ ...color, producto: e.target.value })} placeholder="7.1 + 8.0" className="min-h-11" /></label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([ ["cantidad", "Cantidad"], ["raiz", "Raíz"], ["medios", "Medios"], ["puntas", "Puntas"], ["tiempo", "Tiempo"] ] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm">{label}<Input value={color[key]} onChange={(e) => setColor({ ...color, [key]: e.target.value })} placeholder={key === "tiempo" ? "35 min" : ""} className="min-h-11" /></label>)}
        </div>
        <label className="block space-y-1 text-sm">Notas<Textarea rows={2} value={color.notas} onChange={(e) => setColor({ ...color, notas: e.target.value })} className="resize-y" /></label>
        <Button type="button" onClick={guardarColor} disabled={!color.producto.trim() || !color.fecha || color.fecha > new Date().toLocaleDateString("sv-SE")} className="min-h-11 w-full sm:w-auto">Guardar color y anotar otro</Button>
        {mensajeColor && <p role="status" className="text-sm text-primary">{mensajeColor}</p>}
      </div>}
    </div>}
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen de la ficha</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <Dato etiqueta="Visitas" valor={String(resumen.numeroVisitas)} />
        <Dato etiqueta="Última visita" valor={fecha(resumen.ultimaVisita)} />
        <Dato etiqueta="Primera visita" valor={fecha(resumen.primeraVisita)} />
        <Dato etiqueta="Frecuencia media" valor={resumen.frecuenciaMediaDias === undefined ? "—" : `${resumen.frecuenciaMediaDias} días`} />
        <Dato etiqueta="Gasto orientativo" valor={eur(resumen.gastoTotal)} />
        <Dato etiqueta="Últimos 12 meses" valor={eur(resumen.gastoUltimos12Meses)} />
        <Dato etiqueta="Servicio habitual" valor={resumen.servicioHabitual ?? "—"} />
        <Dato etiqueta="Profesional habitual" valor={resumen.profesionalHabitual ?? "—"} />
        <Dato etiqueta="Próxima cita" valor={fecha(resumen.proximaCita)} />
      </div>
      {resumen.ultimoColor && <div className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-sm">
        <span className="text-xs text-muted-foreground">Último color · {fecha(resumen.ultimoColor.fecha)}</span>
        <p className="font-semibold text-foreground">{resumen.ultimoColor.formula}</p>
      </div>}
    </div>
    {avisos.length > 0 && <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Antes de que llegue</p>
      <ul className="space-y-1 text-sm">{avisos.map((aviso) => <li key={aviso}>• {aviso}</li>)}</ul>
    </div>}
    <div>
      <h3 className="mb-2 font-display text-lg">Visitas</h3>
      {visitas.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay visitas completadas.</p> :
        <ol className="space-y-2 border-l-2 border-primary/30 pl-4">
          {visitas.map((v) => <li key={v.id} className="relative rounded-lg border border-border/70 bg-card p-3 text-sm before:absolute before:-left-[23px] before:top-4 before:size-2.5 before:rounded-full before:bg-primary">
            <div className="flex flex-wrap items-start justify-between gap-1">
              <div><time className="text-xs font-medium text-muted-foreground">{fecha(v.fecha)}</time>
                {v.origen === "tpv123" && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Traído de TPV 123</span>}
                <p className="font-semibold">{v.servicios.join(" · ")}</p>
              </div>
              <span className="font-medium">{eur(v.importe)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{v.profesional} · {v.duracion} min</p>
            {v.colorFormula && <p className="mt-2 rounded-md bg-primary/10 px-2 py-1 font-medium">Color: {v.colorFormula}</p>}
            {v.technicalNotes && <p className="mt-1 rounded-md bg-muted px-2 py-1">Notas técnicas: {v.technicalNotes}</p>}
            <BookingAnswersSummary answers={v.bookingAnswers} />
          </li>)}
        </ol>}
    </div>
  </section>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{etiqueta}</p><p className="break-words font-medium">{valor}</p></div>;
}
