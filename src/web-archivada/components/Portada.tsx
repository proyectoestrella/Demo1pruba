import { Link } from "@tanstack/react-router";
import { BellRing, Check } from "lucide-react";
import { PRECIOS } from "@/lib/sishow-web";
import { Movil, Portatil } from "./Dispositivos";

/**
 * Portada de la web oficial. El único momento orquestado de la página: con
 * el panel ya pintado, llega una solicitud nueva desde la web del salón. El
 * portátil y el móvil nacen visibles (no retrasan el primer pintado); solo
 * la tarjeta entra, y con `prefers-reduced-motion` aparece quieta.
 */
export function Portada() {
  return (
    <section className="relative overflow-hidden">
      <div className="ws-contenedor grid items-center gap-12 pb-16 pt-10 md:pt-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8 lg:pb-24 lg:pt-20">
        <div className="relative z-10">
          <p className="ws-pildora ws-pildora-salvia">Para peluquerías y centros de belleza</p>
          <h1 className="ws-display ws-h1 mt-5">Tus clientas reservan solas. Tú, a lo tuyo.</h1>
          <p className="ws-entradilla ws-medida mt-6">
            siShow es la agenda, la web de reservas, las fichas de color y la caja de tu salón, en una sola app para el
            móvil, el iPad o el ordenador.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" hash="demo" className="ws-boton ws-boton-p ws-boton-g">
              Probar la demo
            </Link>
            <Link to="/precios" className="ws-boton ws-boton-s ws-boton-g">
              Ver precios
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 text-[0.95rem] font-semibold">
            {[
              "Funcionando en una semana",
              `Desde ${PRECIOS.reservas.anual} € al mes`,
              "Sin comisiones por reserva",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-[color:var(--ws-hoja)]" aria-hidden="true" strokeWidth={2.5} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <EscenaPortada />
      </div>
    </section>
  );
}

function EscenaPortada() {
  return (
    <div className="relative mx-auto w-full max-w-[44rem] pb-[16%] pl-[7%] pt-[4%] sm:pb-[9%] sm:pt-[7%] lg:max-w-none">
      {/* Escenario salvia que sale hasta el borde derecho de la pantalla. */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-[16%] top-0 -right-[100vw] rounded-l-[2.5rem] bg-[color:var(--ws-salvia)]"
      />
      <Portatil
        captura="hoy"
        prioridad
        sizes="(min-width: 1680px) 760px, (min-width: 1024px) 50vw, 92vw"
        className="relative"
      />
      <Movil
        captura="movil-reserva-servicio"
        inmediata
        sizes="(min-width: 1024px) 13vw, 28vw"
        className="absolute bottom-[4%] left-0 w-[27%] sm:bottom-0"
      />
      <SolicitudEntrante />
    </div>
  );
}

/** Tarjeta de la solicitud que llega desde la web del salón. Es una muestra, no una captura. */
function SolicitudEntrante() {
  return (
    <div
      role="img"
      aria-label="Aviso de ejemplo: nueva solicitud de Lucía Gómez desde la web del salón, mechas con Sara el sábado 3 de octubre a las 10:00."
      className="ws-llega absolute bottom-0 right-0 w-[min(18.5rem,58%)] rounded-2xl border border-[color:var(--ws-lino)] bg-white p-3 shadow-[0_18px_44px_rgba(59,47,42,0.18)] sm:bottom-auto sm:right-[3%] sm:top-0 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <span className="hidden size-9 shrink-0 place-items-center rounded-full sm:grid bg-[color:var(--ws-salvia)] text-[color:var(--ws-hoja)]">
          <BellRing className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold leading-tight text-[color:var(--ws-hoja)] sm:text-[0.78rem]">Nueva solicitud desde tu web</p>
          <p className="ws-display mt-1 text-[1rem] leading-tight sm:text-[1.12rem]">Lucía Gómez</p>
          <p className="mt-0.5 text-[0.72rem] leading-snug text-[color:var(--ws-cafe-m)] sm:text-[0.82rem]">Mechas / balayage con Sara</p>
          <p className="ws-cifra text-[0.72rem] font-bold leading-snug sm:text-[0.82rem]">Sábado 3 de octubre, 10:00</p>
        </div>
      </div>
      <div className="mt-3 hidden gap-2 pl-12 sm:flex">
        <span className="rounded-full bg-[color:var(--ws-moca)] px-3.5 py-1.5 text-[0.8rem] font-bold text-white">Confirmar</span>
        <span className="rounded-full border border-[color:var(--ws-lino-f)] px-3.5 py-1.5 text-[0.8rem] font-bold">Ver ficha</span>
      </div>
    </div>
  );
}
