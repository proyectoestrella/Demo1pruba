import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * «Guía de uso de la app» (Ajustes): un tutorial visual que se lee en la
 * pantalla, con capturas reales del panel. Nada de PDF ni de descargas: solo
 * scroll, un índice arriba y las imágenes se amplían al tocarlas.
 *
 * Encargo de Tomás para la demo a PeluChic (28-sep-2026): «visual y
 * ultracomprensible, con muchísima imagen», pasos numerados con marcador
 * sobre la captura, empezando por lo que más se usa (crear cita, confirmar,
 * señal, cobrar, cerrar caja) y con capturas de móvil en esos flujos.
 *
 * Tercera vuelta (misma fecha): las capturas se veían estiradas a 1440 px
 * (se escalaban al ancho de la columna en vez de a su tamaño natural) y
 * algunos marcadores tapaban el texto que señalaban. Cada imagen lleva ahora
 * su `w`/`h` real (atributos `width`/`height` del `<img>`, sin distorsión) y
 * un tope de ancho — 560 px para capturas del panel, 320 px para las de
 * móvil — nunca por encima de su tamaño natural. En escritorio, texto e
 * imagen van en dos columnas. Los marcadores se colocan pegados al borde del
 * control que señalan, nunca centrados sobre su texto.
 */
type Marcador = { top: string; left: string };
type Paso = { texto: string; src: string; alt: string; w: number; h: number; marcador?: Marcador };
type Apartado = { id: string; titulo: string; intro?: string; pasos: Paso[] };

const APARTADOS: Apartado[] = [
  {
    id: "crear-cita",
    titulo: "Crear una cita",
    pasos: [
      { texto: "Arriba a la derecha, toca «Nueva cita».", src: "/guia/cita-1-boton.webp", alt: "Botón Nueva cita en la cabecera del panel", w: 157, h: 64 },
      { texto: "Busca a la clienta o dale de alta si es nueva.", src: "/guia/cita-2-clienta.webp", alt: "Columna Clienta con el buscador y las tres que vienen a menudo", w: 272, h: 282, marcador: { top: "19%", left: "91%" } },
      { texto: "Elige el servicio de tu carta.", src: "/guia/cita-2b-servicio.webp", alt: "Columna Servicio con el primer tratamiento ya elegido, en verde", w: 352, h: 282, marcador: { top: "20%", left: "68%" } },
      { texto: "Elige el día y la hora libre.", src: "/guia/cita-3-diahora.webp", alt: "Selector de día y hora, con las horas ocupadas tachadas y la elegida en marrón", w: 352, h: 432, marcador: { top: "88%", left: "22%" } },
      { texto: "Toca «Guardar cita» y queda en tu agenda.", src: "/guia/cita-4-guardar.webp", alt: "Botón Guardar cita", w: 234, h: 100 },
      { texto: "En el móvil es lo mismo, un paso debajo del otro.", src: "/guia/movil-1-nueva-cita.webp", alt: "Pantalla Nueva cita en el móvil, con el buscador y las clientas habituales", w: 390, h: 400 },
    ],
  },
  {
    id: "confirmar",
    titulo: "Confirmar una solicitud",
    intro: "Cuando una clienta reserva desde tu web, no entra sola en tu agenda: te espera a que la confirmes.",
    pasos: [
      { texto: "En «Hoy», la solicitud sale en «Esto te espera».", src: "/guia/confirmar-1-lista.webp", alt: "Bloque Esto te espera con tres solicitudes y su botón Confirmar", w: 968, h: 312, marcador: { top: "30%", left: "89%" } },
      { texto: "Se abre su ficha: revisa la duración y la señal, y confirma.", src: "/guia/confirmar-2-ventana.webp", alt: "Ventana para confirmar la cita de Nuria García Díaz, con el botón Confirmar cita", w: 892, h: 490, marcador: { top: "80%", left: "18%" } },
      { texto: "En el móvil se abre igual, a pantalla completa.", src: "/guia/movil-3-confirmar-ventana.webp", alt: "Ventana de confirmar cita en el móvil", w: 390, h: 844 },
    ],
  },
  {
    id: "senal",
    titulo: "Señal: pedirla y marcarla recibida",
    intro: "Un adelanto por Bizum para que la clienta no se olvide de venir. siShow nunca cobra ni comprueba el pago: lo marcas tú. El importe fijo que pongas en Ajustes es un tope, nunca un mínimo: la señal jamás supera el precio del servicio. Por eso en los pasos de abajo, con el mismo ajuste de 20 €, verás 20 €, 10 € o 9 € según lo barato que sea el servicio de cada ejemplo.",
    pasos: [
      { texto: "Actívala en Ajustes → Plantones y señal: importe y tu número de Bizum.", src: "/guia/senal-1-activar.webp", alt: "Ajuste de Señal activado, con el importe fijo y el número de Bizum", w: 692, h: 316, marcador: { top: "10%", left: "94%" } },
      { texto: "Tu web ya avisa a la clienta al reservar, antes de que confirmes.", src: "/guia/senal-2-web-cliente.webp", alt: "Aviso en la web pública: PeluChic pedirá por WhatsApp una señal de 10 € por Bizum", w: 614, h: 156 },
      { texto: "Al pedirla, se abre WhatsApp con el mensaje ya escrito.", src: "/guia/senal-2-whatsapp.webp", alt: "Mensaje de WhatsApp pidiendo la señal por Bizum, con el número y el plazo", w: 566, h: 118 },
      { texto: "La cita queda marcada como «Pedida» hasta que llegue el Bizum.", src: "/guia/senal-3-pedida.webp", alt: "Estado Señal: Pedida, con los botones Recibida, Dar más tiempo y Volver a pedir", w: 386, h: 158, marcador: { top: "92%", left: "24%" } },
      { texto: "En cuanto lo veas en tu banco, toca «Recibida».", src: "/guia/senal-4-recibida.webp", alt: "Estado Señal: Recibida, 9 € por Bizum que se descuentan solos al cobrar", w: 386, h: 122 },
      { texto: "En el móvil, el ajuste se abre igual de plegable.", src: "/guia/movil-6-senal.webp", alt: "Ajuste de Señal en el móvil, con el interruptor y el número de Bizum", w: 390, h: 500 },
    ],
  },
  {
    id: "cobrar",
    titulo: "Cobrar, con pago mixto y propina",
    pasos: [
      { texto: "Desde la cita, toca «Cobrar» con el precio ya puesto.", src: "/guia/cobrar-1-formulario.webp", alt: "Ventana Cobrar con el importe, y los botones Efectivo, Tarjeta y Bizum", w: 464, h: 316 },
      { texto: "«Paga una parte de otra forma» reparte el cobro; la propina va aparte.", src: "/guia/cobrar-2-mixto-propina.webp", alt: "Dos pagos repartidos (efectivo y tarjeta) más una propina de 5 €", w: 464, h: 436, marcador: { top: "50%", left: "91%" } },
      { texto: "Al cobrar, queda anotado con un «Deshacer» por si te equivocas.", src: "/guia/cobrar-3-hecho.webp", alt: "Aviso Cobrado a Mateo: 69 € (34 € efectivo + 30 € tarjeta), con botón Deshacer", w: 357, h: 70 },
      { texto: "Y el desglose queda en la ficha: quién cobró y de qué forma.", src: "/guia/cobrar-4-desglose.webp", alt: "Desglose del cobro: propina en efectivo, servicio en tarjeta y en efectivo", w: 386, h: 144 },
      { texto: "En el móvil es la misma ventana, a pantalla completa.", src: "/guia/movil-4-cobrar.webp", alt: "Ventana Cobrar en el móvil, con importe y formas de pago", w: 390, h: 610 },
    ],
  },
  {
    id: "caja",
    titulo: "Cerrar la caja del día",
    pasos: [
      { texto: "«Caja del día» suma lo cobrado por efectivo, tarjeta y Bizum.", src: "/guia/caja-1-resumen.webp", alt: "Total cobrado del día repartido en efectivo, tarjeta y Bizum, con sus porcentajes", w: 968, h: 157 },
      { texto: "Cuenta el cajón y escribe el efectivo contado.", src: "/guia/caja-2-cerrar.webp", alt: "Panel Cerrar el día con el campo Efectivo contado y el botón Cerrar el día", w: 300, h: 282, marcador: { top: "53%", left: "87%" } },
      { texto: "Si coincide con lo apuntado, te lo dice: «Cuadra».", src: "/guia/caja-3-cuadra.webp", alt: "Aviso Cuadra tras contar el efectivo del cajón", w: 300, h: 222, marcador: { top: "77%", left: "40%" } },
      { texto: "En el móvil, los mismos tres números arriba del todo.", src: "/guia/movil-5-caja.webp", alt: "Caja del día en el móvil, con el total cobrado y el reparto por forma de pago", w: 390, h: 670 },
    ],
  },
  {
    id: "hoy",
    titulo: "Tu día, de un vistazo",
    pasos: [
      { texto: "Citas de hoy, huecos libres, ingresos y lo pendiente de ti, en una pantalla.", src: "/guia/hoy-1-resumen.webp", alt: "Pantalla Hoy con las citas del día, huecos libres, ingresos y las solicitudes por confirmar", w: 1036, h: 390 },
    ],
  },
  {
    id: "calendario",
    titulo: "El calendario: ver y mover una cita",
    pasos: [
      { texto: "Semana, día o mes: cada profesional en su columna, por colores.", src: "/guia/calendario-1-semana.webp", alt: "Vista semanal del calendario con las citas de cada profesional en columnas de colores", w: 1036, h: 480 },
      { texto: "Toca una cita para cambiar el día, la hora o la duración; para cancelarla, baja hasta «Cancelar cita» en la misma ficha.", src: "/guia/calendario-2-mover.webp", alt: "Campos de fecha, duración y hora dentro de la ficha de una cita, listos para cambiarse", w: 386, h: 147, marcador: { top: "40%", left: "48%" } },
    ],
  },
  {
    id: "reservas-web",
    titulo: "Reservas de clientas desde tu web",
    pasos: [
      { texto: "Tu web tiene su propio botón «Reservar cita»: ellas eligen servicio, día y hora libre, sin llamarte.", src: "/guia/web-1-hero.webp", alt: "Página pública de reservas de PeluChic, con el botón Reservar cita y los datos del salón", w: 1280, h: 560, marcador: { top: "84%", left: "3%" } },
    ],
  },
  {
    id: "clientas",
    titulo: "Clientas y lista de espera",
    pasos: [
      { texto: "Cada clienta tiene su ficha: última visita, frecuencia y cuánto suele gastar.", src: "/guia/clientas-1-lista.webp", alt: "Listado de clientas con su última visita, frecuencia y gasto orientativo", w: 1036, h: 420 },
      { texto: "Si alguien cancela, avisas por WhatsApp a quien espera, o la metes directa en la cita libre.", src: "/guia/espera-1-lista.webp", alt: "Lista de espera con los botones Avisar hueco y Convertir en cita", w: 1036, h: 420, marcador: { top: "83%", left: "92%" } },
    ],
  },
  {
    id: "asistente",
    titulo: "El asistente",
    pasos: [
      { texto: "Le preguntas como hablas y responde con tus datos reales, sin inventarse nada.", src: "/guia/asistente-1-respuesta.webp", alt: "Asistente respondiendo «Hoy tienes 19 citas: 5 de María, 7 de Sara y 7 de Noelia»", w: 438, h: 330 },
    ],
  },
  {
    id: "mi-pagina",
    titulo: "Tu página y tus servicios",
    pasos: [
      { texto: "Cambias nombre, foto y presentación viendo el resultado al lado, antes de publicar.", src: "/guia/mipagina-1-editor.webp", alt: "Editor de Mi página de reservas con la vista previa de la web al lado", w: 1036, h: 460 },
      { texto: "Tu carta completa está en Servicios y precios: duración y precio de cada uno.", src: "/guia/servicios-1-carta.webp", alt: "Listado de Servicios y precios agrupado por familias, con duración y precio de cada uno", w: 1036, h: 400 },
    ],
  },
  {
    id: "equipo",
    titulo: "Tu equipo y permisos",
    pasos: [
      { texto: "Cada profesional con su horario y lo que más hace.", src: "/guia/equipo-1-lista.webp", alt: "Pantalla Equipo con las tarjetas de María, Sara y Noelia, su horario y lo que más hacen", w: 1036, h: 460 },
      { texto: "En Accesos decides quién entra y con qué rol: gerente, subencargada o estilista.", src: "/guia/equipo-2-accesos.webp", alt: "Lista de Accesos con María de Gerente, Sara y Noelia de Estilista y Laura de Subencargada", w: 706, h: 377 },
    ],
  },
  {
    id: "historial",
    titulo: "Deshacer e historial",
    pasos: [
      { texto: "Todo cambio queda anotado: quién, qué y cuándo, con un botón para deshacerlo.", src: "/guia/historial-fila.webp", alt: "Fila del historial: María confirmó la cita de Nuria, con su botón Deshacer", w: 692, h: 106, marcador: { top: "48%", left: "95%" } },
    ],
  },
];

const TOTAL_IMAGENES = APARTADOS.reduce((n, a) => n + a.pasos.length, 0);

/** Tope de ancho: nunca por encima del tamaño natural de la captura. */
function anchoTope(p: Paso): number {
  const tope = p.src.includes("/movil-") ? 320 : 560;
  return Math.min(p.w, tope);
}

export function GuiaUso() {
  const [ampliada, setAmpliada] = useState<Paso | null>(null);
  return (
    <div className="space-y-6">
      <p className="text-[14px] text-cafe-medio">
        Cómo se usa siShow, paso a paso y con capturas de tu propio panel · {TOTAL_IMAGENES} imágenes. Toca un apartado del índice para ir directa, o baja con el dedo. Toca cualquier imagen para verla grande.
      </p>

      <nav aria-label="Índice de la guía" className="rounded-2xl border border-lino bg-nata p-3.5">
        <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {APARTADOS.map((a, i) => (
            <li key={a.id}>
              <a
                href={`#guia-${a.id}`}
                className="block rounded-lg px-2 py-1.5 text-[13px] font-bold text-cafe-medio hover:bg-beige hover:text-foreground"
              >
                {i + 1}. {a.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-9">
        {APARTADOS.map((a, i) => (
          <section key={a.id} id={`guia-${a.id}`} className="scroll-mt-24 space-y-3">
            <h3 className="text-[16px] font-extrabold tracking-[-0.01em]">
              {i + 1}. {a.titulo}
            </h3>
            {a.intro && <p className="text-[13.5px] text-cafe-medio">{a.intro}</p>}
            <ol className="space-y-5">
              {a.pasos.map((p, j) => {
                const ancho = anchoTope(p);
                return (
                  <li key={p.src} className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <p className="flex items-start gap-2 text-[14px] text-foreground sm:w-52 sm:shrink-0">
                      <span className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-hoja text-[12px] font-extrabold text-white" aria-hidden="true">
                        {j + 1}
                      </span>
                      {p.texto}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAmpliada(p)}
                      className="group relative inline-block shrink-0 rounded-2xl border border-lino bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-moca"
                      style={{ width: ancho, maxWidth: "100%" }}
                      aria-label={`Ampliar captura del paso ${j + 1}: ${p.alt}`}
                    >
                      <img
                        src={p.src}
                        alt={p.alt}
                        width={p.w}
                        height={p.h}
                        loading="lazy"
                        className="block h-auto w-full rounded-2xl transition-transform duration-200 group-hover:scale-[1.01]"
                      />
                      {p.marcador && (
                        <span
                          className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-melocoton text-[11px] font-extrabold text-cafe shadow-md"
                          style={{ top: p.marcador.top, left: p.marcador.left }}
                          aria-hidden="true"
                        >
                          {j + 1}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
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
