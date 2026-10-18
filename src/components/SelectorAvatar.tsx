import { useEffect, useMemo, useState } from "react";
import { Check, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  avatarIdDeElegido,
  avatarPorDefecto,
  elegirAvatar,
  type AvatarElegido,
} from "@/lib/avatar";
import {
  COLORES_PELO,
  EDADES,
  FONDOS_AVATAR,
  PEINADOS,
  PIELES,
  SUGERIDOS_AVATAR,
  composicionDeAvatar,
  serializarAvatar,
  uriDeAvatar,
  type AvatarComposicion,
} from "@/lib/avatar-svg";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function composicionInicial(actual: unknown, id: string): AvatarComposicion {
  const actualResuelto = composicionDeAvatar(avatarIdDeElegido(actual));
  const automatico = composicionDeAvatar(avatarPorDefecto(id));
  return actualResuelto ?? automatico ?? SUGERIDOS_AVATAR[0];
}

function alAzar<T>(opciones: readonly T[]): T {
  return opciones[Math.floor(Math.random() * opciones.length)]!;
}

/**
 * Un editor contenido: se ve una persona grande primero y los cuatro grupos
 * corresponden exactamente a lo que una persona puede reconocer de un retrato.
 * El tono de pelo acompaña al peinado, así que no añade un quinto bloque visual.
 */
export function SelectorAvatar({
  abierto,
  onOpenChange,
  nombre,
  id,
  actual,
  onElegir,
  onSubirFoto,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  nombre: string;
  id: string;
  /** Lo que tiene guardado ahora (o nada: usa el automático). */
  actual?: unknown;
  /** `null` = quitar la elección y volver al avatar automático. */
  onElegir: (avatar: AvatarElegido | null) => void;
  onSubirFoto?: () => void;
}) {
  const [borrador, setBorrador] = useState<AvatarComposicion>(() => composicionInicial(actual, id));

  useEffect(() => {
    if (abierto) setBorrador(composicionInicial(actual, id));
  }, [abierto, actual, id]);

  const clave = useMemo(() => serializarAvatar(borrador), [borrador]);
  const cambiar = <K extends keyof AvatarComposicion>(campo: K, valor: AvatarComposicion[K]) => {
    setBorrador((anterior) => ({ ...anterior, [campo]: valor }));
  };
  const aleatorio = () => {
    setBorrador({
      piel: alAzar(PIELES).id,
      peinado: alAzar(PEINADOS).id,
      edad: alAzar(EDADES).id,
      colorPelo: alAzar(COLORES_PELO).id,
      fondo: alAzar(FONDOS_AVATAR).id,
    });
  };
  const usarSugerido = (sugerido: AvatarComposicion) =>
    setBorrador({
      piel: sugerido.piel,
      peinado: sugerido.peinado,
      edad: sugerido.edad,
      colorPelo: sugerido.colorPelo,
      fondo: sugerido.fondo,
    });

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-24px)] max-w-xl flex-col gap-0 overflow-hidden rounded-[20px] border-lino bg-card p-0 shadow-[0_24px_60px_rgba(59,47,42,.25)] sm:rounded-[20px]">
        <DialogHeader className="border-b border-lino px-5 pt-5 pb-3 text-left">
          <DialogTitle className="pr-8 text-[20px] font-extrabold text-cafe">
            Avatar de {nombre}
          </DialogTitle>
          <DialogDescription className="pr-8 text-[13px] text-cafe-suave">
            Ajusta cuatro detalles o parte de una sugerencia.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <section className="mb-5 flex flex-col items-center" aria-label="Vista previa">
            <img
              src={uriDeAvatar(clave)}
              alt={`Vista previa del avatar de ${nombre}`}
              draggable={false}
              className="size-28 rounded-full ring-2 ring-lino ring-offset-4 ring-offset-card"
            />
            <p className="mt-3 text-[13px] font-bold text-cafe">Así se verá {nombre}</p>
          </section>

          <section aria-labelledby="sugeridos-avatar">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3
                id="sugeridos-avatar"
                className="text-[11px] font-bold tracking-[.06em] text-cafe-suave uppercase"
              >
                Sugeridos
              </h3>
              <span className="text-[12px] text-cafe-suave">Elige uno en un toque</span>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {SUGERIDOS_AVATAR.map((sugerido) => {
                const claveSugerido = serializarAvatar(sugerido);
                const activo = clave === claveSugerido;
                return (
                  <button
                    key={sugerido.id}
                    type="button"
                    aria-label={`Sugerido: ${sugerido.nombre}`}
                    aria-pressed={activo}
                    onClick={() => usarSugerido(sugerido)}
                    className={cn(
                      "relative grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border-2 p-0.5 transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <img
                      src={uriDeAvatar(claveSugerido)}
                      alt=""
                      draggable={false}
                      className="size-full rounded-full"
                    />
                    {activo && (
                      <span
                        className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-moca-fuerte text-white"
                        aria-hidden="true"
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="my-5 border-t border-lino" />

          <section aria-labelledby="piel-avatar">
            <h3
              id="piel-avatar"
              className="mb-2 text-[11px] font-bold tracking-[.06em] text-cafe-suave uppercase"
            >
              Piel
            </h3>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Tono de piel">
              {PIELES.map((piel) => {
                const activo = borrador.piel === piel.id;
                return (
                  <button
                    key={piel.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={piel.nombre}
                    onClick={() => cambiar("piel", piel.id)}
                    className={cn(
                      "grid min-h-11 cursor-pointer place-items-center rounded-xl border-2 p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <span
                      className="size-7 rounded-full border border-cafe/15"
                      style={{ backgroundColor: piel.color }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5" aria-labelledby="peinado-avatar">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3
                id="peinado-avatar"
                className="text-[11px] font-bold tracking-[.06em] text-cafe-suave uppercase"
              >
                Peinado
              </h3>
              <span className="text-[12px] text-cafe-suave">y tono</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Peinado">
              {PEINADOS.map((peinado) => {
                const activo = borrador.peinado === peinado.id;
                const clavePeinado = serializarAvatar({ ...borrador, peinado: peinado.id });
                return (
                  <button
                    key={peinado.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={peinado.nombre}
                    title={peinado.nombre}
                    onClick={() => cambiar("peinado", peinado.id)}
                    className={cn(
                      "relative grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl border-2 p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <img
                      src={uriDeAvatar(clavePeinado)}
                      alt=""
                      draggable={false}
                      className="size-9 rounded-full"
                    />
                  </button>
                );
              })}
            </div>
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label="Color de pelo"
            >
              {COLORES_PELO.map((color) => {
                const activo = borrador.colorPelo === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={color.nombre}
                    title={color.nombre}
                    onClick={() => cambiar("colorPelo", color.id)}
                    className={cn(
                      "grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border-2 p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <span
                      className="size-6 rounded-full border border-cafe/15"
                      style={{ backgroundColor: color.color }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5" aria-labelledby="edad-avatar">
            <h3
              id="edad-avatar"
              className="mb-2 text-[11px] font-bold tracking-[.06em] text-cafe-suave uppercase"
            >
              Edad
            </h3>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Edad">
              {EDADES.map((edad) => {
                const activo = borrador.edad === edad.id;
                return (
                  <button
                    key={edad.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => cambiar("edad", edad.id)}
                    className={cn(
                      "min-h-11 cursor-pointer rounded-xl border px-2 text-[13px] font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo
                        ? "border-moca-fuerte bg-beige text-cafe"
                        : "border-lino-fuerte bg-card text-cafe-medio hover:bg-nata",
                    )}
                  >
                    {edad.nombre}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5" aria-labelledby="fondo-avatar">
            <h3
              id="fondo-avatar"
              className="mb-2 text-[11px] font-bold tracking-[.06em] text-cafe-suave uppercase"
            >
              Fondo
            </h3>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Color de fondo">
              {FONDOS_AVATAR.map((fondo) => {
                const activo = borrador.fondo === fondo.id;
                return (
                  <button
                    key={fondo.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={fondo.nombre}
                    onClick={() => cambiar("fondo", fondo.id)}
                    className={cn(
                      "grid min-h-11 cursor-pointer place-items-center rounded-xl border-2 p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <span
                      className="size-7 rounded-full border border-cafe/15"
                      style={{ backgroundColor: fondo.color }}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-lino bg-perla px-5 py-3">
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full px-3 font-bold"
              onClick={aleatorio}
            >
              <Shuffle className="size-4" />
              Aleatorio
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full px-3 font-bold"
              onClick={() => {
                onElegir(null);
                onOpenChange(false);
              }}
            >
              Usar el automático
            </Button>
          </div>
          <div className="flex gap-2">
            {onSubirFoto && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full font-bold"
                onClick={onSubirFoto}
              >
                Subir foto
              </Button>
            )}
            <Button
              type="button"
              className="min-h-11 rounded-full font-bold"
              onClick={() => {
                onElegir(elegirAvatar(borrador));
                onOpenChange(false);
              }}
            >
              Listo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
