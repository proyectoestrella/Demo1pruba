import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ApuntarFoco } from "@/components/ui/apuntar-foco";
import { devolverFocoA } from "@/lib/foco-de-vuelta";
import {
  debeMostrarHojaCalendarioMovil,
  diaBaldosaCalendario,
  type DatosCita,
  type TipoCalendarioDispositivo,
} from "@/lib/calendario";
import { IconoCalendarioApple, IconoCalendarioGoogle } from "@/components/IconosCalendario";

const CLAVE_PREFIJO = "sishow.hojaCalendario.mostrada.";

function leerMostrada(clave: string): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE_PREFIJO + clave) === "1";
  } catch {
    // Modo privado o almacenamiento bloqueado: no impide guardar la cita.
    return false;
  }
}

function marcarMostrada(clave: string): void {
  try {
    window.sessionStorage.setItem(CLAVE_PREFIJO + clave, "1");
  } catch {
    // Ver leerMostrada: fallo silencioso, no crítico.
  }
}

export interface HojaCalendarioMovilProps {
  datosCita: DatosCita;
  /** Clave estable de esta cita — ver `claveHojaCalendarioMovil`. */
  clave: string;
  tipoDispositivo: TipoCalendarioDispositivo;
  enlaceGoogle: string;
  enlaceAppleDataUri: string;
  /** Fecha ya formateada en es-ES ("lunes, 5 de octubre"), la misma que usa la tarjeta de arriba. */
  dateLabel: string;
}

/**
 * Hoja inferior que aparece una sola vez por cita y sesión al llegar a la
 * confirmación. Ofrece los mismos enlaces de calendario que ya genera la
 * página y adapta la acción principal al sistema operativo.
 */
export function HojaCalendarioMovil({
  datosCita,
  clave,
  tipoDispositivo,
  enlaceGoogle,
  enlaceAppleDataUri,
  dateLabel,
}: HojaCalendarioMovilProps) {
  const [abierta, setAbierta] = useState(false);
  const primarioRef = useRef<HTMLAnchorElement>(null);
  const antesRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const yaMostrada = leerMostrada(clave);
    if (!debeMostrarHojaCalendarioMovil({ hayDatosCita: true, yaMostrada })) return;
    marcarMostrada(clave);
    setAbierta(true);
  }, [clave]);

  function cerrar() {
    setAbierta(false);
  }

  const { diaSemana, diaMes } = diaBaldosaCalendario(datosCita.fecha);
  const orden = tipoDispositivo === "apple"
    ? (["apple"] as const)
    : tipoDispositivo === "android"
      ? (["google"] as const)
      : (["google", "apple"] as const);

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
            ¿La añadimos a tu calendario?
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
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-primary bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-primary bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <IconoCalendarioApple diaSemana={diaSemana} diaMes={diaMes} className="h-10 w-10 shrink-0" />
                  Calendario de Apple
                </a>
              ),
            )}
          </div>

          <a
            href={enlaceAppleDataUri}
            download="cita.ics"
            onClick={cerrar}
            className="mx-auto mt-3 flex min-h-11 items-center justify-center rounded-full px-4 text-[15px] font-semibold text-cafe-medio underline underline-offset-2 hover:bg-beige"
          >
            Otro calendario
          </a>

          <button
            type="button"
            onClick={cerrar}
            className="mx-auto flex min-h-11 items-center justify-center rounded-full px-4 text-[15px] font-medium text-cafe-medio hover:bg-beige"
          >
            Ahora no
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
