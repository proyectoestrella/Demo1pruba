/**
 * Panel del asistente (lote 10). Entrada libre con el historial de la
 * sesión, chips de sugerencias por categoría y respuestas estructuradas:
 * cifra destacada con su botón de acción, desambiguación con opciones
 * pulsables, «no lo tengo claro, pero…» con tres chips y el escalado al
 * equipo de siShow con el correo y el mensaje copiables.
 *
 * Las respuestas salen de `responder()` de `lib/asistente/motor-maqueta.ts`
 * (CONECTAR: el motor de BACKEND). Nada sale de siShow ni hay IA: todo se
 * calcula con los datos del salón en este navegador.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUp, BookOpen, Copy, Mail, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { CATEGORIAS, FAMILIAS, type CategoriaAsistente } from "@/lib/asistente/catalogo-arena";
import { responder, type Accion, type RespuestaAsistente } from "@/lib/asistente/motor-maqueta";
import { ClientHistorySheet } from "@/components/ClientHistorySheet";
import { cn } from "@/lib/utils";

type Mensaje = { id: number; de: "yo"; texto: string } | { id: number; de: "asistente"; r: RespuestaAsistente };

const CLAVE_HISTORIAL = "sishow-asistente-historial";

function leerHistorial(): Mensaje[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(CLAVE_HISTORIAL) ?? "[]") as Mensaje[];
  } catch {
    return [];
  }
}

export function AssistantPanel({ className }: { className?: string }) {
  const equipo = useEquipo();
  const navigate = useNavigate();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaAsistente>("hoy");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const clienta = useSalonStore((s) => s.clients.find((c) => c.id === fichaId) ?? null);
  const final = useRef<HTMLDivElement>(null);

  // El historial dura lo que la sesión del navegador: se recupera al volver a abrir el panel.
  useEffect(() => setMensajes(leerHistorial()), []);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(mensajes.slice(-40)));
    } catch {
      /* sin almacenamiento: solo mientras el panel esté abierto */
    }
    final.current?.scrollIntoView({ block: "end" });
  }, [mensajes]);

  function preguntar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia) return;
    // Lectura directa de la store: ve la cita creada hace un segundo.
    const s = useSalonStore.getState();
    const r = responder(limpia, {
      appointments: s.appointments,
      services: s.services,
      employees: equipo,
      waitlist: s.waitlist,
      clients: s.clients,
      salonName: s.salonProfile.name,
    });
    const id = Date.now();
    setMensajes((m) => [...m, { id, de: "yo", texto: limpia }, { id: id + 1, de: "asistente", r }]);
    setTexto("");
  }

  function ejecutar(a: Accion) {
    if (a.destino.tipo === "ficha") return setFichaId(a.destino.clientId);
    if (a.destino.tipo === "preguntar") return preguntar(a.destino.texto);
    void navigate({ to: a.destino.to, search: a.destino.search as never });
  }

  const ejemplosCategoria = FAMILIAS.filter((f) => f.categoria === categoria).slice(0, 4).map((f) => f.ejemplos[0]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {mensajes.length === 0 && (
          <div className="rounded-2xl border border-salvia bg-salvia-suave px-4 py-3 text-[13.5px] leading-snug text-cafe">
            <p className="flex items-center gap-1.5 font-bold text-hoja-tinta">
              <Sparkles className="size-4" strokeWidth={1.7} aria-hidden="true" /> Pregúntame por tu salón
            </p>
            <p className="mt-1">Escribe como hablas: «kien viene mñn», «huecos el sábado», «cuánto lleva Noelia este mes». Respondo con tus datos y nunca me invento nada.</p>
          </div>
        )}

        {mensajes.map((m) =>
          m.de === "yo" ? (
            <p key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[14px] text-primary-foreground">
              {m.texto}
            </p>
          ) : (
            <Respuesta key={m.id} r={m.r} onAccion={ejecutar} onPreguntar={preguntar} />
          ),
        )}
        <div ref={final} />
      </div>

      {/* Sugerencias por categoría, siempre a mano. */}
      <div className="space-y-2 border-t border-lino bg-beige/60 px-3 pt-2.5 pb-2">
        <div className="sin-scrollbar flex gap-1 overflow-x-auto" role="tablist" aria-label="Categorías de preguntas">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={categoria === c.id}
              onClick={() => setCategoria(c.id)}
              className={cn("h-7 shrink-0 rounded-full px-2.5 text-[12.5px] font-bold", categoria === c.id ? "bg-card text-foreground shadow-[0_1px_2px_rgba(59,47,42,0.14)]" : "text-cafe-medio hover:text-foreground")}
            >
              {c.titulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ejemplosCategoria.map((ej) => (
            <button key={ej} type="button" onClick={() => preguntar(ej)} className="rounded-full border border-lino bg-card px-2.5 py-1 text-[12.5px] text-cafe-medio hover:border-salvia hover:bg-salvia-suave">
              {ej}
            </button>
          ))}
          <Link to="/app/settings" className="self-center px-1 text-[12.5px] font-bold text-hoja-tinta hover:underline">
            Ver todas
          </Link>
        </div>
      </div>

      <form
        className="flex items-end gap-2 border-t border-lino bg-background p-3"
        onSubmit={(e) => {
          e.preventDefault();
          preguntar(texto);
        }}
      >
        {mensajes.length > 0 && (
          <button type="button" onClick={() => setMensajes([])} title="Empezar de nuevo" aria-label="Borrar la conversación" className="grid size-9 shrink-0 place-items-center rounded-xl text-cafe-medio hover:bg-beige">
            <RotateCcw className="size-4" strokeWidth={1.7} />
          </button>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              preguntar(texto);
            }
          }}
          rows={1}
          placeholder="¿Cuánto llevo cobrado hoy?"
          aria-label="Pregunta al asistente"
          className="max-h-32 min-h-9 flex-1 resize-none rounded-xl border border-input bg-blanco px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <button type="submit" aria-label="Enviar" disabled={!texto.trim()} className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
          <ArrowUp className="size-4" />
        </button>
      </form>

      <ClientHistorySheet client={clienta} open={!!clienta} onOpenChange={(open) => !open && setFichaId(null)} />
    </div>
  );
}

function Respuesta({ r, onAccion, onPreguntar }: { r: RespuestaAsistente; onAccion: (a: Accion) => void; onPreguntar: (t: string) => void }) {
  const caja = "max-w-[92%] rounded-2xl rounded-bl-md border border-lino bg-card px-3.5 py-3 text-[14px] leading-snug text-cafe";
  const chip = "rounded-full border border-salvia bg-salvia-suave px-3 py-1.5 text-[13px] font-bold text-hoja-tinta hover:bg-salvia-clara";
  if (r.tipo === "respuesta") {
    return (
      <div className={caja}>
        {r.cifra && <p className="text-[24px] leading-tight font-extrabold tracking-[-0.01em] tabular-nums">{r.cifra}</p>}
        <p className={cn("whitespace-pre-line", r.cifra && "mt-0.5")}>{r.texto}</p>
        {r.accion && (
          <button type="button" onClick={() => onAccion(r.accion!)} className="mt-2.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-bold text-primary-foreground">
            {r.accion.etiqueta}
          </button>
        )}
      </div>
    );
  }
  if (r.tipo === "elegir") {
    return (
      <div className={caja}>
        <p>{r.texto}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.opciones.map((o) => (
            <button key={o.pregunta} type="button" onClick={() => onPreguntar(o.pregunta)} className={chip}>
              {o.etiqueta}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (r.tipo === "no-se") {
    return (
      <div className={caja}>
        <p>{r.texto}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.sugerencias.map((s) => (
            <button key={s} type="button" onClick={() => onPreguntar(s)} className={chip}>
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const copiar = (t: string, que: string) =>
    void navigator.clipboard.writeText(t).then(
      () => toast.success(`${que} copiado`),
      () => toast.error("No se pudo copiar"),
    );
  // Escalado (dudas técnicas y fuera de plan): primero los pasos, luego la guía y,
  // solo al final, el contacto «si sigue igual».
  return (
    <div className={caja}>
      <p className="font-bold">{r.texto}</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px]">
        {r.pasos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      {r.guia && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-cafe-medio">
          <BookOpen className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          En la guía de uso: <b className="text-cafe">{r.guia}</b>
        </p>
      )}
      <div className="mt-3 border-t border-lino pt-2.5">
        <p className="text-[13px] text-cafe-medio">{r.contacto.cierre}</p>
        <p className="mt-1.5 flex items-center gap-2 rounded-xl bg-nata px-3 py-2 font-bold">
          <Mail className="size-4 shrink-0 text-cafe-medio" strokeWidth={1.7} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{r.contacto.correo}</span>
          <button type="button" onClick={() => copiar(r.contacto.correo, "Correo")} aria-label="Copiar el correo" className="grid size-7 place-items-center rounded-full hover:bg-card">
            <Copy className="size-3.5" strokeWidth={1.8} />
          </button>
        </p>
        <p className="mt-2 rounded-xl border border-lino bg-superficie px-3 py-2 text-[13px] text-cafe-medio">{r.contacto.mensaje}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => copiar(r.contacto.mensaje, "Mensaje")} className={chip}>
            Copiar mensaje
          </button>
          <a href={`mailto:${r.contacto.correo}?subject=${encodeURIComponent("Ayuda con siShow")}&body=${encodeURIComponent(r.contacto.mensaje)}`} className={chip}>
            Abrir el correo
          </a>
        </div>
      </div>
    </div>
  );
}
