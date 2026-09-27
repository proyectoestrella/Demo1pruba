import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BarChart3, CircleSlash, ClipboardList, Megaphone, MonitorSmartphone, PenLine, Send } from "lucide-react";
import { cabezaWeb } from "@/lib/sishow-web";
import { EsqueletoWeb } from "@/components/web/EsqueletoWeb";
import { ESTILOS_WEB } from "@/components/web/estilos";
import { IntroPagina } from "@/components/web/IntroPagina";
import {
  BloqueModulo,
  Escenario,
  VisualAgenda,
  VisualAsistente,
  VisualCaja,
  VisualFichas,
  VisualReservas,
  type Modulo,
} from "@/components/web/Modulos";
import { Ventana } from "@/components/web/Dispositivos";
import { CtaFinal, TituloSeccion } from "@/components/web/Secciones";

/**
 * Funcionalidades de siShow, módulo a módulo y con capturas reales de la
 * demo. Cada punto existe hoy en el producto (registro de versiones y hoja de
 * planes v2); lo que va solo en un plan lo dice, y lo que está en pruebas,
 * también. Al final, lo que siShow no hace.
 */
export const Route = createFileRoute("/funcionalidades")({
  head: () => ({ ...cabezaWeb("funcionalidades"), styles: [ESTILOS_WEB] }),
  component: Funcionalidades,
});

const MODULOS: { modulo: Modulo; visual: ReactNode }[] = [
  {
    modulo: {
      id: "reservas",
      titulo: "Reservas online con tu propia web",
      texto: (
        <p>
          Tu salón tiene su web en <b className="text-[color:var(--ws-cafe)]">tusalon.sishow.es</b>: portada con tus fotos,
          servicios con precio y duración, tu equipo, tu horario y cómo llegar. Desde ahí, tus clientas reservan en cuatro
          pasos, a cualquier hora y sin instalar nada.
        </p>
      ),
      puntos: [
        "Servicio, profesional, día y hora, y sus datos: nombre y teléfono",
        "Pueden juntar varios servicios en la misma cita",
        "«Cualquiera disponible» si les da igual la profesional",
        "Solo se ofrecen huecos libres de verdad, con la duración de cada servicio",
        "Preguntas propias al reservar: alergias, si es su primera vez o lo que necesites",
        "Señal por Bizum para los servicios que tú digas, con plazo para pagarla",
        "Recordatorio automático por correo la víspera, si dejó su correo",
        "Puedes bloquear la reserva por internet a una clienta concreta",
      ],
      nota: "Con Todo incluido, también en tu propio dominio (tusalon.es).",
    },
    visual: <VisualReservas />,
  },
  {
    modulo: {
      id: "agenda",
      titulo: "Agenda y calendario del equipo",
      texto: (
        <p>
          Día, tres días, semana, mes o cronograma, como en los calendarios que ya conoces. Una columna por profesional, un
          color por servicio y la línea de «ahora» para saber por dónde vas.
        </p>
      ),
      puntos: [
        "Hoy: citas, huecos libres, ingresos y lo que te espera, de un vistazo",
        "Nueva cita en tres pasos, con las clientas que vienen a menudo a mano",
        "Las solicitudes se confirman con un toque, y el aviso por WhatsApp sale preparado",
        "Horas visibles, primer día de la semana y vista preferida, a tu gusto",
        "Lista de espera con «Avisar hueco» cuando alguien cancela",
        "Hoja del día por profesional, lista para imprimir",
      ],
    },
    visual: <VisualAgenda />,
  },
  {
    modulo: {
      id: "fichas",
      titulo: "Fichas de clientas con su color",
      texto: (
        <p>
          Cada clienta con su ficha: la fórmula de cada visita, el oxidante y el tiempo, con quién vino, lo que gastó y cada
          cuánto vuelve. Y sus avisos, siempre a la vista.
        </p>
      ),
      puntos: [
        "Último color e historial de color, visita a visita",
        "Visitas, frecuencia, gasto orientativo y profesional habitual",
        "Observaciones y avisos, como alergias o plantones",
        "Filtros: vienen hoy, nuevas, habituales, inactivas y color pendiente",
        "Buscador por nombre, teléfono, notas o color",
        "Importación de tus clientas desde TPV 123",
      ],
    },
    visual: <VisualFichas />,
  },
  {
    modulo: {
      id: "caja",
      titulo: "Caja del día y señal",
      texto: (
        <p>
          siShow no cobra a tus clientas: te pagan a ti, como siempre. Lo que hace es apuntar cada cobro para que sepas en
          todo momento cuánto llevas y la caja cuadre.
        </p>
      ),
      puntos: [
        "Cobro en un toque: efectivo, tarjeta o Bizum, o una parte de cada",
        "Propina, nota y quién cobró",
        "Total del día, reparto por forma de pago y lo cobrado por hora",
        "Comparación con ayer y con hace siete días, y los días anteriores",
        "Señal por Bizum con plazo, que se descuenta al cobrar",
        "Con Todo incluido: el hueco se libera solo si la señal no llega, cierre de caja guardado y fichero para tu gestoría",
      ],
      nota: "siShow no emite tickets ni facturas (queda fuera de Verifactu): es un registro para cuadrar la caja. El ticket o la factura los sigue haciendo tu TPV.",
    },
    visual: <VisualCaja />,
  },
  {
    modulo: {
      id: "asistente",
      titulo: "Asistente sin inteligencia artificial",
      texto: (
        <p>
          Pregúntale por tu salón como hablas. Busca en tu agenda, tus fichas y tu caja y te responde con esos datos. No es
          un modelo de lenguaje: no inventa cifras y, si algo no lo sabe, te lo dice.
        </p>
      ),
      puntos: [
        "Citas, huecos, clientas, equipo, servicios y caja",
        "Entiende frases a medias y faltas de ortografía",
        "Te lleva a la ficha, a la hoja del día o al calendario con un toque",
        "En los planes Reservas + Asistente y Todo incluido",
      ],
    },
    visual: <VisualAsistente />,
  },
];

const EQUIPO: { id: string; titulo: string; etiqueta?: string; captura: "accesos" | "historial" | "google-calendar"; puntos: string[] }[] = [
  {
    id: "accesos",
    titulo: "Accesos por rol",
    captura: "accesos",
    puntos: [
      "Gerente: lo ve y lo gestiona todo",
      "Estilista: su agenda, sus clientas y lo suyo del día",
      "Con Todo incluido, también subencargada y recepción",
      "Se invita por correo y se entra con un enlace, sin contraseña",
      "Lo que alguien no puede hacer no le sale en gris: no le sale",
    ],
  },
  {
    id: "deshacer",
    titulo: "Deshacer e historial",
    captura: "historial",
    puntos: [
      "Aviso de 10 segundos con «Deshacer» tras cada cambio, y Ctrl+Z",
      "Historial: quién cambió qué, con el antes y el después",
      "Si la clienta ya estaba avisada, te prepara el WhatsApp de corrección",
      "Últimas 24 horas en todos los planes; 90 días y versiones de tu web con Todo incluido",
    ],
  },
  {
    id: "google-calendar",
    titulo: "Google Calendar",
    etiqueta: "En pruebas",
    captura: "google-calendar",
    puntos: [
      "Cada profesional conecta su cuenta de Google",
      "Sus citas de siShow aparecen en su calendario",
      "Lo que tiene apuntado fuera no se ofrece como hueco, sin enseñar el título",
      "También el calendario del iPhone, igualmente en pruebas",
      "Apagado de serie: lo activamos en tu salón si quieres probarlo",
    ],
  },
];

const ADEMAS: { Icono: typeof Send; titulo: string; texto: string }[] = [
  {
    Icono: Send,
    titulo: "Recordatorios con un toque",
    texto: "La víspera, siShow te prepara los recordatorios por WhatsApp y tú los envías con un toque desde tu número.",
  },
  {
    Icono: PenLine,
    titulo: "Mi página de reservas",
    texto: "Cambias tu web desde el panel: lo primero que se ve, horario, servicios, equipo, reseñas y preguntas frecuentes, con vista previa en móvil y ordenador.",
  },
  {
    Icono: BarChart3,
    titulo: "Analítica",
    texto: "Ocupación por profesional, servicios más pedidos y clientas nuevas y recurrentes. Con Todo incluido, cualquier periodo y Excel.",
  },
  {
    Icono: Megaphone,
    titulo: "Marketing",
    texto: "Enlace para pedir reseñas en Google en todos los planes. Con Todo incluido, campañas con la lista y el mensaje preparados.",
  },
  {
    Icono: ClipboardList,
    titulo: "Plantones y señal",
    texto: "Marcas quién no vino, lo ves en su ficha y decides a qué citas pedir señal.",
  },
  {
    Icono: MonitorSmartphone,
    titulo: "En cualquier pantalla",
    texto: "Móvil, iPad u ordenador, en el navegador. Y lo puedes añadir a la pantalla de inicio como una app.",
  },
];

const NO_HACE = [
  "No emite tickets ni facturas: eso lo sigue haciendo tu TPV.",
  "No cobra a tus clientas ni detecta el Bizum: la señal la marcas tú al recibirla.",
  "No envía WhatsApp solo desde tu número: te lo prepara y lo envías tú. El envío automático va a tu medida.",
  "No escribe en el calendario de tus clientas.",
  "No gestiona varias sedes en una misma cuenta.",
];

const INDICE = [
  ...MODULOS.map((m) => ({ id: m.modulo.id, texto: m.modulo.titulo })),
  ...EQUIPO.map((e) => ({ id: e.id, texto: e.titulo })),
  { id: "ademas", texto: "Y además" },
];

function Funcionalidades() {
  return (
    <EsqueletoWeb>
      <IntroPagina
        titulo="Todo lo que hace siShow por tu salón"
        entradilla="Reservas online, agenda del equipo, fichas con el color de cada clienta, caja y señal, y un asistente que responde con tus datos. Estas son pantallas reales, con un salón de ejemplo."
      >
        <nav aria-label="En esta página" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {INDICE.map((e) => (
              <li key={e.id}>
                <a
                  href={`#${e.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-[color:var(--ws-lino-f)] bg-[color:var(--ws-crema)] px-4 text-[0.95rem] font-semibold no-underline hover:border-[color:var(--ws-cafe)]"
                >
                  {e.texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </IntroPagina>

      <section className="ws-seccion" aria-label="Módulos">
        <div className="ws-contenedor space-y-24 lg:space-y-32">
          {MODULOS.map((m, i) => (
            <BloqueModulo key={m.modulo.id} modulo={m.modulo} visual={m.visual} invertido={i % 2 === 1} nivel={2} />
          ))}
        </div>
      </section>

      <section className="ws-banda-arena ws-seccion" aria-labelledby="ws-equipo">
        <div className="ws-contenedor">
          <TituloSeccion
            id="ws-equipo"
            titulo="Para trabajar en equipo sin miedo"
            entradilla="Cada una ve lo suyo, todo se puede deshacer y, si lo usáis, vuestro calendario de siempre se entera."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {EQUIPO.map((e) => (
              <article key={e.id} id={e.id} className="ws-tarjeta flex scroll-mt-24 flex-col overflow-hidden">
                <Escenario tono="beige" className="flex aspect-[16/10] items-center justify-center rounded-none p-4 sm:p-5">
                  <Ventana captura={e.captura} sizes="(min-width: 1024px) 30vw, 88vw" className="w-full shadow-none" />
                </Escenario>
                <div className="p-6 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[1.3rem] font-extrabold">{e.titulo}</h3>
                    {e.etiqueta && <span className="ws-pildora ws-pildora-borde text-[0.78rem]">{e.etiqueta}</span>}
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {e.puntos.map((p) => (
                      <li key={p} className="ws-texto flex gap-2.5 text-[0.98rem]">
                        <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ws-hoja)]" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ademas" className="ws-seccion scroll-mt-20" aria-labelledby="ws-ademas">
        <div className="ws-contenedor">
          <TituloSeccion id="ws-ademas" titulo="Y además" />
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {ADEMAS.map((a) => (
              <div key={a.titulo} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--ws-beige)] text-[color:var(--ws-moca)]">
                  <a.Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[1.15rem] font-extrabold">{a.titulo}</h3>
                  <p className="ws-texto mt-1.5">{a.texto}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 rounded-[1.25rem] border-[1.5px] border-dashed border-[color:var(--ws-lino-f)] p-7 sm:p-10">
            <div className="flex items-center gap-3">
              <CircleSlash className="h-6 w-6 text-[color:var(--ws-moca)]" aria-hidden="true" />
              <h2 className="ws-display ws-h3">Lo que siShow no hace</h2>
            </div>
            <p className="ws-texto mt-3 max-w-2xl">Para que no te lleves sorpresas:</p>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {NO_HACE.map((n) => (
                <li key={n} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ws-moca)]" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <CtaFinal />
    </EsqueletoWeb>
  );
}
