/**
 * Panel del asistente (lote 10). Entrada libre con el historial de la
 * sesión, chips de sugerencias por tema y respuestas estructuradas del motor
 * de BACKEND (`lib/asistente/responder.ts`): la cifra en negrita con su botón
 * de acción, desambiguación con opciones pulsables, «no lo sé seguro, pero…»
 * con tres chips y el escalado (pasos, guía y, al final, el contacto).
 *
 * El motor recibe las fuentes de esta rama (`crearFuentesPanel`) y lee la
 * store en cada pregunta. Nada sale de siShow ni hay IA: todo se calcula con
 * los datos del salón en este navegador. Las acciones son semánticas; aquí
 * se traducen a rutas del panel.
 */
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { useTienePlan } from "@/lib/accesos-panel";
import { planDe } from "@/lib/plan";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUp, BookOpen, Copy, Mail, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { guiaAsistente } from "@/lib/asistente/guia";
import { crearAsistente, type RespuestaAsistente } from "@/lib/asistente/responder";
import type { Accion } from "@/lib/asistente/resolutores/tipos";
import { crearFuentesPanel } from "@/lib/asistente/fuentes-panel";
import { whatsappUrl } from "@/lib/campanas";
import { usePanelPublicLink } from "@/lib/panel-public-link";
import { filtrarCitas, useMiEmployeeId, usePermisos } from "@/lib/accesos-panel";
import { alcance, puede, type Permisos } from "@/lib/permisos";
import { POR_ID } from "@/lib/asistente/intenciones";
import { useAccesosDemo } from "@/lib/accesos-maqueta";
import { ClientHistorySheet } from "@/components/ClientHistorySheet";
import { cn } from "@/lib/utils";

type Mensaje = { id: number; de: "yo"; texto: string } | { id: number; de: "asistente"; r: RespuestaAsistente };

// «-2»: la forma del motor real (cifras[] y acciones[]); el historial de la maqueta no se lee.
const CLAVE_HISTORIAL = "sishow-asistente-historial-2";

function leerHistorial(): Mensaje[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(CLAVE_HISTORIAL) ?? "[]") as Mensaje[];
  } catch {
    return [];
  }
}

/** Pantalla del panel por el nombre que le da la guía de uso («Ajustes › Señal» → Ajustes). */
const RUTA_DE_SECCION: Array<[RegExp, string]> = [
  [/^hoy|^caja/i, "/app"],
  [/^calendario/i, "/app/calendar"],
  [/^citas/i, "/app/appointments"],
  [/^lista de espera/i, "/app/waitlist"],
  [/^clientas/i, "/app/clients"],
  [/^equipo/i, "/app/employees"],
  [/^servicios/i, "/app/services"],
  [/^anal[ií]tica/i, "/app/insights"],
  [/^marketing/i, "/app/marketing"],
  [/^mi p[aá]gina/i, "/app/web"],
  [/^ajustes/i, "/app/settings"],
];

const hoyISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Lote 13: sin el plan del asistente, la tarjeta «llega con el plan…» en su lugar. */
export function AssistantPanel({ className }: { className?: string }) {
  const incluido = useTienePlan("asistente");
  if (!incluido) {
    return (
      <div className={cn("overflow-y-auto p-4", className)}>
        <LlegaConPlan funcion="asistente" compacta />
      </div>
    );
  }
  return <PanelDelAsistente className={className} />;
}

function PanelDelAsistente({ className }: { className?: string }) {
  const equipo = useEquipo();
  const navigate = useNavigate();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const permisosTemas = usePermisos();
  const temas = useMemo(() => {
    const veDinero = puede(permisosTemas, "dinero.ver-global") || alcance(permisosTemas, "dinero.ver-propio") === "propio";
    return guiaAsistente(4).filter((t) => (t.id !== "marketing" || puede(permisosTemas, "marketing.usar")) && (t.id !== "dinero" || veDinero) && (t.id !== "configuracion" || puede(permisosTemas, "salon.editar")));
  }, [permisosTemas]);
  const [tema, setTema] = useState(temas[0]?.id ?? "hoy");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const clienta = useSalonStore((s) => s.clients.find((c) => c.id === fichaId) ?? null);
  const final = useRef<HTMLDivElement>(null);

  // El equipo cambia poco; la store se lee en cada pregunta y así ve la cita creada hace un segundo.
  const equipoRef = useRef(equipo);
  equipoRef.current = equipo;
  // Lote 11: el asistente responde con lo que ve quien pregunta (la estilista, lo suyo).
  const permisos = usePermisos();
  const mio = useMiEmployeeId();
  const accesoRef = useRef({ permisos, mio });
  accesoRef.current = { permisos, mio };
  const gerente = useAccesosDemo((s) => s.miembros?.find((m) => m.rol === "gerente" && m.estado === "activa")?.displayName ?? null);
  // El mismo enlace que «Ver tu web» del menú (en una demo lleva su ?d=).
  const enlace = usePanelPublicLink();
  const enlaceRef = useRef(enlace);
  enlaceRef.current = enlace;
  const asistente = useMemo(
    () =>
      crearAsistente(
        crearFuentesPanel(
          () => {
            const st = useSalonStore.getState();
            const { permisos: p, mio: m } = accesoRef.current;
            if (puede(p, "cita.ver-todas")) return st;
            const citas = filtrarCitas(st.appointments, p, m);
            const suyas = new Set(citas.map((c) => c.clientId));
            return { ...st, appointments: citas, clients: st.clients.filter((c) => suyas.has(c.id)) };
          },
          () => (puede(accesoRef.current.permisos, "cita.ver-todas") ? equipoRef.current : equipoRef.current.filter((e) => e.id === accesoRef.current.mio)),
          { plan: () => planDe(useSalonStore.getState().salonProfile, !useSalonStore.getState().realSalonSlug), enlace: () => (typeof window === "undefined" ? enlaceRef.current : new URL(enlaceRef.current, window.location.origin).href) },
        ),
      ),
    [],
  );

  // Índices y catálogo listos al abrir, para que la primera pregunta no espere.
  useEffect(() => asistente.precalentar(), [asistente]);

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
    const r = fueraDeSuRol(asistente.responder(limpia), permisos, gerente);
    const id = Date.now();
    setMensajes((m) => [...m, { id, de: "yo", texto: limpia }, { id: id + 1, de: "asistente", r }]);
    setTexto("");
  }

  function reiniciar() {
    asistente.reiniciar();
    setMensajes([]);
  }

  function copiar(t: string, que: string) {
    void navigator.clipboard.writeText(t).then(
      () => toast.success(`${que} copiado`),
      () => toast.error("No se pudo copiar"),
    );
  }

  function ejecutar(a: Accion) {
    const s = useSalonStore.getState();
    switch (a.tipo) {
      case "abrir-ficha":
        if (a.clientaId) setFichaId(a.clientaId);
        return;
      case "ver-hoja": {
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        if (!a.dia || a.dia === hoyISO()) return void navigate({ to: "/app/hoja", search: { dia: "hoy" } });
        if (a.dia === hoyISO(manana)) return void navigate({ to: "/app/hoja", search: { dia: "manana" } });
        // La hoja solo tiene hoy y mañana: otro día se ve en el calendario.
        return void navigate({ to: "/app/calendar", search: { dia: a.dia } });
      }
      case "ver-calendario":
        return void navigate({ to: "/app/calendar", search: { dia: a.dia } });
      case "abrir-cita":
        return void navigate({ to: "/app/calendar", search: { cita: a.citaId } });
      case "nueva-cita":
        return void navigate({ to: "/app/calendar", search: { dia: a.dia, nueva: true } });
      case "ver-seccion": {
        const ruta = RUTA_DE_SECCION.find(([re]) => re.test(a.destino ?? ""))?.[1] ?? "/app";
        return void navigate({ to: ruta });
      }
      case "copiar":
        return copiar(a.destino ?? "", a.etiqueta.toLowerCase().includes("enlace") ? "Enlace" : "Texto");
      case "whatsapp": {
        const c = s.clients.find((x) => x.id === a.clientaId);
        if (c?.phone) window.open(whatsappUrl(c.phone, ""), "_blank", "noopener");
        else toast.error("Esta clienta no tiene teléfono en su ficha");
        return;
      }
      case "descargar":
        return void navigate({ to: "/app/insights" });
      case "escribir-soporte":
        window.location.href = `mailto:${a.destino ?? ""}`;
        return;
    }
  }

  const ejemplosTema = temas.find((t) => t.id === tema)?.ejemplos ?? [];

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
        <div className="sin-scrollbar flex gap-1 overflow-x-auto" role="tablist" aria-label="Temas de preguntas">
          {temas.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={tema === c.id}
              onClick={() => setTema(c.id)}
              className={cn("h-7 shrink-0 rounded-full px-2.5 text-[12.5px] font-bold", tema === c.id ? "bg-card text-foreground shadow-[0_1px_2px_rgba(59,47,42,0.14)]" : "text-cafe-medio hover:text-foreground")}
            >
              {c.titulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ejemplosTema.map((ej) => (
            <button key={ej} type="button" onClick={() => preguntar(ej)} className="rounded-full border border-lino bg-card px-2.5 py-1 text-[12.5px] text-cafe-medio hover:border-salvia hover:bg-salvia-suave">
              {ej}
            </button>
          ))}
          {permisosTemas.paginas.has("ajustes") && (
            <Link to="/app/settings" className="self-center px-1 text-[12.5px] font-bold text-hoja-tinta hover:underline">
              Ver todas
            </Link>
          )}
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
          <button type="button" onClick={reiniciar} title="Empezar de nuevo" aria-label="Borrar la conversación" className="grid size-9 shrink-0 place-items-center rounded-xl text-cafe-medio hover:bg-beige">
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
        <p className="whitespace-pre-line">{conNegrita(r.texto)}</p>
        {r.acciones.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {r.acciones.map((a) => (
              <button key={`${a.tipo}-${a.etiqueta}`} type="button" onClick={() => onAccion(a)} className="rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-bold text-primary-foreground">
                {a.etiqueta}
              </button>
            ))}
          </div>
        )}
        {r.sugerencias.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.sugerencias.map((t) => (
              <button key={t} type="button" onClick={() => onPreguntar(t)} className="rounded-full border border-lino bg-superficie px-2.5 py-1 text-[12.5px] text-cafe-medio hover:border-salvia hover:bg-salvia-suave">
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (r.tipo === "elegir") {
    return (
      <div className={caja}>
        <p>{conNegrita(r.texto)}</p>
        {r.opciones.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.opciones.map((o) => (
              <button key={o.pregunta} type="button" onClick={() => onPreguntar(o.pregunta)} className={chip}>
                {o.etiqueta}
              </button>
            ))}
          </div>
        )}
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
      <p className="font-bold">{conNegrita(r.texto)}</p>
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

/** El motor marca la cifra con **negrita** de Markdown; aquí se pinta destacada. */
function conNegrita(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith("**") && trozo.endsWith("**") ? (
      <b key={i} className="font-extrabold text-foreground">
        {trozo.slice(2, -2)}
      </b>
    ) : (
      trozo
    ),
  );
}

/**
 * Lo que su rol no ve (lote 11): marketing sin `marketing.usar`, dinero sin
 * ningún permiso de dinero. En vez de la cifra, quién lo lleva y qué puede
 * preguntar ella.
 */
function fueraDeSuRol(r: RespuestaAsistente, p: Permisos, gerente: string | null): RespuestaAsistente {
  if (r.tipo !== "respuesta" && r.tipo !== "elegir") return r;
  const categoria = r.intencion ? POR_ID.get(r.intencion)?.categoria : undefined;
  const veDinero = puede(p, "dinero.ver-global") || alcance(p, "dinero.ver-propio") === "propio";
  const bloqueada = (categoria === "marketing" && !puede(p, "marketing.usar")) || (categoria === "dinero" && !veDinero);
  if (!bloqueada) return r;
  const quien = gerente ? `Eso lo ve ${gerente}` : "Eso lo ve la gerente del salón";
  return {
    tipo: "respuesta",
    intencion: r.intencion ?? "fuera-de-rol",
    texto: `${quien}. Tú puedes preguntarme por tu agenda y tus clientas.`,
    cifras: [],
    acciones: [],
    sugerencias: ["¿Cuántas citas tengo hoy?", "¿Qué huecos me quedan hoy?"],
  };
}
