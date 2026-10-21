import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Columnas independientes: ampliar una tarjeta no redistribuye las demás. */
export function ColumnasServicios({ children }: { children: ReactNode }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [columnas, setColumnas] = useState(1);
  useLayoutEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;
    const actualizar = () => {
      const numero = Number(getComputedStyle(elemento).getPropertyValue("--columnas-servicios")) || 1;
      setColumnas(numero);
    };
    actualizar();
    const observador = new ResizeObserver(actualizar);
    observador.observe(elemento);
    window.addEventListener("resize", actualizar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", actualizar);
    };
  }, []);
  const tarjetas = Children.toArray(children);
  return <div ref={contenedor}
    className="grid items-start gap-4 [--columnas-servicios:1] md:[--columnas-servicios:2] xl:[--columnas-servicios:3] xl:group-data-[panel=abierto]/panel:[--columnas-servicios:1]"
    style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
    {Array.from({ length: columnas }, (_, columna) => (
      <div key={columna} className="flex min-w-0 flex-col gap-4">
        {tarjetas.filter((_, indice) => indice % columnas === columna)}
      </div>
    ))}
  </div>;
}
