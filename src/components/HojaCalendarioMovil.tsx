import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ApuntarFoco } from "@/components/ui/apuntar-foco";
import { devolverFocoA } from "@/lib/foco-de-vuelta";
import {
  debeMostrarHojaCalendarioMovil,
  diaBaldosaCalendario,
  type DatosCita,
} from "@/lib/calendario";
import { IconoCalendarioApple, IconoCalendarioGoogle } from "@/components/IconosCalendario";

/** Retraso antes de abrir la hoja, para no interrumpir el pintado inicial. */
const RETRASO_MS = 600;
/** Mismo punto de corte que pide la tarea: 640 px, no el `useIsMobile` (768). */
const CONSULTA_MOVIL_ANGOSTO = "(max-width: 640px)";
const CLAVE_PREFIJO = "sishow.hojaCalendarioMovil.cerrada.";

/** ¿El viewport actual es de móvil estrecho (≤640 px)? Falso durante el SSR
 * y el primer render del cliente, hasta que el efecto mide de verdad. */
function useEsMovilAngosto(): boolean {
  const [esMovil, setEsMovil] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(CONSULTA_MOVIL_ANGOSTO);
    const onChange = () => setEsMovil(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return esMovil;
}

function leerCerrada(clave: string): boolean {
  try {
    return window.localStorage.getItem(CLAVE_PREFIJO + clave) === "1";
  } catch {
    // Modo privado, cuota agotada, etc.: en el peor caso vuelve a aparecer
    // la próxima vez, no rompe nada.
    return false;
  }
}

function marcarCerrada(clave: string): void {
  try {
    window.localStorage.setItem(CLAVE_PREFIJO + clave, "1");
  } catch {
    // Ver leerCerrada: fallo silencioso, no crítico.
  }
}

export interface HojaCalendarioMovilProps {
  datosCita: DatosCita;
  /** Clave estable de esta cita — ver `claveHojaCalendarioMovil`. */
  clave: string;
  /** true si el dispositivo es Apple: decide qué botón va primero y cuál recibe el foco. */
  esApple: boolean;
  enlaceGoogle: string;
  enlaceAppleDataUri: string;
  /** Fecha ya formateada en es-ES ("lunes, 5 de octubre"), la misma que usa la tarjeta de arriba. */
  dateLabel: string;
}

/**
 * Hoja inferior (bottom sheet) que aparece una sola vez, ~0,6 s después de
 * llegar a la confirmación de reserva, SOLO en móvil estrecho (≤640 px):
 * ofrece guardar la cita en el calendario con los mismos enlaces que ya
 * genera `@/lib/calendario`, sin cambiar cómo se construyen. En escritorio
 * no se monta contenido nunca (el bloque de botones de siempre sigue ahí,
 * con los iconos nuevos). No vuelve a aparecer para la misma cita una vez
 * cerrada, la haya cerrado como sea (Ahora no, Esc, fuera, o eligiendo un
 * calendario).
 */
export function HojaCalendarioMovil({
  datosCita,
  clave,
  esApple,
  enlaceGoogle,
  enlaceAppleDataUri,
  dateLabel,
}: HojaCalendarioMovilProps) {
  const esMovilAngosto = useEsMovilAngosto();
  const [yaCerrada, setYaCerrada] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const primarioRef = useRef<HTMLAnchorElement>(null);
  const antesRef = useRef<HTMLElement | null>(null);

  // La lectura de localStorage es I/O: se resuelve en un efecto, no durante
  // el render, para no divergir entre servidor y cliente.
  useEffect(() => {
    setYaCerrada(leerCerrada(clave));
  }, [clave]);

  useEffect(() => {
    if (!debeMostrarHojaCalendarioMovil({ esMovilAngosto, hayDatosCita: true, yaCerrada })) return;
    const id = window.setTimeout(() => setAbierta(true), RETRASO_MS);
    return () => window.clearTimeout(id);
  }, [esMovilAngosto, yaCerrada, clave]);

  function cerrar() {
    setAbierta(false);
    marcarCerrada(clave);
    setYaCerrada(true);
  }

  const { diaSemana, diaMes } = diaBaldosaCalendario(datosCita.fecha);
  const orden = esApple ? (["apple", "google"] as const) : (["google", "apple"] as const);

  return (
    <DialogPrimitive.Root open={abierta} onOpenChange={(siguiente) => { if (!siguiente) cerrar(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-cafe/30 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          // Esta versión de @radix-ui/react-dialog pone `role="dialog"` pero
          // no `aria-modal` (tampoco lo hace en Dialog/Sheet existentes):
          // se añade explícito para cumplir el contrato de accesibilidad.
          aria-modal="true"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            primarioRef.current?.focus();
          }}
          onCloseAutoFocus={devolverFocoA(antesRef)}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] border-t border-lino bg-card px-5 pt-3 shadow-[0_-16px_40px_-16px_rgba(58,42,30,0.35)] motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:slide-out-to-bottom motion-safe:data-[state=open]:slide-in-from-bottom motion-safe:duration-300"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
        >
          <ApuntarFoco destino={antesRef} />
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-moca/40" aria-hidden="true" />
          <DialogPrimitive.Title className="text-[17px] font-extrabold leading-snug text-foreground">
            ¿La guardas en tu calendario?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-[13px] text-muted-foreground">
            {datosCita.servicio} · {dateLabel} · {datosCita.hora}
          </DialogPrimitive.Description>

          <div className="mt-5 flex flex-col gap-3">
            {orden.map((proveedor, i) =>
              proveedor === "google" ? (
                <a
                  key="google"
                  ref={i === 0 ? primarioRef : undefined}
                  href={enlaceGoogle}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={cerrar}
                  className="flex h-16 items-center gap-3 rounded-2xl border border-input bg-card px-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-nata focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <IconoCalendarioGoogle diaMes={diaMes} className="h-10 w-10 shrink-0" />
                  Google Calendar
                </a>
              ) : (
                <a
                  key="apple"
                  ref={i === 0 ? primarioRef : undefined}
                  href={enlaceAppleDataUri}
                  onClick={cerrar}
                  className="flex h-16 items-center gap-3 rounded-2xl border border-input bg-card px-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-nata focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <IconoCalendarioApple diaSemana={diaSemana} diaMes={diaMes} className="h-10 w-10 shrink-0" />
                  Calendario de Apple
                </a>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={cerrar}
            className="mx-auto mt-3 flex h-11 items-center justify-center rounded-full px-4 text-[15px] font-medium text-cafe-medio hover:bg-beige"
          >
            Ahora no
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
