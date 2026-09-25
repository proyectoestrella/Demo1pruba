import { useState } from "react";
import { ArrowRight, ChevronDown, History } from "lucide-react";
import { diferenciasWeb, useVersiones, type VersionWeb, type WebPublicada } from "@/lib/versiones-maqueta";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const SIN_VERSIONES: VersionWeb[] = [];
const cuando = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "").replace(",", ",");

/**
 * Mi página › versiones publicadas (lote 12): cuál está publicada, las
 * anteriores con fecha y quién, y al elegir una, lo que cambia frente a la
 * actual antes de hacer nada. «Ver cómo queda» la carga en la vista previa
 * (sin publicar); «Restaurar esta versión» la publica como una versión nueva.
 */
export function VersionesWeb({
  slug,
  actual,
  puedeRestaurar,
  onVer,
  onRestaurar,
}: {
  slug: string;
  actual: WebPublicada;
  puedeRestaurar: boolean;
  onVer: (web: WebPublicada) => void;
  onRestaurar: (web: WebPublicada) => void;
}) {
  const versiones = useVersiones((s) => s.porSalon[slug]) ?? SIN_VERSIONES;
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<VersionWeb | null>(null);
  const publicada = versiones[0];
  const cambios = elegida ? diferenciasWeb(actual, elegida.web) : [];

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
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="text-base font-extrabold">{elegida ? `Comparar con la del ${cuando(elegida.fecha)}` : "Versiones publicadas"}</SheetTitle>
            <SheetDescription>{elegida ? "Así cambiaría tu web si vuelves a esta versión." : `Las ${versiones.length} últimas publicaciones (se guardan 20).`}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {!elegida ? (
              versiones.length === 0 ? (
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
          </div>
          {elegida && (
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={() => setElegida(null)}>
                Volver
              </Button>
              <Button
                variant="outline"
                className="ml-auto"
                onClick={() => {
                  onVer(elegida.web);
                  setAbierto(false);
                  setElegida(null);
                }}
              >
                Ver cómo queda
              </Button>
              {puedeRestaurar && (
                <Button
                  onClick={() => {
                    onRestaurar(elegida.web);
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
