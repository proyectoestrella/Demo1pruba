import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Copy, EllipsisVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarSalon } from "@/components/AvatarSalon";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSalonStore } from "@/lib/store";
import { useEsDemo } from "@/lib/accesos-panel";
import {
  avisoDescartado,
  descartarAviso,
  esDemoDeVenta,
  esDispositivoTactil,
  estaInstalada,
  estadoInstalar,
  estadoInstalarServidor,
  iosSinSafari,
  lanzarInstalacionNativa,
  pedidoPorUrl,
  plataformaInstalar,
  suscribirInstalar,
  type Plataforma,
} from "@/lib/instalar-panel";

/** La tarjeta no entra con el primer pintado: llega cuando Hoy ya está quieto. */
const ESPERA_TARJETA_MS = 2_500;

const useInstalar = () => useSyncExternalStore(suscribirInstalar, estadoInstalar, estadoInstalarServidor);

/** Plataforma y montaje en cliente (en el servidor no hay navegador que mirar). */
function usePlataforma(): Plataforma | null {
  const { invitacion } = useInstalar();
  const [p, setP] = useState<Plataforma | null>(null);
  useEffect(() => setP(plataformaInstalar()), [invitacion]);
  return p;
}

/**
 * Tarjeta «Instalar» al final de Hoy (auditoría D1, 22-oct).
 *
 * Es la última tarjeta de la página, en el flujo: nunca fija, nunca encima del
 * contenido ni de la barra inferior, y no existe en Agenda. Sale solo si:
 * no está instalada; es un móvil/tablet o el navegador ofrece instalar; no es
 * una demo (salvo `?instalar=1`); y no se cerró en los últimos 30 días.
 * En Android sin `beforeinstallprompt` no sale: sin botón no hay tarjeta.
 */
export function AvisoInstalar() {
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const slug = useSalonStore((s) => s.realSalonSlug ?? s.salonProfile.slug);
  const esDemo = useEsDemo();
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const { invitacion, instalada } = useInstalar();
  const plataforma = usePlataforma();
  const [madura, setMadura] = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const [hoja, setHoja] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMadura(true), ESPERA_TARJETA_MS);
    return () => clearTimeout(t);
  }, []);

  if (!madura || !plataforma || cerrada || instalada || estaInstalada()) return null;
  const pedida = pedidoPorUrl(search);
  if (!pedida && (esDemo || esDemoDeVenta(search))) return null;
  if (avisoDescartado(slug)) return null;
  if (!esDispositivoTactil() && !invitacion) return null;
  if (plataforma !== "ios" && !invitacion) return null;

  const cerrar = () => {
    descartarAviso(slug);
    setCerrada(true);
  };

  return (
    <section
      aria-label="Instalar el panel"
      data-aviso-instalar
      className="tarjeta-secundaria flex items-center gap-3 bg-card px-[var(--relleno-tarjeta)] py-4 animate-in fade-in-0 duration-500"
    >
      <AvatarSalon size={40} className="shrink-0" />
      <p className="min-w-0 flex-1 text-sm leading-snug font-bold">Ten {salonName} en tu pantalla de inicio</p>
      <Button
        size="sm"
        className="shrink-0"
        onClick={async () => {
          if (plataforma === "ios") return setHoja(true);
          const r = await lanzarInstalacionNativa();
          if (r === "no-disponible") setHoja(true);
        }}
      >
        {plataforma === "ios" ? "Cómo" : "Instalar"}
      </Button>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar"
        className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-nata"
      >
        <X className="size-4" strokeWidth={1.8} />
      </button>
      <HojaInstalar
        abierta={hoja}
        alCerrar={() => setHoja(false)}
        salonName={salonName}
        plataforma={plataforma}
        conInvitacion={Boolean(invitacion)}
        instalada={false}
      />
    </section>
  );
}

/**
 * Fila fija en Ajustes › Accesos: siempre disponible, aunque se haya cerrado
 * la tarjeta y también en ordenador o en una demo. Solo desaparece si ya se
 * está usando instalada.
 */
export function FilaInstalar() {
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const { invitacion, instalada } = useInstalar();
  const plataforma = usePlataforma();
  const [hoja, setHoja] = useState(false);
  if (!plataforma) return null;
  const ya = instalada || estaInstalada();
  return (
    <div data-fila-instalar className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <Smartphone className="size-5 shrink-0 text-cafe-medio" strokeWidth={1.6} aria-hidden />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-sm font-bold">Instalar en este aparato</p>
        <p className="text-xs text-muted-foreground">
          {ya ? "Ya lo estás usando instalado." : "Como una app, desde la pantalla de inicio."}
        </p>
      </div>
      {!ya && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={async () => {
            if (plataforma !== "ios" && invitacion && (await lanzarInstalacionNativa()) !== "no-disponible") return;
            setHoja(true);
          }}
        >
          {plataforma === "ios" || !invitacion ? "Cómo" : "Instalar"}
        </Button>
      )}
      <HojaInstalar
        abierta={hoja}
        alCerrar={() => setHoja(false)}
        salonName={salonName}
        plataforma={plataforma}
        conInvitacion={Boolean(invitacion)}
        instalada={ya}
      />
    </div>
  );
}

function Paso({ n, icono, children }: { n: number; icono: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-nata text-cafe-medio" aria-hidden>
        {icono}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug">
        <span className="mr-1 font-bold text-muted-foreground tabular-nums">{n}.</span>
        {children}
      </span>
    </li>
  );
}

function HojaInstalar({
  abierta,
  alCerrar,
  salonName,
  plataforma,
  conInvitacion,
  instalada,
}: {
  abierta: boolean;
  alCerrar: () => void;
  salonName: string;
  plataforma: Plataforma;
  conInvitacion: boolean;
  instalada: boolean;
}) {
  const [mensaje, setMensaje] = useState("");
  useEffect(() => {
    if (abierta) setMensaje("");
  }, [abierta]);
  const icono = "size-5";
  return (
    <Sheet open={abierta} onOpenChange={(o) => !o && alCerrar()}>
      <SheetContent side="bottom" className="mx-auto max-h-[50dvh] max-w-lg overflow-y-auto rounded-t-3xl" data-hoja-instalar>
        <SheetHeader>
          <SheetTitle>Instalar {salonName}</SheetTitle>
          <SheetDescription>
            {instalada
              ? "Ya está instalado en este dispositivo."
              : "Queda en la pantalla de inicio y se abre como una app, sin la barra del navegador."}
          </SheetDescription>
        </SheetHeader>
        {!instalada && (
          <div className="space-y-4 pb-[var(--seguro-abajo)]">
            {plataforma === "ios" && iosSinSafari() ? (
              <>
                <p className="text-sm">
                  En iPhone, la instalación va desde <b>Safari</b>. Abre este enlace en Safari y sigue allí los pasos.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      setMensaje("Enlace copiado. Pégalo en Safari.");
                    } catch {
                      setMensaje("No se ha podido copiar: copia la dirección de la barra.");
                    }
                  }}
                >
                  <Copy className="size-4" /> Copiar enlace
                </Button>
                {mensaje && (
                  <p role="status" className="text-xs text-muted-foreground">
                    {mensaje}
                  </p>
                )}
              </>
            ) : plataforma === "ios" ? (
              <>
                <ol className="space-y-3">
                  <Paso n={1} icono={<Share className={icono} strokeWidth={1.7} />}>
                    Toca <b>Compartir</b>
                    <span className="block text-xs text-muted-foreground">
                      El cuadrado con la flecha. Si no lo ves, está en el menú «···».
                    </span>
                  </Paso>
                  <Paso n={2} icono={<SquarePlus className={icono} strokeWidth={1.7} />}>
                    Elige <b>Añadir a pantalla de inicio</b>
                  </Paso>
                  <Paso n={3} icono={<span className="text-[10.5px] font-bold">Añadir</span>}>
                    Pulsa <b>Añadir</b>, arriba a la derecha
                  </Paso>
                </ol>
                <p className="text-xs text-muted-foreground">
                  Al abrirlo desde el icono, entra con tu correo: es un acceso aparte del navegador.
                </p>
              </>
            ) : conInvitacion ? (
              <>
                <Button
                  className="w-full"
                  onClick={async () => {
                    const r = await lanzarInstalacionNativa();
                    if (r === "aceptada") alCerrar();
                    else if (r === "rechazada") setMensaje("No se ha instalado. Puedes probar otra vez cuando quieras.");
                    else setMensaje("Tu navegador no ha abierto la instalación. Usa su menú › Instalar aplicación.");
                  }}
                >
                  Instalar
                </Button>
                {mensaje && (
                  <p role="status" className="text-xs text-muted-foreground">
                    {mensaje}
                  </p>
                )}
              </>
            ) : plataforma === "escritorio" ? (
              <ol className="space-y-3">
                <Paso n={1} icono={<Smartphone className={icono} strokeWidth={1.7} />}>
                  En Chrome o Edge, busca el icono de <b>instalar</b> en la barra de direcciones
                </Paso>
                <Paso n={2} icono={<SquarePlus className={icono} strokeWidth={1.7} />}>
                  Pulsa <b>Instalar</b>
                </Paso>
              </ol>
            ) : (
              <ol className="space-y-3">
                <Paso n={1} icono={<EllipsisVertical className={icono} strokeWidth={1.7} />}>
                  Abre el <b>menú</b> del navegador
                </Paso>
                <Paso n={2} icono={<SquarePlus className={icono} strokeWidth={1.7} />}>
                  Toca <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>
                </Paso>
              </ol>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

