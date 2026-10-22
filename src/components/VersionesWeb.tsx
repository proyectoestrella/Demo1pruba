import { useTienePlan } from "@/lib/accesos-panel";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, History, Loader2, Lock } from "lucide-react";
import { cargarVersionReal, diferenciasWeb, useVersionesPanel, type VersionPanel, type WebPublicada } from "@/lib/versiones-panel";
import { VERSIONES_WEB_SIEMPRE, versionRestaurable } from "@/lib/resumen-perfil";
import { agruparPorDia } from "@/lib/historial-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const cuando = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const diaLargo = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  const t = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Lo que es cada versión, en palabras de la dueña. */
function queEs(v: VersionPanel, i: number, esReal: boolean): string {
  if (i === 0) return "Así está tu página ahora";
  const n = v.nota ?? "";
  if (/^Restaurada/i.test(n)) return "Vuelta a una versión anterior";
  if (/^Antes de/i.test(n)) return "Cómo estaba antes de unos cambios";
  // La demo guarda, en su primera publicación, cómo estaba antes (sin autora).
  if (!esReal && !v.autorNombre && !n) return "Cómo estaba al empezar";
  return "Publicada";
}

/**
 * Mi página › Versiones (22-oct): cada vez que se publica queda una copia
 * entera de la página. Se elige una, se ve qué cambiaría frente a la de ahora
 * (también en un salón real: `verVersion` baja su contenido al elegirla), se
 * puede «Ver cómo queda» en la vista previa sin publicar, y «Volver a esta
 * versión» pide confirmación. Volver también es deshacible: deja su propia
 * versión y su fila en el Historial.
 *
 * Plan: las {@link VERSIONES_WEB_SIEMPRE} últimas se recuperan con cualquier
 * plan; más atrás hace falta el historial completo, y se dice en la fila.
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
  const completo = useTienePlan("historial-completo");
  const { versiones, cargando, error, recargar } = useVersionesPanel(slug, esReal, completo);
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<VersionPanel | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [contenido, setContenido] = useState<{ web: WebPublicada | null; restaurable: boolean; cargando: boolean; error: string | null }>({ web: null, restaurable: true, cargando: false, error: null });
  const publicada = versiones[0];
  const posicion = elegida ? versiones.findIndex((v) => v.id === elegida.id) : -1;

  // Salón real: el contenido de la versión se pide al elegirla.
  useEffect(() => {
    setConfirmando(false);
    if (!elegida) return;
    if (elegida.web || !esReal) {
      setContenido({ web: elegida.web, restaurable: !esReal || versionRestaurable(posicion, completo), cargando: false, error: null });
      return;
    }
    let cancelado = false;
    setContenido({ web: null, restaurable: true, cargando: true, error: null });
    cargarVersionReal(slug, elegida.id)
      .then((r) => {
        if (cancelado) return;
        setContenido(r.ok ? { web: r.web, restaurable: r.restaurable, cargando: false, error: null } : { web: null, restaurable: false, cargando: false, error: r.motivo });
      })
      .catch(() => {
        if (!cancelado) setContenido({ web: null, restaurable: true, cargando: false, error: "No se ha podido abrir esta versión. Comprueba la conexión." });
      });
    return () => {
      cancelado = true;
    };
  }, [elegida, esReal, slug, posicion, completo]);

  const web = contenido.web;
  const cambios = web ? diferenciasWeb(actual, web) : [];
  const cerrar = () => {
    setAbierto(false);
    setElegida(null);
  };
  const porDia = agruparPorDia(versiones, diaLargo);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex h-[42px] items-center gap-2 rounded-full border border-input bg-card px-3.5 text-[13px] font-bold text-cafe-medio hover:bg-nata"
        data-testid="abrir-versiones"
      >
        <History className="size-4" strokeWidth={1.7} aria-hidden="true" />
        Versiones
        {publicada && <span className="font-normal max-sm:hidden">· última del {cuando(publicada.fecha)}</span>}
        <ChevronDown className="size-4" strokeWidth={1.7} aria-hidden="true" />
      </button>
      <Sheet
        open={abierto}
        onOpenChange={(o) => {
          setAbierto(o);
          if (!o) setElegida(null);
          // Salón real: recarga la lista al abrir, por si otra persona del
          // equipo ha publicado o restaurado desde que se cargó esta pantalla.
          else if (esReal) recargar();
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="text-base font-extrabold">{elegida ? `Versión del ${cuando(elegida.fecha)}` : "Versiones de tu página"}</SheetTitle>
            <SheetDescription>
              {elegida
                ? "Esto es lo que cambiaría en tu web si vuelves a esta versión."
                : "Cada vez que publicas se guarda una copia entera de tu página. Si algo no te gusta, puedes volver a cualquiera de estas."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" data-testid="lista-versiones">
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
                <div className="rounded-2xl border border-dashed border-lino px-4 py-6 text-center text-[14px] text-muted-foreground">
                  <p className="font-bold text-foreground">Aún no hay versiones guardadas</p>
                  <p className="mt-1">Cuando publiques un cambio en tu página, aquí aparecerá una copia con la fecha y quién lo hizo, para poder volver a ella si hace falta.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {porDia.map(([dia, lista]) => (
                    <section key={dia}>
                      <h4 className="px-1 pb-1.5 text-[13px] font-bold text-cafe-medio">{dia}</h4>
                      <ul className="space-y-1.5">
                        {lista.map((v) => {
                          const i = versiones.indexOf(v);
                          const bloqueada = esReal && !versionRestaurable(i, completo);
                          return (
                            <li key={v.id}>
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={() => setElegida(v)}
                                data-testid="fila-version"
                                className={cn("flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left", i === 0 ? "border-salvia bg-salvia-suave" : "border-lino hover:bg-beige/60")}
                              >
                                <span className={cn("size-2.5 shrink-0 rounded-full", i === 0 ? "bg-hoja" : "border border-cafe-suave")} aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                  <b className="block text-[14px]">
                                    <span className="tabular-nums">{hora(v.fecha)}</span> · {queEs(v, i, esReal)}
                                  </b>
                                  <span className="block text-[12.5px] text-muted-foreground">{v.autorNombre ? `Por ${v.autorNombre}` : esReal ? "Sin nombre" : "Desde esta demo"}</span>
                                </span>
                                {bloqueada ? (
                                  <Lock className="size-4 text-cafe-medio" strokeWidth={1.7} aria-label="Necesita el historial completo" />
                                ) : (
                                  i > 0 && <ArrowRight className="size-4 text-cafe-medio" strokeWidth={1.7} aria-hidden="true" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                  {!completo && esReal && (
                    <p className="text-[12.5px] text-muted-foreground">
                      Con tu plan puedes volver a las {VERSIONES_WEB_SIEMPRE} últimas versiones de tu página. Con el historial completo, a todas las de los últimos 90 días.
                    </p>
                  )}
                </div>
              )
            ) : contenido.cargando ? (
              <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Abriendo esta versión…
              </p>
            ) : contenido.error ? (
              <p className="text-[14px] text-muted-foreground">{contenido.error}</p>
            ) : !web ? (
              <p className="text-[14px] text-muted-foreground">No se puede enseñar el contenido de esta versión.</p>
            ) : cambios.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">Es igual que la que tienes publicada: volver a ella no cambiaría nada.</p>
            ) : (
              <ul className="divide-y divide-lino rounded-2xl border border-lino" data-testid="diferencias-version">
                {cambios.map((d) => (
                  <li key={d.campo} className="px-3.5 py-2.5">
                    <p className="text-[12.5px] font-bold text-cafe-medio">{d.etiqueta}</p>
                    <p className="mt-0.5 break-words text-[13.5px]">
                      <span className="text-muted-foreground">Ahora: </span>
                      <span>{d.antes}</span>
                    </p>
                    <p className="break-words text-[13.5px]">
                      <span className="text-muted-foreground">Volvería a: </span>
                      <span className="font-semibold">{d.despues}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {elegida && !contenido.cargando && !contenido.restaurable && !contenido.error && (
              <div className="mt-4 space-y-2">
                <p className="text-[13px] text-cafe-medio">Esta versión es más antigua que las {VERSIONES_WEB_SIEMPRE} últimas. Puedes verla, pero para volver a ella hace falta el historial completo.</p>
                <LlegaConPlan funcion="historial-completo" compacta />
              </div>
            )}
            {elegida && !puedeRestaurar && <p className="mt-4 text-[13px] text-cafe-medio">Puedes ver esta versión, pero volver a ella lo hace quien gestiona la página del salón.</p>}
            {elegida && confirmando && (
              <div role="alertdialog" aria-label="Confirmar volver a esta versión" className="mt-4 rounded-xl border border-lino bg-arena px-3 py-2.5 text-[13.5px]" data-testid="confirmar-version">
                <p className="font-bold">¿Volver a la versión del {cuando(elegida.fecha)}?</p>
                <p className="text-cafe-medio">
                  {esReal ? "Tu web pública cambia al momento." : "Se aplica en esta demo."} No se pierde nada: la versión de ahora queda guardada aquí y puedes volver a ella, o deshacerlo desde el Historial.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="h-9 rounded-full px-4 font-bold"
                    data-testid="confirmar-version-si"
                    onClick={() => {
                      onRestaurar(web && !elegida.web ? { ...elegida, web } : elegida);
                      cerrar();
                    }}
                  >
                    Sí, volver a esta versión
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 rounded-full px-4" onClick={() => setConfirmando(false)}>
                    No, dejarlo
                  </Button>
                </div>
              </div>
            )}
          </div>
          {elegida && (
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={() => setElegida(null)}>
                Volver a la lista
              </Button>
              {web && cambios.length > 0 && (
                <Button
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    onVer(web);
                    cerrar();
                  }}
                >
                  Ver cómo queda
                </Button>
              )}
              {puedeRestaurar && contenido.restaurable && !contenido.cargando && !contenido.error && cambios.length > 0 && !confirmando && (
                <Button data-testid="volver-a-version" onClick={() => setConfirmando(true)}>
                  Volver a esta versión
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
