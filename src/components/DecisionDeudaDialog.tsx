import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeEuro, HandHeart, Ban } from "lucide-react";
import { estadoDeudaDe, useSalonStore, type EstadoDeuda } from "@/lib/store";
import { TEXTO_DESENLACE, type Desenlace } from "@/lib/deuda";
import { eur } from "@/lib/copy";
import type { Appointment, Client } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DecisionDeudaDialogProps {
  /** A quién se le anota (o no). Sin ficha no hay a quién cobrarle nada. */
  client: Client | null | undefined;
  /** La cita que salió mal, para poder escribir el motivo solo. */
  cita?: Appointment | null;
  /** Qué pasó: define el texto y el importe que se propone. */
  desenlace: Desenlace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Importe que se propone cuando el salón no tiene ninguno puesto en Ajustes. */
const IMPORTE_POR_DEFECTO = 5;

function fechaCorta(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

/**
 * Las tres decisiones de Adam cuando alguien le falla, en una sola pregunta:
 * se la anoto, se la perdono, o no vuelve a reservar hasta que pague.
 *
 * La de en medio —"déjasela anotada y se la cobro cuando vuelva"— es la que
 * Tomás subrayó, así que es la primera, la que lleva el foco y la única que
 * viene marcada como recomendada. Todas se pueden deshacer desde el aviso que
 * sale justo después.
 */
export function DecisionDeudaDialog({
  client,
  cita,
  desenlace,
  open,
  onOpenChange,
}: DecisionDeudaDialogProps) {
  const setDeuda = useSalonStore((s) => s.setDeuda);
  const importeSalon = useSalonStore((s) => s.salonProfile.noShowFeeEur ?? 0);
  /** Lo que ya debía de antes: una ficha guarda UNA deuda, así que se suman. */
  const deudaPrevia = client?.penaltyEur ?? 0;
  const sugerido =
    (importeSalon > 0 ? importeSalon : IMPORTE_POR_DEFECTO) + (deudaPrevia > 0 ? deudaPrevia : 0);
  const [importe, setImporte] = useState(String(sugerido));

  useEffect(() => {
    if (open) setImporte(String(sugerido));
  }, [open, sugerido]);

  if (!client) return null;

  const cuando = fechaCorta(cita?.start);
  const motivo =
    desenlace === "no-vino"
      ? `No vino${cuando ? ` el ${cuando}` : ""}`
      : `Llegó tarde sin avisar${cuando ? ` el ${cuando}` : ""}`;

  /** Aplica una decisión y deja el "Deshacer" cargado con lo que había antes. */
  function aplicar(estado: EstadoDeuda, mensaje: string, detalle: string) {
    if (!client) return;
    const previo = estadoDeudaDe(client);
    const id = client.id;
    setDeuda(id, estado);
    onOpenChange(false);
    toast.success(mensaje, {
      description: detalle,
      duration: 9000,
      action: {
        label: "Deshacer",
        onClick: () => {
          setDeuda(id, previo);
          toast.success("Deshecho", { description: `${client.name} vuelve a estar como estaba.` });
        },
      },
    });
  }

  const cantidad = Number(importe.replace(",", ".")) || 0;

  function anotar() {
    aplicar(
      {
        penaltyEur: cantidad,
        penaltyNote: motivo,
        penaltyAt: new Date().toISOString(),
        penaltyKeep: false,
        // Puede seguir reservando: lo que se quiere es cobrárselo cuando vuelva.
        penaltyBlock: false,
      },
      `Apuntado: ${client!.name} te debe ${eur(cantidad)}`,
      "Te lo recordaré el día que vuelva a venir.",
    );
  }

  function perdonar() {
    aplicar(
      { penaltyNote: `Perdonado el ${fechaCorta(new Date().toISOString())}` },
      `Perdonado a ${client!.name}`,
      "No se le anota nada.",
    );
  }

  function bloquear() {
    aplicar(
      {
        penaltyEur: cantidad,
        penaltyNote: motivo,
        penaltyAt: new Date().toISOString(),
        penaltyKeep: true,
        penaltyBlock: true,
      },
      `${client!.name} no puede volver a reservar`,
      `Hasta que te pague los ${eur(cantidad)}.`,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué hacemos con {client.name}?</DialogTitle>
          <DialogDescription>
            {TEXTO_DESENLACE[desenlace]}
            {cuando ? ` · cita del ${cuando}` : ""}. Tú decides: aquí no se cobra nada solo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="importe-deuda" className="text-xs font-medium text-muted-foreground">
            Cuánto le apuntas
          </label>
          {deudaPrevia > 0 && (
            <p className="text-xs text-muted-foreground">
              Ya te debía {eur(deudaPrevia)} de antes: el importe propuesto los suma.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input
              id="importe-deuda"
              inputMode="decimal"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              className="w-28 text-right tabular-nums"
            />
            <span className="text-sm text-muted-foreground">€</span>
          </div>
        </div>

        <div className="space-y-2">
          <Opcion
            icon={BadgeEuro}
            titulo={`Apúntaselo: me debe ${eur(cantidad)}`}
            detalle="Puede seguir reservando. Te lo recuerdo cuando vuelva, para que se lo cobres con el corte."
            recomendada
            disabled={cantidad <= 0}
            onClick={anotar}
          />
          <Opcion
            icon={HandHeart}
            titulo="Se lo perdono"
            detalle="No le queda nada pendiente. Queda anotado en su ficha que esta vez se lo perdonaste."
            onClick={perdonar}
          />
          <Opcion
            icon={Ban}
            titulo="Que no pueda reservar hasta que pague"
            detalle="Deja de poder pedir cita por la web. Puedes levantárselo cuando quieras desde su ficha."
            disabled={cantidad <= 0}
            tono="peligro"
            onClick={bloquear}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          siShow no cobra ni retiene nada: solo lo apunta y te lo recuerda cuando esa persona vuelva
          a tu silla.
        </p>

        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Ahora no
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Opcion({
  icon: Icon,
  titulo,
  detalle,
  onClick,
  recomendada,
  disabled,
  tono = "normal",
}: {
  icon: typeof BadgeEuro;
  titulo: string;
  detalle: string;
  onClick: () => void;
  recomendada?: boolean;
  disabled?: boolean;
  tono?: "normal" | "peligro";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50",
        recomendada
          ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
          : tono === "peligro"
            ? "border-destructive/30 hover:bg-destructive/5"
            : "border-border/60 hover:bg-muted/40",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          recomendada
            ? "text-primary"
            : tono === "peligro"
              ? "text-destructive"
              : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {titulo}
          {recomendada && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
              Lo más habitual
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{detalle}</span>
      </span>
    </button>
  );
}
