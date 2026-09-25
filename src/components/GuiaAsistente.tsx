import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { CONSEJOS_GUIA, guiaAsistente } from "@/lib/asistente/guia";
import { cn } from "@/lib/utils";

/**
 * «Cómo usar el asistente» (lote 10): consejos, todas las preguntas que
 * entiende por tema, un buscador y lo que no hace. Sale de `guia.ts` del
 * motor de BACKEND (una pregunta por familia), así que enseña exactamente lo
 * que el asistente responde. Nunca enseña las preguntas de plan no incluido
 * ni las dudas técnicas.
 */
export const LO_QUE_NO_HACE = [
  "No se inventa nada: si un dato no está en siShow, te lo dice.",
  "No es una inteligencia artificial ni sale de siShow: responde con los datos de tu salón.",
  "No cambia tu agenda ni manda mensajes por su cuenta: te informa y te lleva al sitio con un botón.",
  "No guarda ni responde datos de salud de tus clientas (alergias, embarazo, medicación).",
  "El dinero de una clienta es orientativo, según tus precios; lo cobrado es lo que marcas como cobrado.",
];

const TEMAS = guiaAsistente(999);
const TOTAL = TEMAS.reduce((n, t) => n + t.ejemplos.length, 0);
const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function GuiaAsistente({ onPreguntar }: { onPreguntar?: (texto: string) => void }) {
  const [busca, setBusca] = useState("");
  const [abierta, setAbierta] = useState<string | null>(TEMAS[0]?.id ?? null);
  const filtrados = useMemo(() => {
    const q = sinTildes(busca.trim());
    return TEMAS.map((t) => ({ ...t, ejemplos: q ? t.ejemplos.filter((e) => sinTildes(`${t.titulo} ${e}`).includes(q)) : t.ejemplos }));
  }, [busca]);
  const hayAlgo = filtrados.some((t) => t.ejemplos.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-extrabold">Cómo preguntarle</h3>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-cafe-medio">
          {CONSEJOS_GUIA.map((c) => (
            <li key={c} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hoja" aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-[15px] font-extrabold">Todo lo que te puede responder · {TOTAL} preguntas</h3>
        <label className="flex h-10 items-center gap-2 rounded-full border border-input bg-blanco px-3.5 text-muted-foreground">
          <Search className="size-4 shrink-0" strokeWidth={1.6} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca: señal, huecos, color, cobrado…" aria-label="Buscar en las preguntas" className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none" />
        </label>
        <div className="divide-y divide-lino overflow-hidden rounded-2xl border border-lino bg-card">
          {filtrados.map((t) => {
            if (!t.ejemplos.length) return null;
            const ver = busca.trim() ? true : abierta === t.id;
            return (
              <section key={t.id}>
                <h4>
                  <button type="button" aria-expanded={ver} onClick={() => setAbierta(ver && !busca ? null : t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-beige/50">
                    <span className="flex-1 text-[14.5px] font-extrabold">{t.titulo}</span>
                    <span className="rounded-full bg-salvia-clara px-2 text-[12px] font-bold text-hoja-tinta tabular-nums">{t.ejemplos.length}</span>
                    <ChevronDown className={cn("size-4 text-cafe-medio transition-transform", ver && "rotate-180")} strokeWidth={1.6} aria-hidden="true" />
                  </button>
                </h4>
                {ver && (
                  <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                    {t.ejemplos.map((ej) =>
                      onPreguntar ? (
                        <button key={ej} type="button" onClick={() => onPreguntar(ej)} className="rounded-full border border-lino bg-superficie px-2.5 py-1 text-[13px] text-cafe hover:border-salvia hover:bg-salvia-suave">
                          {ej}
                        </button>
                      ) : (
                        <span key={ej} className="rounded-full border border-lino bg-superficie px-2.5 py-1 text-[13px] text-cafe">
                          {ej}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </section>
            );
          })}
          {!hayAlgo && <p className="px-4 py-3 text-[13px] text-muted-foreground">Nada con «{busca}». Prueba con otra palabra.</p>}
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
