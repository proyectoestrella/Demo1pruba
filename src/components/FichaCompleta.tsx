import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode } from "react";
import { Droplet, TriangleAlert } from "lucide-react";
import { BookingAnswersSummary } from "./BookingAnswersSummary";
import { eur } from "@/lib/copy";
import { ultimaVisitaParaFicha, type fichaDeClienta } from "@/lib/ficha-clienta";
import { Button } from "@/components/ui/button";
import { Desplegable } from "@/components/Desplegable";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/lib/mock/types";

type Ficha = ReturnType<typeof fichaDeClienta>;
const fecha = (iso?: string) => iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fechaCorta = (iso?: string) => iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "") : "—";

/** Etiqueta de sección de la ficha: 11 px, mayúsculas, la única permitida. */
export function EtiquetaFicha({ children, id }: { children: ReactNode; id?: string }) {
  return <p id={id} className="mt-5 mb-2 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{children}</p>;
}

/** Cuaderno técnico de la clienta, con la fórmula a la vista en cada visita. */
export interface DatosColorTPV { fecha: string; producto: string; cantidad: string; raiz: string; medios: string; puntas: string; tiempo: string; notas: string }

/**
 * Ficha «Arena» (DESIGN.md), como el panel del prototipo: cuatro cifras,
 * avisos, último color con «Añadir color de TPV 123» e historial en línea de
 * tiempo. `antesDelHistorial` es el hueco para lo que el panel pone entre
 * medias (próximas citas, observaciones, deuda).
 */
export function FichaCompleta({ ficha, client, onAddColor, antesDelHistorial, origenTpv123 = false, onAbrirCita }: { ficha: Ficha; client?: Client; onAddColor?: (datos: DatosColorTPV) => void; antesDelHistorial?: ReactNode; origenTpv123?: boolean; onAbrirCita?: (id: string) => void }) {
  const { resumen, avisos, visitas } = ficha;
  const [formularioColor, setFormularioColor] = useState(false);
  const [verTodoHistorial, setVerTodoHistorial] = useState(false);
  useEffect(() => {
    setVerTodoHistorial(false);
    setFormularioColor(false);
    setMensajeColor("");
  }, [client?.id]);
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
  // La agenda propia siempre es la fuente de verdad. El dato de TPV 123 solo
  // rellena el hueco de una ficha recién importada, sin inventar una cita.
  const ultimaVisitaMostrada = ultimaVisitaParaFicha(resumen.ultimaVisita, client?.tpvLastVisit);
  const ultimaVisita = ultimaVisitaMostrada.fecha;
  const ultimaVisitaEsTpv = ultimaVisitaMostrada.segunTpv;
  const tieneDatosImportados = !!client && !!(client.birthday || client.address || client.taxId || client.tpvAltaDate || ultimaVisitaEsTpv);

  return <section aria-label="Ficha completa">
    <dl className="mt-4 grid grid-cols-2 gap-2">
      {[
        [String(resumen.numeroVisitas), resumen.numeroVisitas === 1 ? "Visita" : "Visitas"],
        [frecuencia, "Frecuencia media"],
        [eur(resumen.gastoTotal).replace(",00", ""), "Gasto acumulado"],
        [fechaCorta(ultimaVisita), ultimaVisitaEsTpv ? "Última visita según TPV 123" : "Última visita"],
      ].map(([valor, etiqueta]) => <div key={etiqueta} className="min-w-0 rounded-2xl bg-card px-4 py-3">
        <dt className="text-[11.5px] text-muted-foreground">{etiqueta}</dt>
        <dd className="mt-1 text-lg font-bold text-foreground tabular-nums">{valor}</dd>
      </div>)}
    </dl>
    <Desplegable titulo="Hábitos y gasto" resumen={`${resumen.servicioHabitual ?? "Sin servicio habitual"} · ${resumen.profesionalHabitual ?? "sin profesional habitual"}`} className="mt-3 rounded-2xl border-0 bg-card px-4 py-1">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
        <Dato etiqueta="Servicio habitual" valor={resumen.servicioHabitual ?? "—"} />
        <Dato etiqueta="Profesional habitual" valor={resumen.profesionalHabitual ?? "—"} />
        <Dato etiqueta="Primera visita" valor={fecha(resumen.primeraVisita)} />
        <Dato etiqueta="Últimos 12 meses" valor={eur(resumen.gastoUltimos12Meses)} />
      </dl>
    </Desplegable>

    {tieneDatosImportados && <Desplegable titulo="Datos de la ficha" resumen={client?.address ?? (client?.tpvAltaDate ? `Cliente desde ${fecha(client.tpvAltaDate)}` : "Datos importados de TPV 123")} className="mt-3 rounded-2xl border-0 bg-card px-4 py-1">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
        {client?.birthday && <Dato etiqueta="Cumpleaños" valor={fecha(client.birthday)} />}
        {client?.address && <Dato etiqueta="Dirección" valor={client.address} />}
        {client?.tpvAltaDate && <Dato etiqueta="Cliente desde" valor={fecha(client.tpvAltaDate)} />}
        {ultimaVisitaEsTpv && <Dato etiqueta="Última visita" valor={`${fecha(client?.tpvLastVisit)} · según TPV 123`} />}
        {/* Dato fiscal: intencionadamente solo llega a este componente de ficha. */}
        {client?.taxId && <Dato etiqueta="DNI/CIF" valor={client.taxId} />}
      </dl>
    </Desplegable>}

    {avisos.length > 0 && <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-melocoton px-3.5 py-3 text-[12.5px] text-melocoton-tinta">
      <TriangleAlert className="mt-px size-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
      <ul className="space-y-0.5">{avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul>
    </div>}

    <section className="mt-3 rounded-2xl bg-card px-4 pb-4 pt-1">
    <EtiquetaFicha>Último color</EtiquetaFicha>
    {resumen.ultimoColor ? <div className="flex gap-2 rounded-xl bg-salvia-clara px-3 py-2.5 text-[12.5px] text-hoja-tinta">
      <Droplet className="mt-px size-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
      <span><b className="block text-sm">{resumen.ultimoColor.formula}</b>{fecha(resumen.ultimoColor.fecha)}</span>
    </div> : <p className="text-[13px] text-muted-foreground">Sin fórmula anotada todavía.</p>}
    {onAddColor && <div className="mt-2" data-vaul-no-drag>
      <Button type="button" variant={resumen.ultimoColor ? "outline" : "ghost"} onClick={() => { setFormularioColor((v) => !v); setMensajeColor(""); }} className={cn("gap-2", resumen.ultimoColor ? "h-[42px] w-full" : "-ml-3 h-9")}>
        <Droplet className="size-[18px]" strokeWidth={1.6} />
        {formularioColor ? "Cerrar" : origenTpv123 ? "Añadir color de TPV 123" : "Añadir color"}
      </Button>
      {formularioColor && <div className="mt-3 space-y-3 rounded-2xl border border-border bg-perla p-4">
        <p className="text-[12.5px] text-muted-foreground">Anota aquí el color usado en el servicio.</p>
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

    </section>

    {antesDelHistorial}

    {visitas.length > 0 && <section className="mt-3 rounded-2xl bg-card px-4 pb-4 pt-1">
      <EtiquetaFicha>Historial</EtiquetaFicha>
      <ol className="relative ml-1.5 space-y-3 border-l-2 border-lino pl-5">
        {(verTodoHistorial ? visitas : visitas.slice(0, 3)).map((v) => <li key={v.id} className="relative before:absolute before:top-1 before:-left-[27px] before:size-3 before:rounded-full before:border-2 before:border-salvia before:bg-card">
          <button type="button" disabled={!onAbrirCita} onClick={() => onAbrirCita?.(v.id)} aria-label={`Abrir la cita del ${fecha(v.fecha)}`} className="-mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-2 rounded-xl px-2 py-1 text-left enabled:hover:bg-nata focus-visible:outline-2 focus-visible:outline-primary">
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-muted-foreground tabular-nums">
                {fecha(v.fecha)} · {v.profesional}
                {v.origen === "tpv123" && <span className="ml-1.5 rounded-full bg-nata px-1.5 py-px text-[11px] font-bold text-cafe-medio">TPV 123</span>}
              </p>
              <p className="font-bold">{v.servicios.length ? v.servicios.join(" + ") : "Color anotado"}</p>
            </div>
            {v.importe > 0 && <span className="shrink-0 font-bold tabular-nums">{eur(v.importe).replace(",00", "")}</span>}
          </button>
          {v.colorFormula && <p className="mt-1.5 flex gap-1.5 rounded-xl bg-salvia-clara px-2.5 py-1.5 text-[12.5px] text-hoja-tinta"><Droplet className="mt-px size-3.5 shrink-0" strokeWidth={1.6} />{v.colorFormula}</p>}
          {v.technicalNotes && <p className="mt-1 rounded-xl bg-nata px-2.5 py-1.5 text-[12.5px] text-cafe-medio">{v.technicalNotes}</p>}
          <BookingAnswersSummary answers={v.bookingAnswers} />
        </li>)}
      </ol>
      {visitas.length > 3 && <Button type="button" variant="ghost" className="mt-3 min-h-11 w-full"
        aria-expanded={verTodoHistorial} onClick={() => setVerTodoHistorial((actual) => !actual)}>
        {verTodoHistorial ? "Ver solo las últimas 3 visitas" : `Ver las ${visitas.length} visitas`}
      </Button>}
    </section>}
  </section>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return <div className="min-w-0"><dt className="text-muted-foreground">{etiqueta}</dt><dd className="break-words font-semibold">{valor}</dd></div>;
}
