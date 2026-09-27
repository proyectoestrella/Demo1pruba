import { useRef, useState, type KeyboardEvent } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOMBRE_PLAN, PLANES, type PlanSishow } from "@/lib/plan";
import {
  A_TU_MEDIDA,
  COMPARATIVA,
  DETALLE_PLANES,
  PRECIOS,
  PUESTA_EN_MARCHA,
  PUESTA_INCLUYE,
  enlaceCorreo,
  notaImpuestos,
  precioPuestaEnMarcha,
  type CeldaPlan,
} from "@/lib/sishow-web";

const DESTACADO: PlanSishow = "reservas-asistente";

/** Selector de forma de pago: un grupo de radio con flechas, como manda ARIA. */
function SelectorPago({ anual, onCambio }: { anual: boolean; onCambio: (anual: boolean) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const opciones = [
    { valor: true, texto: "Pago anual" },
    { valor: false, texto: "Mes a mes" },
  ];
  const teclas = (e: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const siguiente = !anual;
    onCambio(siguiente);
    refs.current[siguiente ? 0 : 1]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Forma de pago" className="inline-flex rounded-full border border-[color:var(--ws-lino-f)] bg-[color:var(--ws-crema)] p-1" onKeyDown={teclas}>
      {opciones.map((o, i) => (
        <button
          key={o.texto}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={anual === o.valor}
          tabIndex={anual === o.valor ? 0 : -1}
          onClick={() => onCambio(o.valor)}
          className={cn(
            "min-h-11 rounded-full px-5 text-[0.95rem] font-bold transition-colors",
            anual === o.valor ? "bg-[color:var(--ws-moca)] text-white" : "text-[color:var(--ws-cafe-m)] hover:text-[color:var(--ws-cafe)]",
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Las tres tarjetas de plan con el precio según la forma de pago elegida. */
export function TarjetasPlanes() {
  const [anual, setAnual] = useState(true);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <SelectorPago anual={anual} onCambio={setAnual} />
        <p className="text-[0.95rem] text-[color:var(--ws-cafe-m)]" aria-live="polite">
          {anual ? "Pagando el año entero, cada mes sale más barato." : "Sin pagar el año por adelantado."}
        </p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANES.map((plan) => {
          const destacado = plan === DESTACADO;
          const precio = PRECIOS[plan];
          return (
            <article
              key={plan}
              className={cn(
                "relative flex flex-col rounded-[1.25rem] border bg-[color:var(--ws-crema)] p-7 sm:p-8",
                destacado ? "border-2 border-[color:var(--ws-moca)]" : "border-[color:var(--ws-lino)]",
              )}
            >
              {destacado && (
                <span className="ws-pildora absolute -top-3.5 left-7 bg-[color:var(--ws-moca)] text-[0.8rem] text-white">Recomendado</span>
              )}
              <h2 className="text-[1.35rem] font-extrabold">{NOMBRE_PLAN[plan]}</h2>
              <p className="mt-1.5 text-[0.98rem] text-[color:var(--ws-cafe-m)]">{DETALLE_PLANES[plan].para}</p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="ws-cifra text-[3.1rem] font-extrabold leading-none tracking-tight">
                  {anual ? precio.anual : precio.mensual} €
                </span>
                <span className="text-[1rem] text-[color:var(--ws-cafe-m)]">al mes</span>
              </p>
              <p className="ws-cifra mt-2 min-h-[1.5rem] text-[0.92rem] text-[color:var(--ws-cafe-m)]">
                {anual ? `${precio.anual * 12} € al año. Mes a mes, ${precio.mensual} €.` : `Con el pago anual, ${precio.anual} € al mes.`}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 border-t border-[color:var(--ws-lino)] pt-6">
                {DETALLE_PLANES[plan].puntos.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[0.98rem]">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[color:var(--ws-hoja)]" strokeWidth={2.6} aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
              <a
                href={enlaceCorreo(`Quiero el plan ${NOMBRE_PLAN[plan]} (${anual ? "pago anual" : "mes a mes"})`)}
                className={cn("ws-boton mt-8 w-full", destacado ? "ws-boton-p" : "ws-boton-s")}
              >
                Quiero este plan
              </a>
            </article>
          );
        })}
      </div>
      <NotaImpuestos />
    </div>
  );
}

/**
 * Si los precios llevan IVA o no. Mientras Tomás no lo decida
 * (`PRECIOS_CON_IVA = null`), se ve el aviso de pendiente, discreto.
 */
export function NotaImpuestos() {
  const nota = notaImpuestos();
  return nota ? (
    <p className="mt-6 text-[0.95rem] text-[color:var(--ws-cafe-m)]">{nota}</p>
  ) : (
    <p className="ws-pendiente mt-6 max-w-2xl">Pendiente: indicar si los precios incluyen IVA.</p>
  );
}

/** Puesta en marcha y lo que va a tu medida, lado a lado. */
export function PuestaYMedida() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <article className="ws-tarjeta p-7 sm:p-8">
        <h2 className="text-[1.35rem] font-extrabold">Puesta en marcha</h2>
        <p className="ws-cifra mt-3 text-[1.05rem]">
          {PUESTA_EN_MARCHA.horas} horas de trabajo nuestro a {PUESTA_EN_MARCHA.precioHora} € la hora:{" "}
          <b>{precioPuestaEnMarcha(false)} €</b>, una sola vez. Con el pago anual, la mitad:{" "}
          <b>{precioPuestaEnMarcha(true)} €</b>.
        </p>
        <ul className="mt-5 space-y-2.5">
          {PUESTA_INCLUYE.map((p) => (
            <li key={p} className="flex gap-2.5">
              <Check className="mt-1 h-4 w-4 shrink-0 text-[color:var(--ws-hoja)]" strokeWidth={2.6} aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </article>
      <article className="rounded-[1.25rem] border-[1.5px] border-dashed border-[color:var(--ws-moca)] bg-[color:var(--ws-crema)] p-7 sm:p-8">
        <h2 className="text-[1.35rem] font-extrabold">A tu medida</h2>
        <p className="ws-texto mt-3">Lo que no entra en ningún plan. Nos cuentas qué necesitas y te lo presupuestamos por escrito.</p>
        <ul className="mt-5 space-y-4">
          {A_TU_MEDIDA.map((m) => (
            <li key={m.titulo}>
              <p className="font-bold">{m.titulo}</p>
              <p className="ws-texto mt-0.5 text-[0.96rem]">{m.texto}</p>
            </li>
          ))}
        </ul>
        <a href={enlaceCorreo("Quiero algo a mi medida")} className="ws-boton ws-boton-s mt-6">
          Pedir presupuesto
        </a>
      </article>
    </div>
  );
}

function Celda({ valor }: { valor: CeldaPlan }) {
  if (valor === true)
    return (
      <>
        <Check className="mx-auto h-5 w-5 text-[color:var(--ws-hoja)]" strokeWidth={2.6} aria-hidden="true" />
        <span className="sr-only">Incluido</span>
      </>
    );
  if (valor === false)
    return (
      <>
        <Minus className="mx-auto h-4 w-4 text-[color:var(--ws-cafe-m)]" aria-hidden="true" />
        <span className="sr-only">No incluido</span>
      </>
    );
  return <span className="ws-cifra font-bold">{valor}</span>;
}

/** Tabla comparativa completa. En móvil se desplaza en horizontal con la primera columna fija. */
export function TablaComparativa() {
  return (
    <div className="ws-tabla-caja" role="region" aria-label="Comparativa de planes" tabIndex={0}>
      <table className="ws-tabla">
        <caption className="sr-only">Qué incluye cada plan de siShow</caption>
        <thead>
          <tr>
            <th scope="col">Función</th>
            {PLANES.map((p) => (
              <th key={p} scope="col">
                {NOMBRE_PLAN[p]}
                <span className="ws-cifra block text-[0.85rem] font-semibold text-[color:var(--ws-cafe-m)]">
                  {PRECIOS[p].anual} € / {PRECIOS[p].mensual} €
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARATIVA.map((g) => (
            <GrupoFilas key={g.grupo} grupo={g.grupo} filas={g.filas} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrupoFilas({ grupo, filas }: { grupo: string; filas: (typeof COMPARATIVA)[number]["filas"] }) {
  return (
    <>
      <tr className="ws-tabla-grupo">
        <th scope="colgroup" colSpan={PLANES.length + 1}>
          {grupo}
        </th>
      </tr>
      {filas.map((f) => (
        <tr key={f.funcion}>
          <th scope="row">{f.funcion}</th>
          {PLANES.map((p) => (
            <td key={p}>
              <Celda valor={f.planes[p]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
