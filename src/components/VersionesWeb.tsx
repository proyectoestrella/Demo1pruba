import { useTienePlan } from "@/lib/accesos-panel";
import { HORAS_HISTORIAL_ESTANDAR } from "@/lib/plan";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { useState } from "react";
import { ArrowRight, ChevronDown, History, Loader2 } from "lucide-react";
import { diferenciasWeb, useVersionesPanel, type VersionPanel, type WebPublicada } from "@/lib/versiones-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const cuando = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "").replace(",", ",");

/**
 * Mi página › versiones publicadas (lote 12, conectado a salón real en el
 * 14): cuál está publicada, las anteriores con fecha y quién.
 *
 * En la demo se conoce el contenido de cada versión (vive en este
 * navegador), así que al elegir una se ve lo que cambia frente a la actual y
 * hay «Ver cómo queda» (carga la vista previa sin publicar). En un salón
 * real el contenido no se conoce hasta restaurar —el servidor no baja el
 * perfil entero solo para listar—, así que ahí solo hay fecha, autora y
 * «Restaurar esta versión», con una confirmación en vez de la comparación.
 */
export function VersionesWeb({
  slug,
  esReal,
  actual,
  puedeRestaurar,
  onVer,
  onRestaurar,
}: {
  slug: string;
  esReal: boolean;
  actual: WebPublicada;
  puedeRestaurar: boolean;
  onVer: (web: WebPublicada) => void;
  onRestaurar: (version: VersionPanel) => void;
}) {
  const { versiones: todas, cargando, error, recargar } = useVersionesPanel(slug, esReal);
  // Lote 13: fuera de Todo incluido, las de las últimas 24 h.
  const completo = useTienePlan("historial-completo");
  const versiones = completo ? todas : todas.filter((v, i) => i === 0 || Date.now() - Date.parse(v.fecha) <= HORAS_HISTORIAL_ESTANDAR * 3_600_000);
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<VersionPanel | null>(null);
  const publicada = versiones[0];
  const cambios = elegida?.web ? diferenciasWeb(actual, elegida.web) : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex h-[42px] items-center gap-2 rounded-full border border-input bg-card px-3.5 text-[13px] font-bold text-cafe-medio hover:bg-nata"
      >
        <History className="size-4" strokeWidth={1.7} aria-hidden="true" />
        {publicada ? `Versión del ${cuando(publicada.fecha)}${publicada.autorNombre ? ` · ${publicada.autorNombre}` : ""}` : "Versiones"}
        <ChevronDown className="size-4" strokeWidth={1.7} aria-hidden="true" />
      </button>
      <Sheet
        open={abierto}
        onOpenChange={(o) => {
          setAbierto(o);
          if (!o) setElegida(null);
          // Salón real: recarga la lista al abrir, por si se acaba de
          // restaurar una versión (o publicado otra persona del equipo)
          // desde que se cargó esta pantalla.
          else if (esReal) recargar();
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="text-base font-extrabold">
              {elegida ? (elegida.web ? `Comparar con la del ${cuando(elegida.fecha)}` : `Restaurar la versión del ${cuando(elegida.fecha)}`) : "Versiones publicadas"}
            </SheetTitle>
            <SheetDescription>
              {elegida
                ? elegida.web
                  ? "Así cambiaría tu web si vuelves a esta versión."
                  : "Tu web volverá a estar exactamente como en esa fecha. Esto publica el cambio."
                : esReal
                  ? `Las ${versiones.length} últimas publicaciones.`
                  : `Las ${versiones.length} últimas publicaciones (se guardan 20).`}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {!elegida ? (
              cargando ? (
                <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Cargando versiones anteriores…
                </p>
              ) : error ? (
                <div className="space-y-2 text-[14px] text-muted-foreground">
                  <p>{error}</p>
                  <Button variant="outline" size="sm" onClick={recargar}>
                    Reintentar
                  </Button>
                </div>
              ) : versiones.length === 0 ? (
                <p className="text-[14px] text-muted-foreground">Todavía no has publicado ningún cambio. Cada vez que publiques quedará aquí una versión.</p>
              ) : (
                <ul className="space-y-1.5">
                  {versiones.map((v, i) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => setElegida(v)}
                        className={cn("flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left", i === 0 ? "border-salvia bg-salvia-suave" : "border-lino hover:bg-beige/60")}
                      >
                        <span className={cn("size-2.5 shrink-0 rounded-full", i === 0 ? "bg-hoja" : "border border-cafe-suave")} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <b className="block text-[14px] tabular-nums">{cuando(v.fecha)}</b>
                          <span className="block text-[12.5px] text-muted-foreground">
                            {v.autorNombre ?? "Demo"}
                            {i === 0 ? " · publicada ahora" : i === versiones.length - 1 ? " · la más antigua" : ""}
                          </span>
                        </span>
                        {i > 0 && <ArrowRight className="size-4 text-cafe-medio" strokeWidth={1.7} aria-hidden="true" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : !elegida.web ? (
              <p className="text-[14px] text-muted-foreground">
                No se puede comparar sin restaurarla primero. Si sigues, tu web pasa a estar como estaba el {cuando(elegida.fecha)}.
              </p>
            ) : cambios.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">Es igual que la que tienes publicada.</p>
            ) : (
              <ul className="divide-y divide-lino rounded-2xl border border-lino">
                {cambios.map((d) => (
                  <li key={d.campo} className="px-3.5 py-2.5">
                    <p className="text-[12.5px] font-bold text-cafe-medio">{d.etiqueta}</p>
                    <p className="mt-0.5 text-[13.5px]">
                      <span className="text-muted-foreground line-through decoration-cafe-suave">{d.antes}</span>
                      <span className="mx-1.5 text-cafe-medio">→</span>
                      <span className="font-semibold">{d.despues}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {!elegida && !completo && <LlegaConPlan funcion="historial-completo" compacta className="mt-4" />}
          </div>
          {elegida && (
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={() => setElegida(null)}>
                Volver
              </Button>
              {elegida.web && (
                <Button
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    onVer(elegida.web!);
                    setAbierto(false);
                    setElegida(null);
                  }}
                >
                  Ver cómo queda
                </Button>
              )}
              {puedeRestaurar && (
                <Button
                  className={cn(!elegida.web && "ml-auto")}
                  onClick={() => {
                    onRestaurar(elegida);
                    setAbierto(false);
                    setElegida(null);
                  }}
                >
                  Restaurar esta versión
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
