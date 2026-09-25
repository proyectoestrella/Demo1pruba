import { useState } from "react";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { whatsappUrl } from "@/lib/campanas";
import { eur, hora } from "@/lib/copy";
import {
  accionesSenal,
  estadoSenal,
  mensajeErrorSenal,
  prepararPeticionSenal,
  reglaSenal,
  rellenarPlantillaSenal,
  type EstadoSenal,
  type MetodoSenal,
} from "@/lib/senal-maqueta";
import type { Appointment } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * La señal de una cita (lote 9j, Método A): su estado en el ciclo y lo que la
 * dueña puede hacer. «Pedir» abre WhatsApp con el mensaje escrito y solo marca
 * «pedida» si ella confirma que lo envió: abrir WhatsApp no es enviar.
 * «Recibida» la marca ella al ver el Bizum en su banco: siShow no toca dinero.
 * Contra el adaptador `senal-maqueta.ts` (CONECTAR al fusionar con BACKEND).
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

export function SenalCita({ cita, compacta = false }: { cita: Appointment; compacta?: boolean }) {
  const perfil = useSalonStore((s) => s.salonProfile);
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const regla = reglaSenal(perfil);
  // «Nuevas»: sin ninguna visita completada antes.
  const esNueva = !appointments.some((b) => b.clientId === cita.clientId && b.id !== cita.id && b.status === "completed");
  const estado = estadoSenal(cita, regla, new Date(), esNueva);
  const acciones = accionesSenal({ appointments, updateAppointment, cancelAppointment });
  const [preguntaEnvio, setPreguntaEnvio] = useState<{ importeEur: number; venceISO: string } | null>(null);
  const [recibiendo, setRecibiendo] = useState(false);
  const [importe, setImporte] = useState(String(cita.depositEur ?? ""));
  const [metodo, setMetodo] = useState<MetodoSenal>("bizum");

  if (estado === "no_aplica" && !regla.bizum) return null;

  const resultado = (error: string | null, ok: string) => (error ? toast.error(mensajeErrorSenal(error as never)) : toast.success(ok));

  function pedir() {
    const p = prepararPeticionSenal(cita, regla, estado === "no_aplica" ? regla.importeEur : undefined);
    if (!p.ok) return toast.error(mensajeErrorSenal(p.error));
    const telefono = clients.find((c) => c.id === cita.clientId)?.phone;
    if (!telefono) return toast.error("Esta clienta no tiene teléfono al que escribir.");
    const texto = rellenarPlantillaSenal(regla.plantilla, {
      nombre: (cita.clientName || "").split(" ")[0],
      salon: perfil.name,
      importeEur: p.importeEur,
      bizum: regla.bizum,
      startISO: cita.start,
      venceISO: p.venceISO,
    });
    window.open(whatsappUrl(telefono, texto), "_blank", "noopener,noreferrer");
    setPreguntaEnvio({ importeEur: p.importeEur, venceISO: p.venceISO });
  }

  const etiqueta = ETIQUETA[estado];
  const vence = cita.depositDueAt ? `antes de las ${hora(cita.depositDueAt)}${new Date(cita.depositDueAt).toDateString() === new Date().toDateString() ? "" : ` del ${new Date(cita.depositDueAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}` : "";
  const detalle: Partial<Record<EstadoSenal, string>> = {
    no_aplica: "Tu regla no la pide para esta cita. Puedes pedirla igualmente.",
    por_pedir: `Tu regla pide una señal de ${eur(cita.depositEur ?? (regla.modo === "porcentaje" ? Math.max(1, Math.round((cita.priceEur * regla.porcentaje) / 100)) : regla.importeEur))}.`,
    pedida: `${eur(cita.depositEur ?? 0)} ${vence}. Márcala cuando la veas en tu banco.`,
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
      {detalle[estado] && <p className="text-[12.5px] leading-snug text-cafe-medio">{detalle[estado]}</p>}

      {preguntaEnvio ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-miel px-3 py-2 text-[13px]">
          <span className="font-bold">¿Has enviado el WhatsApp?</span>
          <Button
            size="sm"
            className={btn}
            onClick={() => {
              resultado(acciones.pedirSenal(cita.id, preguntaEnvio.importeEur, preguntaEnvio.venceISO, regla.plazoHoras), "Señal pedida: corre el plazo");
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
              resultado(acciones.recibirSenal(cita.id, { metodo, importeEur: Number.isFinite(n) && importe.trim() ? n : undefined }), "Señal recibida");
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
          {(estado === "no_aplica" || estado === "por_pedir") && (
            <Button size="sm" variant={estado === "por_pedir" ? "default" : "outline"} className={btn} onClick={pedir}>
              {estado === "no_aplica" ? "Pedir señal igualmente" : "Pedir señal por WhatsApp"}
            </Button>
          )}
          {(estado === "pedida" || estado === "vencida") && (
            <>
              <Button size="sm" variant="secondary" className={btn} onClick={() => setRecibiendo(true)}>
                Recibida
              </Button>
              <Button size="sm" variant="outline" className={btn} onClick={() => resultado(acciones.darMasTiempoSenal(cita.id, regla.plazoHoras), "Plazo ampliado")}>
                Dar más tiempo
              </Button>
              <Button size="sm" variant="ghost" className={btn} onClick={pedir}>
                Volver a pedir
              </Button>
            </>
          )}
          {estado === "vencida" && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(btn, "text-melocoton-tinta hover:bg-melocoton")}
              onClick={() => {
                if (!window.confirm(`¿Liberar el hueco de ${cita.clientName}? La cita se cancela y la señal se anula.`)) return;
                resultado(acciones.liberarHueco(cita.id), "Hueco liberado");
              }}
            >
              Liberar el hueco
            </Button>
          )}
          {estado === "recibida" && (
            <Button size="sm" variant="ghost" className={btn} onClick={() => resultado(acciones.deshacerSenalRecibida(cita.id), "Desmarcada")}>
              Deshacer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
