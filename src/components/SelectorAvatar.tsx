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

function TituloPaso({ numero, children, id }: { numero: number; children: string; id: string }) {
  return (
    <h3 id={id} className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-cafe">
      <span className="grid size-5 place-items-center rounded-full bg-beige text-[11px] text-moca-fuerte">
        {numero}
      </span>
      {children}
    </h3>
  );
}

/**
 * Editor de cuatro decisiones reconocibles: se ve el resultado primero y los
 * controles mantienen 44 px incluso en un móvil de 390 px.
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
  actual?: unknown;
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
  const usarSugerido = (sugerido: AvatarComposicion) => setBorrador({ ...sugerido });
  const usarAutomatico = () => {
    onElegir(null);
    onOpenChange(false);
  };
  const confirmar = () => {
    onElegir(elegirAvatar(borrador));
    onOpenChange(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-20px)] max-w-[620px] flex-col gap-0 overflow-hidden rounded-[20px] border-lino bg-card p-0 shadow-[0_24px_60px_rgba(59,47,42,.25)] sm:rounded-[20px]">
        <DialogHeader className="shrink-0 border-b border-lino px-4 pt-4 pb-3 text-left sm:px-5 sm:pt-5">
          <DialogTitle className="pr-8 text-[20px] font-extrabold text-cafe">
            Avatar de {nombre}
          </DialogTitle>
          <DialogDescription className="pr-8 text-[13px] text-cafe-suave">
            Elige lo que se reconoce a primera vista.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-lino bg-perla px-4 py-3 sm:px-5">
          <section className="flex items-center justify-center gap-4" aria-label="Vista previa">
            <img
              src={uriDeAvatar(clave)}
              alt={`Vista previa del avatar de ${nombre}`}
              draggable={false}
              className="size-28 rounded-full ring-2 ring-lino ring-offset-4 ring-offset-perla"
            />
            <div className="max-w-36">
              <p className="text-[15px] font-extrabold text-cafe">Así se verá</p>
              <p className="mt-1 text-[12px] leading-4 text-cafe-suave">
                Cambia al instante mientras eliges.
              </p>
            </div>
          </section>

          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-bold tracking-[.06em] text-cafe-suave uppercase">
              Sugeridos
            </p>
            <div className="grid grid-cols-6 gap-2" aria-label="Avatares sugeridos">
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
                      "relative grid min-h-11 min-w-11 place-items-center rounded-full border-2 p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <img
                      src={uriDeAvatar(claveSugerido)}
                      alt=""
                      draggable={false}
                      className="size-10 rounded-full"
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
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <section aria-labelledby="piel-avatar">
            <TituloPaso numero={1} id="piel-avatar">
              Piel
            </TituloPaso>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby="piel-avatar">
              {PIELES.map((piel) => {
                const activo = borrador.piel === piel.id;
                return (
                  <button
                    key={piel.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={piel.nombre}
                    title={piel.nombre}
                    onClick={() => cambiar("piel", piel.id)}
                    className={cn(
                      "relative grid size-11 place-items-center justify-self-center rounded-full border-2 p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <span
                      className="size-7 rounded-full border border-cafe/15"
                      style={{ backgroundColor: piel.color }}
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

          <section className="mt-5" aria-labelledby="peinado-avatar">
            <TituloPaso numero={2} id="peinado-avatar">
              Peinado
            </TituloPaso>
            <div
              className="grid grid-cols-4 gap-2 sm:grid-cols-8"
              role="radiogroup"
              aria-labelledby="peinado-avatar"
            >
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
                    onClick={() => cambiar("peinado", peinado.id)}
                    className={cn(
                      "relative flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl border-2 px-1 py-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <img
                      src={uriDeAvatar(clavePeinado)}
                      alt=""
                      draggable={false}
                      className="size-9 rounded-full"
                    />
                    <span className="mt-0.5 min-h-6 max-w-full text-center text-[10px] font-bold leading-3 text-balance text-cafe-medio">
                      {peinado.nombre}
                    </span>
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

          <section className="mt-5" aria-labelledby="color-pelo-avatar">
            <TituloPaso numero={3} id="color-pelo-avatar">
              Color de pelo
            </TituloPaso>
            <div
              className="grid grid-cols-5 gap-2"
              role="radiogroup"
              aria-labelledby="color-pelo-avatar"
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
                      "relative grid size-11 place-items-center justify-self-center rounded-full border-2 p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <span
                      className="size-7 rounded-full border border-cafe/15"
                      style={{ backgroundColor: color.color }}
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

          <section className="mt-5" aria-labelledby="edad-avatar">
            <TituloPaso numero={4} id="edad-avatar">
              Edad
            </TituloPaso>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="edad-avatar">
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
                      "min-h-11 rounded-xl border px-2 text-[13px] font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de fondo">
              {FONDOS_AVATAR.map((fondo) => {
                const activo = borrador.fondo === fondo.id;
                return (
                  <button
                    key={fondo.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={fondo.nombre}
                    title={fondo.nombre}
                    onClick={() => cambiar("fondo", fondo.id)}
                    className={cn(
                      "relative grid min-h-11 min-w-11 place-items-center rounded-full border-2 p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      activo ? "border-moca-fuerte bg-beige" : "border-transparent hover:bg-beige",
                    )}
                  >
                    <span
                      className="size-6 rounded-full border border-cafe/15"
                      style={{ backgroundColor: fondo.color }}
                    />
                    {activo && (
                      <Check
                        className="absolute size-3 text-cafe"
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-lino bg-perla px-3 py-3 sm:px-5">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full px-2 text-[12px] font-bold"
              onClick={aleatorio}
            >
              <Shuffle className="size-4" /> Aleatorio
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full px-2 text-[12px] font-bold leading-3"
              onClick={usarAutomatico}
            >
              Usar el automático
            </Button>
            <Button
              type="button"
              className="min-h-11 rounded-full px-2 text-[13px] font-bold"
              onClick={confirmar}
            >
              Listo
            </Button>
            {onSubirFoto && (
              <Button
                type="button"
                variant="outline"
                className="col-span-3 min-h-11 rounded-full font-bold"
                onClick={onSubirFoto}
              >
                Subir foto
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
