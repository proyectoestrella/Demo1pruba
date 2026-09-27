import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * «Guía de uso de la app» (Ajustes): un tutorial visual que se lee en la
 * pantalla, con capturas reales del panel. Nada de PDF ni de descargas: solo
 * scroll, un índice arriba y las imágenes se amplían al tocarlas.
 *
 * Encargo de Tomás para la demo a PeluChic (28-sep-2026): «visual y
 * ultracomprensible, con muchísima imagen», frases cortas y lenguaje de
 * peluquera, no de informático.
 */
type Captura = { src: string; alt: string };

type Apartado = {
  id: string;
  titulo: string;
  texto: string[];
  capturas: Captura[];
};

const APARTADOS: Apartado[] = [
  {
    id: "hoy",
    titulo: "Tu día, de un vistazo",
    texto: [
      "Al entrar ves lo de hoy: cuántas citas tienes, qué huecos quedan y cuánto llevas cobrado.",
      "«Esto te espera» son las solicitudes nuevas por internet. Las confirmas con un toque y quedan en tu agenda.",
    ],
    capturas: [{ src: "/guia/hoy.webp", alt: "Pantalla Hoy con las citas del día, huecos libres, ingresos y las solicitudes por confirmar" }],
  },
  {
    id: "calendario",
    titulo: "El calendario",
    texto: [
      "Ves la semana, el día o el mes, y quién de tu equipo tiene qué hora.",
      "Toca una cita para abrirla: ahí cambias el día, la hora o la duración, y queda movida sola.",
      "Para cancelarla, bajas hasta «Cambiar estado» dentro de la misma ficha.",
    ],
    capturas: [
      { src: "/guia/calendario.webp", alt: "Vista semanal del calendario con las citas de cada profesional en columnas de colores" },
      { src: "/guia/cita-detalle.webp", alt: "Ficha de una cita abierta, con la fecha, la duración, la hora y la señal" },
    ],
  },
  {
    id: "reservas-web",
    titulo: "Reservas desde tu web",
    texto: [
      "Tus clientas reservan solas desde el enlace de tu web, sin llamarte.",
      "Eligen servicio, día y hora libre; la solicitud te llega a «Hoy» para que la confirmes.",
    ],
    capturas: [{ src: "/guia/web-reservas.webp", alt: "Página pública de reservas de PeluChic, con el botón Reservar cita y los datos del salón" }],
  },
  {
    id: "senal",
    titulo: "Señal (fianza)",
    texto: [
      "Es un adelanto por Bizum para que la clienta no se olvide de venir.",
      "Se activa en Ajustes: pones tu número de Bizum y cuánto pides, fijo o en porcentaje.",
      "siShow no cobra nada por ti: cuando te llega el Bizum, tú marcas la cita como «con señal recibida».",
    ],
    capturas: [{ src: "/guia/senal.webp", alt: "Ajuste de Señal con el número de Bizum y el importe, dentro de Plantones y señal" }],
  },
  {
    id: "cobrar-caja",
    titulo: "Cobrar y Caja del día",
    texto: [
      "Cuando termina el servicio, la cobras desde la propia cita o desde Caja del día.",
      "Caja del día suma lo cobrado en efectivo, tarjeta y Bizum, y te dice cuánto debería haber al cerrar.",
    ],
    capturas: [{ src: "/guia/caja.webp", alt: "Caja del día con el total cobrado, el desglose por forma de pago y el cierre de caja" }],
  },
  {
    id: "clientas",
    titulo: "Clientas y lista de espera",
    texto: [
      "Cada clienta tiene su ficha: cuándo vino, qué se hizo y cuánto suele gastar.",
      "La lista de espera guarda a quien no encontró hueco. Si alguien cancela, avisas por WhatsApp con un toque o la metes directamente en la cita libre.",
    ],
    capturas: [
      { src: "/guia/clientas.webp", alt: "Listado de clientas con su última visita, frecuencia y gasto orientativo" },
      { src: "/guia/lista-espera.webp", alt: "Lista de espera con los botones Avisar hueco y Convertir en cita" },
    ],
  },
  {
    id: "asistente",
    titulo: "El asistente",
    texto: [
      "Le preguntas como hablas: «¿cuántas citas tengo hoy?», «¿cuánto llevo cobrado?».",
      "Responde con tus datos reales, nunca se los inventa, y no cambia nada por su cuenta.",
    ],
    capturas: [{ src: "/guia/asistente.webp", alt: "Panel del asistente respondiendo con botones de ejemplo: Hoy, Agenda, Clientas, Equipo y Servicios" }],
  },
  {
    id: "mi-pagina",
    titulo: "Tu página y tus servicios",
    texto: [
      "En «Mi página de reservas» cambias el nombre, la foto, la presentación y el horario, viendo el resultado al lado.",
      "En «Servicios y precios» está tu carta completa: duración, precio y si se puede reservar por internet.",
    ],
    capturas: [
      { src: "/guia/mi-pagina.webp", alt: "Editor de Mi página de reservas con la vista previa de la web al lado" },
      { src: "/guia/servicios.webp", alt: "Listado de Servicios y precios agrupado por familias, con duración y precio de cada uno" },
    ],
  },
  {
    id: "equipo",
    titulo: "Tu equipo y permisos",
    texto: [
      "Cada profesional tiene su horario y lo que más hace. Los cambios se guardan solos.",
      "En Ajustes → Accesos decides quién entra al panel y con qué rol: gerente, subencargada o estilista.",
    ],
    capturas: [{ src: "/guia/equipo.webp", alt: "Pantalla Equipo con las tarjetas de María, Sara y Noelia y su horario" }],
  },
  {
    id: "historial",
    titulo: "Deshacer e historial",
    texto: [
      "Todo cambio queda anotado en Ajustes → Historial de cambios: quién, qué y cuándo.",
      "Deshacer no borra nada: añade una fila nueva que vuelve atrás, así siempre puedes ver qué pasó.",
    ],
    capturas: [{ src: "/guia/historial.webp", alt: "Historial de cambios dentro de Ajustes, con el buscador por clienta o servicio" }],
  },
];

export function GuiaUso() {
  const [ampliada, setAmpliada] = useState<Captura | null>(null);
  return (
    <div className="space-y-6">
      <p className="text-[14px] text-cafe-medio">
        Cómo se usa siShow, paso a paso y con capturas de tu propio panel. Toca un apartado del índice para ir directa, o baja con el dedo.
      </p>

      <nav aria-label="Índice de la guía" className="rounded-2xl border border-lino bg-nata p-3.5">
        <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {APARTADOS.map((a, i) => (
            <li key={a.id}>
              <a
                href={`#guia-${a.id}`}
                className="block truncate rounded-lg px-2 py-1.5 text-[13px] font-bold text-cafe-medio hover:bg-beige hover:text-foreground"
              >
                {i + 1}. {a.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-8">
        {APARTADOS.map((a, i) => (
          <section key={a.id} id={`guia-${a.id}`} className="scroll-mt-24 space-y-3">
            <h3 className="text-[16px] font-extrabold tracking-[-0.01em]">
              {i + 1}. {a.titulo}
            </h3>
            <ul className="space-y-1.5 text-[14px] text-cafe-medio">
              {a.texto.map((linea) => (
                <li key={linea} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hoja" aria-hidden="true" />
                  {linea}
                </li>
              ))}
            </ul>
            <div className={cn("grid gap-3", a.capturas.length > 1 ? "sm:grid-cols-2" : "grid-cols-1")}>
              {a.capturas.map((c) => (
                <button
                  key={c.src}
                  type="button"
                  onClick={() => setAmpliada(c)}
                  className="group overflow-hidden rounded-2xl border border-lino bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-moca"
                  aria-label={`Ampliar captura: ${c.alt}`}
                >
                  <img
                    src={c.src}
                    alt={c.alt}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {ampliada &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={ampliada.alt}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setAmpliada(null)}
          >
            <button
              type="button"
              onClick={() => setAmpliada(null)}
              aria-label="Cerrar imagen ampliada"
              className="absolute top-4 right-4 rounded-full bg-white/90 p-2 text-cafe hover:bg-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <img
              src={ampliada.src}
              alt={ampliada.alt}
              className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
