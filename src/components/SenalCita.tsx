import { marcarAvisoDeCita } from "@/lib/deshacer-maqueta";
import { useState } from "react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { enlaceDeFianza } from "@/lib/avisos";
import { eur, hora } from "@/lib/copy";
import {
  estadoSenal,
  importeSenal,
  mensajeErrorSenal,
  prepararPeticionSenal,
  reglaSenal,
  type CodigoErrorSenal,
  type EstadoSenal,
} from "@/lib/senal";
import type { Appointment, MetodoSenal } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * La señal de una cita (lote 9j, Método A): su estado en el ciclo y lo que la
 * dueña puede hacer. «Pedir» abre WhatsApp con el mensaje escrito y solo marca
 * «pedida» si ella confirma que lo envió: abrir WhatsApp no es enviar.
 * «Recibida» la marca ella al ver el Bizum en su banco: siShow no toca dinero.
 * Contra `src/lib/senal.ts` (BACKEND, contrato en `docs/contrato-senal.md`).
 */
const ETIQUETA: Record<EstadoSenal, { texto: string; clase: string }> = {
  no_aplica: { texto: "Sin señal", clase: "bg-nata text-cafe-medio" },
  por_pedir: { texto: "Por pedir", clase: "border-[1.5px] border-dashed border-moca bg-card text-primary" },
  pedida: { texto: "Pedida", clase: "bg-miel text-cafe" },
  vencida: { texto: "Vencida", clase: "bg-melocoton text-melocoton-tinta" },
  recibida: { texto: "Recibida", clase: "border border-salvia bg-salvia-suave text-hoja-tinta" },
  aplicada: { texto: "Descontada al cobrar", clase: "bg-salvia-clara text-hoja-tinta" },
  devuelta: { texto: "A devolver", clase: "bg-nata text-cafe-medio" },
  retenida: { texto: "Retenida", clase: "bg-nata text-cafe-medio" },
  anulada: { texto: "Anulada", clase: "bg-nata text-muted-foreground" },
};

const METODOS: { id: MetodoSenal; texto: string }[] = [
  { id: "bizum", texto: "Bizum" },
  { id: "efectivo", texto: "Efectivo" },
  { id: "tarjeta", texto: "Tarjeta" },
  { id: "transferencia", texto: "Transferencia" },
];

const ESTADOS_ABIERTOS = new Set(["pending", "confirmed"]);
const MENSAJE_CITA_CERRADA = "La cita ya ha pasado o está cancelada: la señal ya no se pide.";

/** ¿Está la cita cerrada para pedir señal? (misma regla que `pedirSenal` del dominio: abierta y futura). */
export function citaCerradaParaSenal(cita: Pick<Appointment, "status" | "start">, ahora: Date): boolean {
  return !ESTADOS_ABIERTOS.has(cita.status) || Date.parse(cita.start) <= ahora.getTime();
}

export function SenalCita({ cita, compacta = false }: { cita: Appointment; compacta?: boolean }) {
  const perfil = useSalonStore((s) => s.salonProfile);
  const clients = useSalonStore((s) => s.clients);
  const markDepositRequested = useSalonStore((s) => s.markDepositRequested);
  const recibirSenal = useSalonStore((s) => s.recibirSenal);
  const deshacerSenalRecibida = useSalonStore((s) => s.deshacerSenalRecibida);
  const darMasTiempoSenal = useSalonStore((s) => s.darMasTiempoSenal);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const regla = reglaSenal(perfil);
  const estado = estadoSenal(cita, new Date());
  const [preguntaEnvio, setPreguntaEnvio] = useState<{ importeEur: number; requestedAtISO: string } | null>(null);
  const [recibiendo, setRecibiendo] = useState(false);
  const [importe, setImporte] = useState(String(cita.depositEur ?? ""));
  const [metodo, setMetodo] = useState<MetodoSenal>("bizum");

  if (estado === "no_aplica" && !regla.bizumTelefono) return null;

  // Lote 16: «Pedir señal» solo en una cita que aún puede pedirla (futura y
  // no cancelada ni cerrada). Antes el botón miraba solo el estado de la
  // señal y salía también en citas pasadas, donde el dominio (bien) decía
  // «La cita ya ha pasado o está cancelada».
  const cerrada = citaCerradaParaSenal(cita, new Date());

  // Lote 12: el aviso de lo hecho (con «Deshacer») lo pone el registro de cambios; aquí solo los errores.
  const resultado = (error: CodigoErrorSenal | null) => (error ? toast.error(mensajeErrorSenal(error)) : undefined);

  function pedir() {
    const importeDeEstaCita =
      cita.depositEur && cita.depositEur > 0
        ? cita.depositEur
        : importeSenal(regla, { serviceIds: cita.serviceIds, durationMin: cita.duration, priceEur: cita.priceEur }) || regla.importeFijoEur;
    const telefono = clients.find((c) => c.id === cita.clientId)?.phone;
    if (!telefono) return toast.error("Esta clienta no tiene teléfono al que escribir.");
    const requestedAt = new Date().toISOString();
    const preparada = prepararPeticionSenal(cita, regla, importeDeEstaCita, new Date(requestedAt));
    if (!preparada.ok) return toast.error(mensajeErrorSenal(preparada.error));
    const url = enlaceDeFianza(
      telefono,
      {
        clientName: cita.clientName,
        startISO: cita.start,
        salonName: perfil.name,
        bizumPhone: regla.bizumTelefono,
        importeEur: preparada.importeEur,
        deadlineISO: preparada.venceISO,
        plantilla: regla.plantilla,
      },
      requestedAt,
    );
    window.open(url, "_blank", "noopener,noreferrer");
    setPreguntaEnvio({ importeEur: preparada.importeEur, requestedAtISO: requestedAt });
  }

  const etiqueta = ETIQUETA[estado];
  const vence = cita.depositDueAt ? `antes de las ${hora(cita.depositDueAt)}${new Date(cita.depositDueAt).toDateString() === new Date().toDateString() ? "" : ` del ${new Date(cita.depositDueAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}` : "";
  const detalle: Partial<Record<EstadoSenal, string>> = {
    no_aplica: "Tu regla no la pide para esta cita. Puedes pedirla igualmente.",
    por_pedir: `Tu regla pide una señal de ${eur(cita.depositEur ?? importeSenal(regla, { serviceIds: cita.serviceIds, durationMin: cita.duration, priceEur: cita.priceEur }))}.`,
    // 14a: lo mismo que dice Ajustes › Señal (recordatorio a 1 h desde Hoy y liberación al vencer).
    pedida: `${eur(cita.depositEur ?? 0)} ${vence}. Márcala cuando la veas en tu banco. ${regla.liberacionAutomatica ? "Si no llega a tiempo, el hueco se libera solo; a 1 h de vencer, en Hoy › Avisos puedes recordárselo." : "Si no llega a tiempo, te avisamos en Hoy y decides tú."}`,
    vencida: `Pasó el plazo sin recibir ${eur(cita.depositEur ?? 0)}. Tú decides: más tiempo o liberar el hueco.`,
    recibida: `${eur(cita.depositReceivedEur ?? cita.depositEur ?? 0)} por ${METODOS.find((m) => m.id === cita.depositMethod)?.texto.toLowerCase() ?? "bizum"}. Se descuenta sola al cobrar.`,
  };
  const btn = "h-8 rounded-full px-3 text-[12.5px]";

  return (
    <div className={cn("space-y-2.5 rounded-2xl border border-lino bg-card", compacta ? "px-3 py-2.5" : "p-3.5")}>
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px]">Señal</b>
        <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-bold", etiqueta.clase)}>{etiqueta.texto}</span>
      </div>
      {detalle[estado] && !(cerrada && (estado === "no_aplica" || estado === "por_pedir")) && <p className="text-[12.5px] leading-snug text-cafe-medio">{detalle[estado]}</p>}

      {preguntaEnvio ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-miel px-3 py-2 text-[13px]">
          <span className="font-bold">¿Has enviado el WhatsApp?</span>
          <Button
            size="sm"
            className={btn}
            onClick={() => {
              markDepositRequested(cita.id, preguntaEnvio.importeEur, preguntaEnvio.requestedAtISO);
              // Ya le ha escrito por WhatsApp: si se deshace, se le avisa de nuevo.
              marcarAvisoDeCita(cita.id);
              setPreguntaEnvio(null);
            }}
          >
            Sí, enviado
          </Button>
          <Button size="sm" variant="ghost" className={btn} onClick={() => setPreguntaEnvio(null)}>
            No, todavía no
          </Button>
        </div>
      ) : recibiendo ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[12px] font-bold text-cafe">
            Importe (€)
            <input value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" className="h-9 w-24 rounded-xl border border-input bg-blanco px-2.5 text-[13px] tabular-nums" />
          </label>
          <label className="grid gap-1 text-[12px] font-bold text-cafe">
            Cómo llegó
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoSenal)} className="h-9 rounded-xl border border-input bg-blanco px-2.5 text-[13px]">
              {METODOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.texto}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            className={btn}
            onClick={() => {
              const n = Number(importe.replace(",", "."));
              resultado(recibirSenal(cita.id, { metodo, importeEur: Number.isFinite(n) && importe.trim() ? n : undefined }));
              setRecibiendo(false);
            }}
          >
            Guardar
          </Button>
          <Button size="sm" variant="ghost" className={btn} onClick={() => setRecibiendo(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {cerrada && (estado === "no_aplica" || estado === "por_pedir") && (
            <p className="text-[12.5px] text-muted-foreground">{MENSAJE_CITA_CERRADA}</p>
          )}
          {!cerrada && (estado === "no_aplica" || estado === "por_pedir") && (
            <Button size="sm" variant={estado === "por_pedir" ? "default" : "outline"} className={btn} onClick={pedir}>
              {estado === "no_aplica" ? "Pedir señal igualmente" : "Pedir señal por WhatsApp"}
            </Button>
          )}
          {(estado === "pedida" || estado === "vencida") && (
            <>
              <Button size="sm" variant="secondary" className={btn} onClick={() => setRecibiendo(true)}>
                Recibida
              </Button>
              <Button size="sm" variant="outline" className={btn} onClick={() => resultado(darMasTiempoSenal(cita.id))}>
                Dar más tiempo
              </Button>
              {!cerrada && (
                <Button size="sm" variant="ghost" className={btn} onClick={pedir}>
                  Volver a pedir
                </Button>
              )}
            </>
          )}
          {estado === "vencida" && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(btn, "text-melocoton-tinta hover:bg-melocoton")}
              onClick={() => {
                if (!window.confirm(`¿Liberar el hueco de ${cita.clientName}? La cita se cancela y la señal se anula.`)) return;
                cancelAppointment(cita.id, { porSalon: true });
              }}
            >
              Liberar el hueco
            </Button>
          )}
          {estado === "recibida" && (
            <Button size="sm" variant="ghost" className={btn} onClick={() => resultado(deshacerSenalRecibida(cita.id))}>
              Deshacer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
