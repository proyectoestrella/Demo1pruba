import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, TriangleAlert } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { inferBusinessType } from "@/lib/business-type";
import { bookingQuestionsEnabled } from "@/lib/booking-answers";
import {
  MAX_PREGUNTAS,
  idPreguntaNueva,
  preguntaPorSalud,
  preguntasAplicables,
  preguntasDelSalon,
  type PreguntaReserva,
  type TipoPreguntaReserva,
} from "@/lib/preguntas-maqueta";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Editor de las preguntas del formulario de reserva (lote 9k), contra el
 * contrato de BACKEND (adaptador preguntas-maqueta.ts, CONECTAR). Añadir,
 * ordenar, desactivar (mejor que borrar: las respuestas antiguas se siguen
 * leyendo con su texto), tipo, obligatoria y a qué servicios aplica, con la
 * vista previa de cómo lo ve la clienta. Se guarda la lista entera.
 */
const TIPOS: { id: TipoPreguntaReserva; texto: string }[] = [
  { id: "texto", texto: "Respuesta libre" },
  { id: "si_no", texto: "Sí o no" },
  { id: "opcion", texto: "Elegir una opción" },
  { id: "numero", texto: "Número" },
];

const AVISO_SALUD =
  "No preguntes por alergias, embarazo, medicación ni otros datos de salud: son datos especialmente protegidos y siShow no los guarda. Eso se pregunta en persona.";

export function AjustesPreguntas() {
  const perfil = useSalonStore((s) => s.salonProfile);
  const services = useSalonStore((s) => s.services);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const tipo = inferBusinessType(perfil.tagline, perfil.name);
  const inicial = () => preguntasDelSalon(perfil, bookingQuestionsEnabled(perfil, tipo)).map((q) => ({ ...q }));
  const [lista, setLista] = useState<PreguntaReserva[]>(inicial);
  const [cambios, setCambios] = useState(false);
  const [vistaServicio, setVistaServicio] = useState<string>("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!cambios) setLista(inicial()); }, [perfil.preguntasReserva]);
  const activos = services.filter((s) => s.active !== false);

  const cambiar = (i: number, patch: Partial<PreguntaReserva>) => {
    setLista((l) => l.map((q, k) => (k === i ? { ...q, ...patch } : q)));
    setCambios(true);
  };
  const mover = (i: number, d: -1 | 1) => {
    setLista((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setCambios(true);
  };
  const anadir = () => {
    setLista((l) => [...l, { id: idPreguntaNueva(l), texto: "", tipo: "texto", obligatoria: false, activa: true }]);
    setCambios(true);
  };
  const guardar = () => {
    const vacias = lista.filter((q) => q.activa && !q.texto.trim());
    if (vacias.length) return toast.error("Escribe el texto de cada pregunta activa, o desactívala.");
    const sinOpciones = lista.filter((q) => q.activa && q.tipo === "opcion" && (q.opciones?.filter(Boolean).length ?? 0) < 2);
    if (sinOpciones.length) return toast.error("Las preguntas de «Elegir una opción» necesitan al menos dos opciones.");
    updateSalonProfile({
      preguntasReserva: lista.map((q) => ({
        ...q,
        texto: q.texto.trim(),
        opciones: q.tipo === "opcion" ? q.opciones?.map((o) => o.trim()).filter(Boolean) : undefined,
        detalle: q.tipo === "si_no" && q.detalle?.texto.trim() ? { ...q.detalle, texto: q.detalle.texto.trim() } : undefined,
      })),
    });
    setCambios(false);
    toast.success("Preguntas guardadas");
  };

  const campo = "h-9 rounded-xl border border-input bg-blanco px-2.5 text-[13.5px]";
  const vista = preguntasAplicables(lista, vistaServicio ? [vistaServicio] : activos.map((s) => s.id));

  return (
    <div className="space-y-4">
      <p role="note" className="flex items-start gap-2 rounded-2xl border border-melocoton-borde bg-melocoton px-3.5 py-2.5 text-[13px] font-semibold text-melocoton-tinta">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        {AVISO_SALUD}
      </p>

      <ol className="space-y-3">
        {lista.map((q, i) => {
          const salud = preguntaPorSalud(q.texto) || preguntaPorSalud(q.detalle?.texto ?? "");
          return (
            <li key={q.id} className={cn("space-y-3 rounded-2xl border bg-card p-3.5", q.activa ? "border-lino" : "border-dashed border-lino opacity-70")}>
              <div className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-[13px] font-bold text-cafe-suave tabular-nums">{i + 1}.</span>
                <input
                  aria-label={`Texto de la pregunta ${i + 1}`}
                  value={q.texto}
                  maxLength={160}
                  onChange={(e) => cambiar(i, { texto: e.target.value })}
                  placeholder="Escribe la pregunta"
                  className={cn(campo, "min-w-0 flex-1 font-semibold")}
                />
                <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="grid size-9 place-items-center rounded-full text-cafe-medio hover:bg-beige disabled:opacity-30">
                  <ArrowUp className="size-4" strokeWidth={1.8} />
                </button>
                <button type="button" aria-label="Bajar" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} className="grid size-9 place-items-center rounded-full text-cafe-medio hover:bg-beige disabled:opacity-30">
                  <ArrowDown className="size-4" strokeWidth={1.8} />
                </button>
              </div>
              {salud && (
                <p role="alert" className="ml-7 text-[12.5px] font-bold text-melocoton-tinta">
                  Parece una pregunta de salud: no la hagas por aquí. Son datos especialmente protegidos y siShow no los guarda; eso se pregunta en persona.
                </p>
              )}
              <div className="ml-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                <label className="flex items-center gap-2">
                  Tipo
                  <select className={campo} value={q.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoPreguntaReserva })}>
                    {TIPOS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.texto}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-[var(--hoja)]" checked={q.obligatoria} onChange={(e) => cambiar(i, { obligatoria: e.target.checked })} />
                  Obligatoria
                </label>
                <label className="flex items-center gap-2">
                  <Switch aria-label={`Pregunta ${i + 1} activa`} checked={q.activa} onCheckedChange={(v) => cambiar(i, { activa: v })} />
                  {q.activa ? "Activa" : "Desactivada"}
                </label>
              </div>
              {q.tipo === "opcion" && (
                <label className="ml-7 grid gap-1 text-[12.5px] font-bold text-cafe">
                  Opciones, separadas por comas
                  <input
                    className={campo}
                    value={(q.opciones ?? []).join(", ")}
                    onChange={(e) => cambiar(i, { opciones: e.target.value.split(",").map((o) => o.trimStart()) })}
                    placeholder="Corto, Medio, Largo"
                  />
                </label>
              )}
              {q.tipo === "si_no" && (
                <div className="ml-7 flex flex-wrap items-end gap-2">
                  <label className="grid min-w-[220px] flex-1 gap-1 text-[12.5px] font-bold text-cafe">
                    Si responde «Sí», preguntar además
                    <input
                      className={campo}
                      value={q.detalle?.texto ?? ""}
                      placeholder="Opcional: por ejemplo, ¿cuál?"
                      onChange={(e) => cambiar(i, { detalle: { id: q.detalle?.id ?? `${q.id}Detalle`, texto: e.target.value, obligatorio: q.detalle?.obligatorio ?? false } })}
                    />
                  </label>
                  {q.detalle?.texto && (
                    <label className="flex h-9 items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--hoja)]"
                        checked={q.detalle.obligatorio}
                        onChange={(e) => cambiar(i, { detalle: { ...q.detalle!, obligatorio: e.target.checked } })}
                      />
                      Obligatorio
                    </label>
                  )}
                </div>
              )}
              <div className="ml-7 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                <span className="mr-1 font-bold text-cafe">Se pregunta en</span>
                <button
                  type="button"
                  aria-pressed={!q.servicios?.length}
                  onClick={() => cambiar(i, { servicios: undefined })}
                  className={cn("h-7 rounded-full border px-2.5 font-bold", !q.servicios?.length ? "border-salvia bg-salvia-clara" : "border-lino text-cafe-medio")}
                >
                  Todos los servicios
                </button>
                {activos.map((s) => {
                  const on = !!q.servicios?.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const actual = q.servicios ?? [];
                        const nuevo = on ? actual.filter((x) => x !== s.id) : [...actual, s.id];
                        cambiar(i, { servicios: nuevo.length ? nuevo : undefined });
                      }}
                      className={cn("h-7 rounded-full border px-2.5 font-bold", on ? "border-salvia bg-salvia-clara" : "border-lino text-cafe-medio")}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={anadir} disabled={lista.length >= MAX_PREGUNTAS} className="gap-1.5">
          <Plus className="size-4" strokeWidth={1.8} /> Añadir pregunta
          {lista.length >= MAX_PREGUNTAS && " (máximo 12)"}
        </Button>
        <Button onClick={guardar} disabled={!cambios}>
          Guardar preguntas
        </Button>
      </div>

      {/* Vista previa: el formulario tal como lo verá la clienta. */}
      <div className="space-y-3 rounded-2xl bg-nata p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-bold text-cafe">Así lo ve la clienta al reservar</p>
          <select aria-label="Vista previa para el servicio" className={cn(campo, "ml-auto")} value={vistaServicio} onChange={(e) => setVistaServicio(e.target.value)}>
            <option value="">Cualquier servicio</option>
            {activos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {vista.length === 0 ? (
          <p className="text-[13px] text-cafe-suave">Sin preguntas para esta reserva.</p>
        ) : (
          <div className="space-y-3">
            {vista.map((q) => (
              <div key={q.id} className="grid gap-1.5">
                <span className="text-[13px] font-bold text-cafe">
                  {q.texto || "Pregunta sin texto"}
                  {q.obligatoria ? " *" : ""}
                </span>
                {q.tipo === "texto" && <input disabled className={cn(campo, "bg-blanco")} placeholder="Su respuesta" />}
                {q.tipo === "numero" && <input disabled className={cn(campo, "w-28 bg-blanco")} placeholder="0" />}
                {q.tipo === "opcion" && (
                  <select disabled className={cn(campo, "bg-blanco")}>
                    <option>Elige una opción</option>
                  </select>
                )}
                {q.tipo === "si_no" && (
                  <span className="flex gap-1.5">
                    {["Sí", "No"].map((o) => (
                      <span key={o} className="inline-flex h-8 items-center rounded-full border border-lino bg-blanco px-3 text-[13px]">
                        {o}
                      </span>
                    ))}
                    {q.detalle?.texto && <span className="self-center text-[12px] text-cafe-suave">Si dice «Sí»: {q.detalle.texto}</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[12px] text-cafe-suave">* obligatoria</p>
      </div>
    </div>
  );
}
