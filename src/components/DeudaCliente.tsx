import { toast } from "sonner";
import { BadgeEuro, Ban, HandHeart, Unlock } from "lucide-react";
import { estadoDeudaDe, useSalonStore, type EstadoDeuda } from "@/lib/store";
import { cobrosDeHoy, deudaDe, resumenDeDeuda } from "@/lib/deuda";
import { recargoActivo } from "@/lib/recargo-activo";
import { daysUntilPenaltyExpiry, penaltyExpiresAt } from "@/lib/plantones";
import { eur } from "@/lib/copy";
import type { Client } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function hoyCorto() {
  return new Date().toLocaleDateString("es", { day: "numeric", month: "short" });
}

/**
 * Las acciones sobre una deuda, con "Deshacer" siempre.
 *
 * Se usan desde tres sitios (inicio, detalle de cita y ficha del cliente) y
 * hacen todas lo mismo: guardan el estado anterior, escriben el nuevo y dejan
 * el toast cargado para volver atrás. Ninguna mueve dinero.
 */
function useAccionesDeuda() {
  const setDeuda = useSalonStore((s) => s.setDeuda);

  return function aplicar(client: Client, estado: EstadoDeuda, mensaje: string, detalle: string) {
    const previo = estadoDeudaDe(client);
    setDeuda(client.id, estado);
    toast.success(mensaje, {
      description: detalle,
      duration: 9000,
      action: {
        label: "Deshacer",
        onClick: () => {
          setDeuda(client.id, previo);
          toast.success("Deshecho", { description: `${client.name} vuelve a estar como estaba.` });
        },
      },
    });
  };
}

export interface BandaDeudaProps {
  client: Client | null | undefined;
  /** Versión corta, sin explicación del bloqueo — para el detalle de una cita. */
  compacta?: boolean;
  className?: string;
}

/**
 * "Marco te debe 7 €" con las tres salidas al lado: cobrada, perdonada o
 * dejarla anotada/bloquear. Es lo que Adam tiene que ver cuando el cliente
 * está delante, no escondido en una pestaña.
 */
export function BandaDeuda({ client, compacta, className }: BandaDeudaProps) {
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const aplicar = useAccionesDeuda();
  const deuda = deudaDe(client);
  if (!recargoActivo({ noShowFeeEur }) || !client || !deuda) return null;

  const caducaEl = penaltyExpiresAt(client);
  const dias = daysUntilPenaltyExpiry(client);

  function cobrar() {
    aplicar(
      client!,
      { penaltyNote: `Te la pagó el ${hoyCorto()}` },
      `Cobrado: ${eur(deuda!.eur)} de ${client!.name}`,
      "Ya no debe nada.",
    );
  }

  function perdonar() {
    aplicar(
      client!,
      { penaltyNote: `Perdonada el ${hoyCorto()}` },
      `Perdonado a ${client!.name}`,
      "Ya no debe nada.",
    );
  }

  function cambiarBloqueo() {
    const bloquear = !deuda!.bloquea;
    aplicar(
      client!,
      {
        penaltyEur: deuda!.eur,
        penaltyNote: deuda!.nota,
        penaltyAt: deuda!.desde ?? new Date().toISOString(),
        penaltyKeep: bloquear,
        penaltyBlock: bloquear,
      },
      bloquear ? `${client!.name} no puede reservar` : `${client!.name} puede volver a reservar`,
      bloquear
        ? "Seguirá bloqueado hasta que le quites el bloqueo o te pague."
        : "La deuda sigue anotada: se la cobras cuando venga.",
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BadgeEuro className="size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-display text-base leading-tight text-destructive">
              Te debe {eur(deuda.eur)}
            </p>
            {deuda.nota && <p className="text-xs text-muted-foreground">{deuda.nota}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={cobrar}>
            Ya me la ha pagado
          </Button>
          <Button size="sm" variant="outline" onClick={perdonar} className="gap-1.5">
            <HandHeart className="size-3.5" aria-hidden="true" />
            Perdonar
          </Button>
        </div>
      </div>

      {!compacta && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-destructive/20 pt-3">
          <p className="min-w-0 text-xs text-muted-foreground">
            {!deuda.bloquea
              ? "Puede seguir pidiendo cita: se la cobras cuando venga."
              : deuda.mantenido
                ? "No puede pedir cita por la web. El bloqueo lo mantienes tú."
                : caducaEl
                  ? `No puede pedir cita por la web hasta el ${caducaEl.toLocaleDateString("es", { day: "numeric", month: "long" })}${dias ? ` (${dias} ${dias === 1 ? "día" : "días"})` : ""}.`
                  : "No puede pedir cita por la web mientras deba esto."}
          </p>
          <Button size="sm" variant="outline" onClick={cambiarBloqueo} className="gap-1.5 shrink-0">
            {deuda.bloquea ? (
              <>
                <Unlock className="size-3.5" aria-hidden="true" />
                Déjale reservar
              </>
            ) : (
              <>
                <Ban className="size-3.5" aria-hidden="true" />
                Que no pueda reservar
              </>
            )}
          </Button>
        </div>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground">
        siShow solo lo apunta y te lo recuerda: el dinero lo cobras tú en el mostrador.
      </p>
    </div>
  );
}

/**
 * El aviso de la pantalla de inicio: quién te debe dinero y viene HOY.
 *
 * "El momento de cobrar es cuando lo tienes delante" — de ahí que esto vaya
 * arriba del todo y no dentro de ninguna pestaña. Si nadie de los que deben
 * viene hoy, se queda en una línea con el total pendiente.
 */
export function AvisoDeudasHoy() {
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const aplicar = useAccionesDeuda();

  const hoy = cobrosDeHoy(appointments, clients);
  const resumen = resumenDeDeuda(clients);
  if (!recargoActivo({ noShowFeeEur }) || resumen.personas === 0) return null;

  if (hoy.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm">
        <BadgeEuro className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          {resumen.personas === 1 ? "1 cliente te debe " : `${resumen.personas} clientes te deben `}
          <strong>{eur(resumen.eur)}</strong> de plantones. Ninguno tiene cita hoy.
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-destructive/40 bg-destructive/10">
      <div className="border-b border-destructive/20 px-4 py-3">
        <p className="font-display text-base text-destructive">
          Hoy viene {hoy.length === 1 ? "alguien que te debe dinero" : "gente que te debe dinero"}
        </p>
        <p className="text-xs text-muted-foreground">
          Acuérdate de cobrárselo con el corte. siShow no lo cobra por su cuenta.
        </p>
      </div>
      <div className="divide-y divide-destructive/15">
        {hoy.map(({ client, cita, eur: importe }) => (
          <div key={client.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-12 shrink-0 tabular-nums text-sm text-muted-foreground">
              {new Date(cita.start).toLocaleTimeString("es", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{client.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                Te debe {eur(importe)}
                {client.penaltyNote ? ` · ${client.penaltyNote}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                onClick={() =>
                  aplicar(
                    client,
                    { penaltyNote: `Te la pagó el ${hoyCorto()}` },
                    `Cobrado: ${eur(importe)} de ${client.name}`,
                    "Ya no debe nada.",
                  )
                }
              >
                Ya me la ha pagado
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  aplicar(
                    client,
                    { penaltyNote: `Perdonada el ${hoyCorto()}` },
                    `Perdonado a ${client.name}`,
                    "Ya no debe nada.",
                  )
                }
              >
                Perdonar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
