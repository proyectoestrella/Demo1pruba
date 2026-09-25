import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { CATEGORIAS, FAMILIAS, type CategoriaAsistente } from "@/lib/asistente/catalogo-arena";
import { cn } from "@/lib/utils";

/**
 * «Cómo usar el asistente» (lote 10): consejos, todas las preguntas que
 * entiende por categoría (tres ejemplos por familia), un buscador y lo que
 * no hace. Sale del catálogo de la especificación; CONECTAR: con el motor de
 * BACKEND, del catálogo de guia.ts. Nunca enseña las preguntas de plan no
 * incluido ni las dudas técnicas.
 */
export const CONSEJOS = [
  "Escribe como hablas: «cuántas mañana», «color de Elena», «cuánto llevo este mes». No hace falta tildes ni escribirlo perfecto.",
  "Con el nombre de la clienta o de la profesional acierta más. Si hay dos Martas, te pregunta cuál.",
  "Puedes decir el día como quieras: hoy, mañana, el sábado, el 3, el 3 de octubre, esta semana, el mes pasado.",
  "La cifra sale primero y, cuando se puede, un botón para ir directo: abrir la ficha, ver el calendario, la hoja de mañana…",
  "Si no te entiende, te propone tres preguntas parecidas. Pulsa la que buscabas.",
];

export const LO_QUE_NO_HACE = [
  "No se inventa nada: si un dato no está en siShow, te lo dice y te explica dónde apuntarlo.",
  "No es una inteligencia artificial ni sale de siShow: responde con los datos de tu salón.",
  "No cambia tu agenda ni manda mensajes por su cuenta: te informa y te lleva al sitio con un botón.",
  "No guarda ni responde datos de salud de tus clientas (alergias, embarazo, medicación).",
  "El dinero de una clienta es orientativo, según tus precios; lo cobrado es lo que marcas como cobrado.",
];

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function GuiaAsistente({ onPreguntar }: { onPreguntar?: (texto: string) => void }) {
  const [busca, setBusca] = useState("");
  const [abierta, setAbierta] = useState<CategoriaAsistente | null>("hoy");
  const filtradas = useMemo(() => {
    const q = sinTildes(busca.trim());
    if (!q) return FAMILIAS;
    return FAMILIAS.filter((f) => sinTildes(`${f.responde} ${f.ejemplos.join(" ")}`).includes(q));
  }, [busca]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-extrabold">Cómo preguntarle</h3>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-cafe-medio">
          {CONSEJOS.map((c) => (
            <li key={c} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hoja" aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-[15px] font-extrabold">Todo lo que te puede responder · {FAMILIAS.length} tipos de pregunta</h3>
        <label className="flex h-10 items-center gap-2 rounded-full border border-input bg-blanco px-3.5 text-muted-foreground">
          <Search className="size-4 shrink-0" strokeWidth={1.6} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca: señal, huecos, color, cobrado…" aria-label="Buscar en las preguntas" className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none" />
        </label>
        <div className="divide-y divide-lino overflow-hidden rounded-2xl border border-lino bg-card">
          {CATEGORIAS.map((cat) => {
            const fams = filtradas.filter((f) => f.categoria === cat.id);
            if (!fams.length) return null;
            const ver = busca.trim() ? true : abierta === cat.id;
            return (
              <section key={cat.id}>
                <h4>
                  <button type="button" aria-expanded={ver} onClick={() => setAbierta(ver && !busca ? null : cat.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-beige/50">
                    <span className="flex-1 text-[14.5px] font-extrabold">{cat.titulo}</span>
                    <span className="rounded-full bg-salvia-clara px-2 text-[12px] font-bold text-hoja-tinta tabular-nums">{fams.length}</span>
                    <ChevronDown className={cn("size-4 text-cafe-medio transition-transform", ver && "rotate-180")} strokeWidth={1.6} aria-hidden="true" />
                  </button>
                </h4>
                {ver && (
                  <ul className="space-y-3 px-4 pb-4">
                    {fams.map((f) => (
                      <li key={f.id}>
                        <p className="text-[13.5px] font-bold text-cafe first-letter:uppercase">{f.responde}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {f.ejemplos.slice(0, 3).map((ej) =>
                            onPreguntar ? (
                              <button key={ej} type="button" onClick={() => onPreguntar(ej)} className="rounded-full border border-lino bg-superficie px-2.5 py-1 text-[12.5px] text-cafe-medio hover:border-salvia hover:bg-salvia-suave">
                                «{ej}»
                              </button>
                            ) : (
                              <span key={ej} className="rounded-full border border-lino bg-superficie px-2.5 py-1 text-[12.5px] text-cafe-medio">
                                «{ej}»
                              </span>
                            ),
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {filtradas.length === 0 && <p className="px-4 py-3 text-[13px] text-muted-foreground">Nada con «{busca}». Prueba con otra palabra.</p>}
        </div>
      </div>

      <div>
        <h3 className="text-[15px] font-extrabold">Lo que no hace</h3>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-cafe-medio">
          {LO_QUE_NO_HACE.map((c) => (
            <li key={c} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-moca" aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
