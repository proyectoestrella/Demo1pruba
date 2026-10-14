import { useCallback, useEffect, useState } from "react";
import {
  debeEsperarPortadaDemo,
  debeMostrarPantallaCargaDemo,
  inicialesDelSalon,
} from "@/lib/demo-loading";

const DURACION_FUNDIDO_MS = 300;
const MAXIMO_CARGA_MS = 1800;

type Estado = "visible" | "saliendo" | "oculto";

export function DemoLoadingScreen({
  conEnlaceDemo,
  nombre,
  logoUrl,
  portadaLista,
  tienePortada,
}: {
  conEnlaceDemo: boolean;
  nombre: string;
  logoUrl: string | null;
  portadaLista: boolean;
  tienePortada: boolean;
}) {
  const activa = debeMostrarPantallaCargaDemo(conEnlaceDemo);
  const [estado, setEstado] = useState<Estado>(activa ? "visible" : "oculto");
  const [menosMovimiento, setMenosMovimiento] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const actualizar = () => setMenosMovimiento(media.matches);
    actualizar();
    media.addEventListener("change", actualizar);
    return () => media.removeEventListener("change", actualizar);
  }, []);

  const cerrar = useCallback(() => {
    setEstado((actual) => {
      if (actual !== "visible") return actual;
      return menosMovimiento ? "oculto" : "saliendo";
    });
  }, [menosMovimiento]);

  useEffect(() => {
    if (!activa) {
      setEstado("oculto");
      return;
    }
    setEstado("visible");
  }, [activa, nombre]);

  useEffect(() => {
    if (!activa || estado !== "visible") return;
    if (portadaLista || !debeEsperarPortadaDemo(tienePortada)) {
      cerrar();
      return;
    }
    // El fundido cuenta dentro del máximo de 1,8 s, no se suma después.
    const espera = menosMovimiento ? MAXIMO_CARGA_MS : MAXIMO_CARGA_MS - DURACION_FUNDIDO_MS;
    const id = window.setTimeout(cerrar, espera);
    return () => window.clearTimeout(id);
  }, [activa, cerrar, estado, menosMovimiento, portadaLista, tienePortada]);

  useEffect(() => {
    if (estado !== "saliendo") return;
    const id = window.setTimeout(() => setEstado("oculto"), DURACION_FUNDIDO_MS);
    return () => window.clearTimeout(id);
  }, [estado]);

  if (!activa || estado === "oculto") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] grid place-items-center bg-ws-crema px-5 transition-opacity duration-300 motion-reduce:transition-none ${
        estado === "saliendo"
          ? "pointer-events-none opacity-0"
          : "opacity-100"
      }`}
    >
      <div className="flex max-w-[min(100%,22rem)] flex-col items-center text-center">
        {logoUrl ? (
          <span className="grid size-28 place-items-center overflow-hidden rounded-[28px] border border-lino bg-white p-2 shadow-[0_12px_32px_rgba(59,47,42,0.12)] sm:size-30">
            <img src={logoUrl} alt="" className="h-full w-full object-contain" />
          </span>
        ) : (
          <span className="grid size-28 place-items-center rounded-full bg-primary font-display text-4xl font-semibold text-primary-foreground shadow-[0_12px_32px_rgba(59,47,42,0.16)] sm:size-30">
            {inicialesDelSalon(nombre)}
          </span>
        )}
        <p className="mt-5 break-words font-display text-2xl leading-tight text-foreground sm:text-3xl">
          {nombre}
        </p>
      </div>
    </div>
  );
}
