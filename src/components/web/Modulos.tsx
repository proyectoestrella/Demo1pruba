import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImagenCaptura, Movil, Portatil, Ventana } from "./Dispositivos";

/* -------------------------------------------------------------------------
 * Bloque de un módulo: texto a un lado y la pantalla real al otro.
 * ---------------------------------------------------------------------- */

export interface Modulo {
  id: string;
  titulo: string;
  texto: ReactNode;
  puntos: string[];
  nota?: ReactNode;
}

export function BloqueModulo({
  modulo,
  visual,
  invertido,
  nivel = 3,
}: {
  modulo: Modulo;
  visual: ReactNode;
  invertido?: boolean;
  nivel?: 2 | 3;
}) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <article
      id={modulo.id}
      className={cn(
        "grid scroll-mt-24 items-center gap-10 lg:gap-16",
        invertido ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" : "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]",
      )}
    >
      <div className={cn("max-w-xl", invertido && "lg:order-2")}>
        <Titulo className="ws-display ws-h3">{modulo.titulo}</Titulo>
        <div className="ws-texto mt-4 text-[1.06rem] leading-relaxed">{modulo.texto}</div>
        <ul className="mt-6 space-y-3">
          {modulo.puntos.map((p) => (
            <li key={p} className="flex gap-3 text-[1rem]">
              <Check className="mt-1 h-4 w-4 shrink-0 text-[color:var(--ws-hoja)]" strokeWidth={2.6} aria-hidden="true" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {modulo.nota && <div className="mt-6 text-[0.95rem] text-[color:var(--ws-cafe-m)]">{modulo.nota}</div>}
      </div>
      <div className={cn(invertido && "lg:order-1")}>{visual}</div>
    </article>
  );
}

/** Escenario donde se apoyan las pantallas: un panel arena, sin sombra ni degradado. */
export function Escenario({ children, className, tono = "arena" }: { children: ReactNode; className?: string; tono?: "arena" | "salvia" | "beige" }) {
  const fondo = tono === "salvia" ? "var(--ws-salvia)" : tono === "beige" ? "var(--ws-beige)" : "var(--ws-arena)";
  return (
    <div className={cn("relative rounded-[1.75rem] p-5 sm:p-8 lg:p-10", className)} style={{ background: fondo }}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Pantallas de cada módulo
 * ---------------------------------------------------------------------- */

export function VisualReservas() {
  return (
    <Escenario tono="salvia" className="flex items-end justify-center gap-4 pt-12 sm:gap-8 sm:pt-14">
      <Movil
        captura="movil-reserva-servicio"
        dominio="peluchic.sishow.es"
        sizes="(min-width: 1024px) 250px, 42vw"
        className="w-[46%] max-w-[17rem]"
      />
      <Movil
        captura="movil-reserva-estilista"
        sizes="(min-width: 1024px) 230px, 38vw"
        className="mb-[6%] w-[42%] max-w-[15.5rem]"
      />
    </Escenario>
  );
}

const VISTAS_AGENDA = [
  { captura: "calendario-dia" as const, texto: "Día" },
  { captura: "calendario-semana" as const, texto: "Semana" },
];

/** Calendario con un selector de vista: cambiar de Día a Semana cambia la pantalla. */
export function VisualAgenda() {
  const [vista, setVista] = useState<(typeof VISTAS_AGENDA)[number]["captura"]>("calendario-dia");
  return (
    <Escenario>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-[color:var(--ws-crema)] p-1" role="group" aria-label="Vista del calendario">
          {VISTAS_AGENDA.map((v) => (
            <button
              key={v.captura}
              type="button"
              aria-pressed={vista === v.captura}
              onClick={() => setVista(v.captura)}
              className={cn(
                "min-h-10 rounded-full px-5 text-[0.95rem] font-bold transition-colors",
                vista === v.captura ? "bg-[color:var(--ws-moca)] text-white" : "text-[color:var(--ws-cafe-m)] hover:text-[color:var(--ws-cafe)]",
              )}
            >
              {v.texto}
            </button>
          ))}
        </div>
        <p className="text-[0.9rem] text-[color:var(--ws-cafe-m)]">Y también 3 días, mes y cronograma.</p>
      </div>
      <div className="relative mt-6 pb-[8%] pr-[14%]">
        <Portatil
          key={vista}
          captura={vista}
          sizes="(min-width: 1680px) 700px, (min-width: 1024px) 46vw, 88vw"
          className="ws-fundido"
        />
        <Movil captura="movil-calendario" sizes="(min-width: 1024px) 160px, 24vw" className="absolute bottom-0 right-0 w-[23%]" />
      </div>
    </Escenario>
  );
}

/** Tonos de una carta de colores de peluquería (nivel.reflejo). Muestra, no una captura. */
const TONOS = [
  { n: "4.0", nombre: "castaño medio", c: "#4a3226" },
  { n: "5.3", nombre: "castaño claro dorado", c: "#6b4a2e" },
  { n: "6.1", nombre: "rubio oscuro ceniza", c: "#6f6158" },
  { n: "7.1", nombre: "rubio medio ceniza", c: "#8f7d6a" },
  { n: "8.3", nombre: "rubio claro dorado", c: "#b8925f" },
  { n: "9.1", nombre: "rubio muy claro ceniza", c: "#cbbba5" },
  { n: "10.1", nombre: "rubio clarísimo ceniza", c: "#e2d6c3" },
];

/** Carta de colores con mechones: el 9.1 es el matiz que lleva Elena en su ficha. */
export function CartaColores({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-[color:var(--ws-lino)] bg-[color:var(--ws-crema)] p-4 sm:p-5", className)}>
      <p className="text-[0.85rem] font-bold">Carta de colores</p>
      <ul className="mt-3 flex items-start justify-between gap-1.5" aria-label="Tonos de muestra del 4.0 al 10.1">
        {TONOS.map((t) => {
          const suyo = t.n === "9.1";
          return (
            <li key={t.n} className="group flex min-w-0 flex-1 flex-col items-center" title={`${t.n}, ${t.nombre}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ws-lino-f)]" aria-hidden="true" />
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 block h-20 w-full max-w-9 rounded-b-[45%] rounded-t-md transition-transform duration-200 group-hover:translate-y-1 sm:h-24",
                  suyo && "ring-2 ring-[color:var(--ws-moca)] ring-offset-2 ring-offset-[color:var(--ws-crema)]",
                )}
                style={{ background: t.c }}
              />
              <span className={cn("ws-cifra mt-2 text-[0.8rem] font-bold", !suyo && "text-[color:var(--ws-cafe-m)]")}>{t.n}</span>
              <span className="sr-only">{t.nombre}{suyo ? ", el de Elena" : ""}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[0.85rem] text-[color:var(--ws-cafe-m)]">
        Elena: decoloración con 20 vol, 35 min; matiz <b className="ws-cifra text-[color:var(--ws-cafe)]">9.1</b>, 10 vol, 10 min.
      </p>
    </div>
  );
}

/**
 * La ficha real y la carta de colores. Entre 1024 y 1279 px la columna no da
 * para las dos: queda la ficha, que ya enseña el color de la clienta.
 */
export function VisualFichas() {
  return (
    <Escenario className="grid items-end gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] sm:gap-6 lg:grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <div className="max-h-[34rem] overflow-hidden rounded-[1.25rem] sm:max-h-[36rem] lg:mx-auto lg:max-h-[34rem] lg:max-w-[22rem] xl:max-h-[36rem] xl:max-w-none">
        <Ventana captura="ficha" sizes="(min-width: 1024px) 352px, (min-width: 640px) 45vw, 88vw" className="rounded-[1.25rem]" />
      </div>
      <CartaColores className="sm:mb-8 lg:hidden xl:mb-8 xl:block" />
    </Escenario>
  );
}

export function VisualCaja() {
  return (
    <Escenario tono="beige" className="sm:pb-24">
      <Portatil captura="caja" sizes="(min-width: 1680px) 700px, (min-width: 1024px) 46vw, 88vw" />
      <div className="relative -mt-6 rounded-2xl sm:absolute sm:bottom-5 sm:right-8 sm:mt-0 border border-[color:var(--ws-lino)] bg-white p-4 shadow-[0_12px_32px_rgba(59,47,42,0.12)] sm:w-[19rem]">
        <p className="font-bold">siShow no cobra a tus clientas.</p>
        <p className="mt-1 text-[0.92rem] text-[color:var(--ws-cafe-m)]">
          Te pagan a ti, como siempre: efectivo, tarjeta o Bizum. siShow lo apunta para que la caja cuadre.
        </p>
      </div>
    </Escenario>
  );
}

const PREGUNTAS_ASISTENTE = ["¿Qué huecos hay el sábado?", "¿Cuántas citas tengo mañana?", "kien viene mñn", "¿Qué color lleva Elena?"];

export function VisualAsistente() {
  return (
    <Escenario tono="salvia" className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="overflow-hidden rounded-[1.25rem]">
        <Ventana captura="asistente" sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 88vw" className="rounded-[1.25rem]" />
      </div>
      <div>
        <p className="text-[0.95rem] font-bold">Se le pregunta como se habla:</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PREGUNTAS_ASISTENTE.map((p) => (
            <li key={p} className="rounded-full border border-[color:var(--ws-lino-f)] bg-[color:var(--ws-crema)] px-3.5 py-1.5 text-[0.9rem] font-semibold">
              {p}
            </li>
          ))}
        </ul>
      </div>
    </Escenario>
  );
}

/* -------------------------------------------------------------------------
 * Los módulos del inicio
 * ---------------------------------------------------------------------- */

export const MODULOS_INICIO: { modulo: Modulo; visual: ReactNode }[] = [
  {
    modulo: {
      id: "reservas",
      titulo: "Tu web de reservas, con tu nombre",
      texto: (
        <p>
          Tu salón tiene su página en <b className="text-[color:var(--ws-cafe)]">tusalon.sishow.es</b>, con tus servicios,
          precios, equipo, horario y fotos. Tus clientas reservan a cualquier hora, sin llamarte y sin instalar nada.
        </p>
      ),
      puntos: [
        "Eligen uno o varios servicios, profesional y hora",
        "Solo ven los huecos libres de verdad, con la duración que fijas tú",
        "Les preguntas lo que necesites al reservar, como alergias o si es su primera vez",
        "Te llega la solicitud y la confirmas con un toque",
      ],
    },
    visual: <VisualReservas />,
  },
  {
    modulo: {
      id: "agenda",
      titulo: "La agenda de todo el equipo, de un vistazo",
      texto: (
        <p>
          Una columna por profesional y un color por servicio, para leer la jornada sin pararte. En el móvil, el iPad y el
          ordenador, siempre al día.
        </p>
      ),
      puntos: [
        "Nueva cita en tres pasos: clienta, servicio y hora",
        "Lista de espera para avisar cuando se libera un hueco",
        "La hoja del día de cada profesional, lista para imprimir",
      ],
    },
    visual: <VisualAgenda />,
  },
  {
    modulo: {
      id: "fichas",
      titulo: "Cada clienta, con su color",
      texto: (
        <p>
          La ficha guarda la fórmula de cada visita, el oxidante y el tiempo, con quién vino, lo que gastó y cada cuánto
          vuelve. Lo que antes estaba en la cabeza de quien la atendió, ahora está en el salón.
        </p>
      ),
      puntos: [
        "Historial de visitas y de color, visita a visita",
        "Observaciones y avisos que no se olvidan",
        "Quién lleva semanas sin venir, para llamarla a tiempo",
        "WhatsApp, llamada o nueva cita desde la misma ficha",
      ],
    },
    visual: <VisualFichas />,
  },
  {
    modulo: {
      id: "caja",
      titulo: "La caja del día y la señal, sin líos",
      texto: (
        <p>
          Apunta cada cobro en un toque, con la forma de pago, la propina y quién cobró, y mira al momento cuánto llevas en
          efectivo, tarjeta y Bizum.
        </p>
      ),
      puntos: [
        "Señal por Bizum para las citas largas, con plazo, que se descuenta al cobrar",
        "Lo cobrado por hora y por profesional, y el resumen del día para copiar",
        "Con Todo incluido, el cierre de caja guardado y un fichero para tu gestoría",
      ],
      nota: "siShow no emite tickets ni facturas: eso lo sigue haciendo tu TPV.",
    },
    visual: <VisualCaja />,
  },
  {
    modulo: {
      id: "asistente",
      titulo: "Pregunta como hablas. Responde con tus datos.",
      texto: (
        <p>
          El asistente busca en tu agenda, tus fichas y tu caja y te contesta al momento. No es inteligencia artificial: no
          se inventa nada y, si algo no lo sabe, te lo dice.
        </p>
      ),
      puntos: [
        "Entiende cómo escribes, con prisas y faltas incluidas",
        "Te lleva a la ficha o a la hoja del día con un toque",
        "Incluido desde el plan Reservas + Asistente",
      ],
    },
    visual: <VisualAsistente />,
  },
];

/** Accesos, deshacer y Google Calendar: tres tarjetas con su recorte real. */
export function Tranquilidad({ nivelTitulo = 3 }: { nivelTitulo?: 2 | 3 }) {
  const T = nivelTitulo === 2 ? "h2" : "h3";
  const tarjetas: { titulo: string; texto: string; captura: "accesos" | "historial" | "google-calendar"; etiqueta?: string }[] = [
    {
      titulo: "Cada una ve lo suyo",
      texto:
        "La gerente lo ve todo; cada estilista, su agenda y lo suyo del día. La caja y los números, solo para quien tú digas. Entran con un enlace a su correo, sin contraseña.",
      captura: "accesos",
    },
    {
      titulo: "Deshacer, siempre",
      texto:
        "¿Cancelaste la cita equivocada? Lo deshaces desde el aviso o con Ctrl+Z. Y queda apuntado quién cambió qué, y cuándo.",
      captura: "historial",
    },
    {
      titulo: "Tu Google Calendar",
      etiqueta: "En pruebas",
      texto:
        "Cada profesional puede conectar su Google Calendar: sus citas aparecen allí y lo que tiene apuntado fuera no se ofrece como hueco. Está en pruebas: si quieres probarlo, te lo activamos.",
      captura: "google-calendar",
    },
  ];
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {tarjetas.map((t) => (
        <article key={t.titulo} className="ws-tarjeta-arena flex flex-col overflow-hidden">
          <div className="flex aspect-[16/10] items-center justify-center border-b border-[color:var(--ws-lino)] bg-[color:var(--ws-beige)] p-4">
            <ImagenCaptura
              captura={t.captura}
              sizes="(min-width: 768px) 30vw, 88vw"
              className="h-auto max-h-full w-full rounded-xl border border-[color:var(--ws-lino)] object-contain"
            />
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <T className="text-[1.2rem] font-extrabold">{t.titulo}</T>
              {t.etiqueta && <span className="ws-pildora ws-pildora-borde text-[0.78rem]">{t.etiqueta}</span>}
            </div>
            <p className="ws-texto mt-2 text-[0.98rem]">{t.texto}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
