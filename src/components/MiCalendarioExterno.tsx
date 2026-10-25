import { useEffect, useState } from "react";
import { useSalonStore } from "@/lib/store";
import { getMiCalendario } from "@/lib/api/calendar.functions";
import { enlacesSuscripcion } from "@/lib/calendario-ics";

/**
 * «Ver mis citas en mi calendario» (25-oct noche, prometido en la formación):
 * cada profesional, desde su panel, con un toque. Es su enlace personal
 * firmado: solo sus citas confirmadas, con el servicio y sin la clienta.
 */
export function MiCalendarioExterno() {
  const slug = useSalonStore((s) => s.realSalonSlug);
  const [ruta, setRuta] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    if (!slug) return;
    let activo = true;
    void getMiCalendario({ data: { slug } })
      .then((r) => activo && setRuta(r.ruta))
      .catch(() => activo && setFallo(true));
    return () => {
      activo = false;
    };
  }, [slug]);
  const url = ruta && typeof window !== "undefined" ? `${window.location.origin}${ruta}` : "";
  const { webcal, google } = url ? enlacesSuscripcion(url) : { webcal: "", google: "" };
  const clase =
    "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-input bg-blanco px-3 text-center text-sm font-semibold aria-disabled:opacity-50";
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-extrabold">Mis citas en mi calendario</p>
      {!slug ? (
        <p className="text-xs text-muted-foreground">Se activa en el salón real, no en la demo.</p>
      ) : fallo ? (
        <p className="text-xs text-melocoton-tinta">No se pudo preparar tu enlace. Vuelve a intentarlo en un rato.</p>
      ) : (
        <>
          <a className={clase} href={webcal || undefined} aria-disabled={!webcal}>
            Añadir al iPhone (Calendario de Apple)
          </a>
          <p className="text-xs text-muted-foreground">En el iPhone: toca y luego «Suscribirse».</p>
          <a className={clase} href={google || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!google}>
            Añadir a Google Calendar
          </a>
          <p className="text-xs text-muted-foreground">
            Android u ordenador: toca, entra con tu cuenta de Google y pulsa «Añadir».
          </p>
          <p className="text-xs text-muted-foreground">
            Solo tus citas confirmadas; se actualiza solo cada pocas horas.
          </p>
        </>
      )}
    </div>
  );
}
