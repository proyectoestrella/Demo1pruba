import { useState, type ReactNode } from "react";
import { Droplet, TriangleAlert } from "lucide-react";
import { BookingAnswersSummary } from "./BookingAnswersSummary";
import { eur } from "@/lib/copy";
import type { fichaDeClienta } from "@/lib/ficha-clienta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Ficha = ReturnType<typeof fichaDeClienta>;
const fecha = (iso?: string) => iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fechaCorta = (iso?: string) => iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "") : "—";

/** Etiqueta de sección de la ficha: 11 px, mayúsculas, la única permitida. */
export function EtiquetaFicha({ children }: { children: ReactNode }) {
  return <p className="mt-5 mb-2 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{children}</p>;
}

/** Cuaderno técnico de la clienta, con la fórmula a la vista en cada visita. */
export interface DatosColorTPV { fecha: string; producto: string; cantidad: string; raiz: string; medios: string; puntas: string; tiempo: string; notas: string }

/**
 * Ficha «Arena» (DESIGN.md), como el panel del prototipo: cuatro cifras,
 * avisos, último color con «Añadir color de TPV 123» e historial en línea de
 * tiempo. `antesDelHistorial` es el hueco para lo que el panel pone entre
 * medias (próximas citas, observaciones, deuda).
 */
export function FichaCompleta({ ficha, onAddColor, antesDelHistorial }: { ficha: Ficha; onAddColor?: (datos: DatosColorTPV) => void; antesDelHistorial?: ReactNode }) {
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
  const frecuencia = resumen.frecuenciaMediaDias === undefined
    ? "—"
    : resumen.frecuenciaMediaDias < 14 ? `${resumen.frecuenciaMediaDias} días` : `${Math.round(resumen.frecuenciaMediaDias / 7)} sem.`;

  return <section aria-label="Ficha completa">
    {/* Cuatro cifras */}
    <div className="grid grid-cols-4 gap-2">
      <Cifra valor={String(resumen.numeroVisitas)} etiqueta="Visitas" />
      <Cifra valor={frecuencia} etiqueta="Frecuencia" />
      <Cifra valor={eur(resumen.gastoTotal).replace(",00", "")} etiqueta="Gasto orient." />
      <Cifra valor={fechaCorta(resumen.ultimaVisita)} etiqueta="Última visita" />
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
      <Dato etiqueta="Servicio habitual" valor={resumen.servicioHabitual ?? "—"} />
      <Dato etiqueta="Profesional habitual" valor={resumen.profesionalHabitual ?? "—"} />
      <Dato etiqueta="Primera visita" valor={fecha(resumen.primeraVisita)} />
      <Dato etiqueta="Últimos 12 meses" valor={eur(resumen.gastoUltimos12Meses)} />
    </dl>

    {avisos.length > 0 && <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-melocoton-borde bg-melocoton px-3.5 py-3 text-[12.5px] text-melocoton-tinta">
      <TriangleAlert className="mt-px size-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
      <ul className="space-y-0.5">{avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul>
    </div>}

    <EtiquetaFicha>Último color</EtiquetaFicha>
    {resumen.ultimoColor ? <div className="flex gap-2 rounded-xl bg-salvia-clara px-3 py-2.5 text-[12.5px] text-hoja-tinta">
      <Droplet className="mt-px size-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
      <span><b className="block text-sm">{resumen.ultimoColor.formula}</b>{fecha(resumen.ultimoColor.fecha)}</span>
    </div> : <div className="rounded-2xl border-[1.5px] border-dashed border-lino-fuerte px-4 py-3 text-center text-[12.5px] text-muted-foreground">
      <b className="block text-sm text-foreground">Aún no hay fórmula</b>
      Añádela desde el TPV y la tendrás a mano la próxima vez.
    </div>}
    {onAddColor && <div className="mt-2" data-vaul-no-drag>
      <Button type="button" variant="outline" onClick={() => { setFormularioColor((v) => !v); setMensajeColor(""); }} className="h-[42px] w-full gap-2">
        <Droplet className="size-[18px]" strokeWidth={1.6} />
        {formularioColor ? "Cerrar" : "Añadir color de TPV 123"}
      </Button>
      {formularioColor && <div className="mt-3 space-y-3 rounded-2xl border border-border bg-perla p-4">
        <p className="text-[12.5px] text-muted-foreground">Copia aquí el color que consultas en TPV 123.</p>
        <label className="block space-y-1 text-[12.5px] font-bold text-cafe-medio">Fecha<Input type="date" max={new Date().toLocaleDateString("sv-SE")} value={color.fecha} onChange={(e) => setColor({ ...color, fecha: e.target.value })} className="min-h-11 font-normal" /></label>
        <label className="block space-y-1 text-[12.5px] font-bold text-cafe-medio">Producto o tinte<Input value={color.producto} onChange={(e) => setColor({ ...color, producto: e.target.value })} placeholder="7.1 + 8.0" className="min-h-11 font-normal" /></label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([ ["cantidad", "Cantidad"], ["raiz", "Raíz"], ["medios", "Medios"], ["puntas", "Puntas"], ["tiempo", "Tiempo"] ] as const).map(([key, label]) => <label key={key} className="space-y-1 text-[12.5px] font-bold text-cafe-medio">{label}<Input value={color[key]} onChange={(e) => setColor({ ...color, [key]: e.target.value })} placeholder={key === "tiempo" ? "35 min" : ""} className="min-h-11 font-normal" /></label>)}
        </div>
        <label className="block space-y-1 text-[12.5px] font-bold text-cafe-medio">Notas<Textarea rows={2} value={color.notas} onChange={(e) => setColor({ ...color, notas: e.target.value })} className="resize-y font-normal" /></label>
        <Button type="button" onClick={guardarColor} disabled={!color.producto.trim() || !color.fecha || color.fecha > new Date().toLocaleDateString("sv-SE")} className="min-h-11 w-full">Guardar color y anotar otro</Button>
        {mensajeColor && <p role="status" className="text-[12.5px] font-bold text-hoja-tinta">{mensajeColor}</p>}
      </div>}
    </div>}

    {antesDelHistorial}

    <EtiquetaFicha>Historial</EtiquetaFicha>
    {visitas.length === 0 ? <p className="text-[12.5px] text-muted-foreground">Aún no hay visitas completadas.</p> :
      <ol className="relative ml-1.5 space-y-3 border-l-2 border-lino pl-5">
        {visitas.map((v) => <li key={v.id} className="relative before:absolute before:top-1 before:-left-[27px] before:size-3 before:rounded-full before:border-2 before:border-salvia before:bg-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-muted-foreground tabular-nums">
                {fecha(v.fecha)} · {v.profesional}
                {v.origen === "tpv123" && <span className="ml-1.5 rounded-full bg-nata px-1.5 py-px text-[11px] font-bold text-cafe-medio">TPV 123</span>}
              </p>
              <p className="font-bold">{v.servicios.length ? v.servicios.join(" + ") : "Color anotado"}</p>
            </div>
            {v.importe > 0 && <span className="shrink-0 font-bold tabular-nums">{eur(v.importe).replace(",00", "")}</span>}
          </div>
          {v.colorFormula && <p className="mt-1.5 flex gap-1.5 rounded-xl bg-salvia-clara px-2.5 py-1.5 text-[12.5px] text-hoja-tinta"><Droplet className="mt-px size-3.5 shrink-0" strokeWidth={1.6} />{v.colorFormula}</p>}
          {v.technicalNotes && <p className="mt-1 rounded-xl bg-nata px-2.5 py-1.5 text-[12.5px] text-cafe-medio">{v.technicalNotes}</p>}
          <BookingAnswersSummary answers={v.bookingAnswers} />
        </li>)}
      </ol>}
  </section>;
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return <div className="min-w-0 rounded-2xl bg-nata px-2.5 py-2.5">
    <p className="truncate text-base font-extrabold tabular-nums">{valor}</p>
    <p className="text-[11px] font-bold tracking-[0.04em] text-muted-foreground uppercase">{etiqueta}</p>
  </div>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return <div className="min-w-0"><dt className="text-muted-foreground">{etiqueta}</dt><dd className="truncate font-bold">{valor}</dd></div>;
}
