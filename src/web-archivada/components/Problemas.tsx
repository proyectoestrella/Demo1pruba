import type { ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";

/**
 * «Así se lleva hoy un salón» frente a «con siShow». A la izquierda, cuatro
 * escenas que la dueña reconoce (dibujadas en HTML, no son capturas); a la
 * derecha, qué cambia. La tabla de dos columnas es la información: lo de
 * antes y lo de ahora, fila a fila.
 */
export function Problemas() {
  return (
    <section className="ws-banda-arena ws-seccion" aria-labelledby="ws-problemas">
      <div className="ws-contenedor">
        <div className="max-w-3xl">
          <h2 id="ws-problemas" className="ws-display ws-h2">
            Menos WhatsApp a medianoche. Más tiempo para el salón.
          </h2>
          <p className="ws-entradilla mt-5 ws-medida">
            Si llevas el salón con el móvil, una libreta y buena memoria, esto te sonará.
          </p>
        </div>
        <div className="mt-12 hidden grid-cols-2 gap-10 border-b border-[color:var(--ws-lino-f)] pb-3 text-[0.95rem] font-extrabold md:grid">
          <p>Sin siShow</p>
          <p className="text-[color:var(--ws-hoja)]">Con siShow</p>
        </div>
        <ol className="mt-6 md:mt-0">
          <Fila escena={<EscenaWhatsapp />} pie="Contestas a medianoche, entre la cena y el baño.">
            Tu web de reservas enseña tus huecos de verdad. Ella elige servicio, profesional y hora, y a ti te llega la
            solicitud para confirmarla con un toque.
          </Fila>
          <Fila escena={<EscenaLibreta />} pie="La agenda en papel: tachones, flechas y una sola copia.">
            Una agenda para todo el equipo, en el móvil, el iPad y el ordenador. Cada cita con el color de su servicio, y
            si mueves algo sin querer, lo deshaces.
          </Fila>
          <Fila escena={<EscenaPlanton />} pie="Un plantón en una cita de dos horas es media mañana perdida.">
            El recordatorio de la víspera sale con un toque desde tu WhatsApp, y a las citas largas puedes pedirles una
            señal por Bizum que te llega a ti.
          </Fila>
          <Fila escena={<EscenaColor />} pie="La fórmula de cada clienta, en la cabeza de quien la atendió.">
            La ficha de cada clienta guarda la fórmula, el oxidante y el tiempo de cada visita, con quién vino y lo que se
            hizo. Y sus avisos, siempre a la vista.
          </Fila>
        </ol>
      </div>
    </section>
  );
}

function Fila({ escena, pie, children }: { escena: ReactNode; pie: string; children: ReactNode }) {
  return (
    <li className="grid gap-5 border-b border-[color:var(--ws-lino)] py-9 last:border-b-0 md:grid-cols-2 md:gap-10 md:py-10">
      <div>
        <p className="mb-3 text-[0.85rem] font-extrabold md:hidden">Sin siShow</p>
        {escena}
        <p className="ws-texto mt-3 text-[0.95rem]">{pie}</p>
      </div>
      <div className="md:pt-2">
        <p className="mb-3 text-[0.85rem] font-extrabold text-[color:var(--ws-hoja)] md:hidden">Con siShow</p>
        <p className="flex gap-3 text-[1.08rem] leading-relaxed md:text-[1.15rem]">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--ws-salvia)] text-[color:var(--ws-hoja)]">
            <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
          </span>
          <span>{children}</span>
        </p>
      </div>
    </li>
  );
}

const CAJA = "rounded-2xl border border-[color:var(--ws-lino)] bg-[color:var(--ws-crema)] p-4 sm:p-5";

function EscenaWhatsapp() {
  return (
    <div className={CAJA} role="img" aria-label="Mensajes de una clienta a las 23:48 preguntando si hay hueco el sábado para mechas.">
      <p className="text-[0.8rem] font-bold text-[color:var(--ws-cafe-m)]">Carmen · WhatsApp</p>
      <div className="mt-3 space-y-2">
        <Burbuja hora="23:48">Hola, ¿tienes hueco el sábado para mechas?</Burbuja>
        <Burbuja hora="23:51">Si no, el viernes por la tarde también me vale</Burbuja>
        <p className="pt-1 text-[0.78rem] font-semibold text-[color:var(--ws-cafe-m)]">Carmen está escribiendo…</p>
      </div>
    </div>
  );
}

function Burbuja({ hora, children }: { hora: string; children: ReactNode }) {
  return (
    <p className="w-fit max-w-[92%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2 text-[0.92rem] leading-snug shadow-[0_1px_2px_rgba(59,47,42,0.08)]">
      {children}
      <span className="ws-cifra ml-2 align-bottom text-[0.72rem] text-[color:var(--ws-cafe-m)]">{hora}</span>
    </p>
  );
}

function EscenaLibreta() {
  const lineas: { hora: string; texto: string; tachado?: boolean; nota?: string }[] = [
    { hora: "10:00", texto: "Carmen, tinte", tachado: true },
    { hora: "10:30", texto: "Carmen, tinte", nota: "la pasé aquí" },
    { hora: "11:00", texto: "¿Marta? llamar", tachado: true },
    { hora: "12:00", texto: "Lucía, mechas (Sara)" },
  ];
  return (
    <div
      className={CAJA}
      role="img"
      aria-label="Una página de libreta con citas tachadas y movidas a mano."
    >
      <p className="text-[0.8rem] font-bold text-[color:var(--ws-cafe-m)]">Sábado 26</p>
      <ul className="mt-1">
        {lineas.map((l) => (
          <li key={l.hora + l.texto} className="flex h-[2.35rem] items-center gap-3 border-b border-[color:var(--ws-lino)] text-[0.95rem]">
            <span className="ws-cifra w-12 shrink-0 font-bold">{l.hora}</span>
            <span className={l.tachado ? "text-[color:var(--ws-cafe-m)] line-through decoration-[color:var(--ws-moca)] decoration-2" : ""}>
              {l.texto}
            </span>
            {l.nota && <span className="text-[0.78rem] font-semibold text-[color:var(--ws-moca)]">← {l.nota}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EscenaPlanton() {
  return (
    <div className={CAJA} role="img" aria-label="Cita de mechas de dos horas el sábado a las 10:00 marcada como no vino.">
      <p className="text-[0.8rem] font-bold text-[color:var(--ws-cafe-m)]">Sábado 26</p>
      <div className="mt-3 rounded-xl border-l-4 border-[#3EA67C] bg-[#D7F2E6] px-4 py-3 text-[#1F2633]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">Valentina Sánchez</p>
            <p className="ws-cifra text-[0.88rem] text-[#4A5363]">10:00 a 12:00 · Mechas / balayage</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F1D9C8] px-2.5 py-1 text-[0.78rem] font-bold text-[#74462B]">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> No vino
          </span>
        </div>
      </div>
      <p className="ws-cifra mt-3 text-[0.9rem] font-bold">2 horas vacías · 80 € que no entran</p>
    </div>
  );
}

function EscenaColor() {
  return (
    <div className={CAJA} role="img" aria-label="Una pregunta sin respuesta: qué tono se le puso a Carmen en marzo.">
      <p className="text-[1.05rem] font-bold">«¿Qué tono le pusimos a Carmen en marzo?»</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {["¿7.1?", "¿7.3?", "¿8.0 con 20 vol?"].map((t) => (
          <span key={t} className="ws-pildora ws-pildora-borde ws-cifra">
            {t}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[0.88rem] text-[color:var(--ws-cafe-m)]">Sara libra hoy y no contesta al teléfono.</p>
    </div>
  );
}
