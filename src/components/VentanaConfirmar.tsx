import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Droplet, GripHorizontal, TriangleAlert, X } from "lucide-react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { fichaDeClienta } from "@/lib/ficha-clienta";
import { duracionCorta, opcionesDeDuracion } from "@/lib/hoy-arena";
import { recargoActivo } from "@/lib/recargo-activo";
import { eur, hora } from "@/lib/copy";
import { iniciales } from "@/lib/calendario-arena";
import type { Appointment } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { DuracionOtra } from "@/components/DuracionOtra";
import { cn } from "@/lib/utils";

/**
 * Confirmar con previsualización (lote 9f). Al pulsar «Confirmar» en Hoy,
 * Citas o el detalle de una cita, se abre esta ventana en vez de confirmar a
 * ciegas: a la izquierda la ficha resumida de la clienta (visitas, último
 * color, avisos, deuda) y a la derecha la propuesta (servicio, profesional,
 * día, hora, duración editable, precio y señal según Ajustes).
 *
 * Es una ventana, no un diálogo modal: centrada, sin velo, con sombra, se
 * mueve cogiéndola por la cabecera y se cierra con Esc o con la X. No cambia
 * la lógica de la señal: solo dice lo que hay configurado.
 */
export function VentanaConfirmar({
  cita,
  duracionInicial,
  onCerrar,
  onCambiar,
}: {
  cita: Appointment | null;
  duracionInicial?: number;
  onCerrar: () => void;
  /** «Cambiar…»: abre el detalle de la cita para mover día, hora o profesional. */
  onCambiar?: (a: Appointment) => void;
}) {
  if (!cita || typeof document === "undefined") return null;
  return createPortal(<Ventana key={cita.id} cita={cita} duracionInicial={duracionInicial} onCerrar={onCerrar} onCambiar={onCambiar} />, document.body);
}

function Ventana({
  cita,
  duracionInicial,
  onCerrar,
  onCambiar,
}: {
  cita: Appointment;
  duracionInicial?: number;
  onCerrar: () => void;
  onCambiar?: (a: Appointment) => void;
}) {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur ?? 0);
  const depositEnabled = useSalonStore((s) => !!s.salonProfile.depositEnabled);
  const depositBizumPhone = useSalonStore((s) => s.salonProfile.depositBizumPhone ?? "");
  const depositAmountEur = useSalonStore((s) => s.salonProfile.depositAmountEur ?? 10);
  const equipo = useEquipo();
  const carta = selectServiceMap(services);
  const titulo = useId();

  const cliente = clients.find((c) => c.id === cita.clientId);
  const ficha = fichaDeClienta(cita.clientId, { citas: appointments, clientes: clients, servicios: services, equipo, ahora: new Date() });
  const profesional = equipo.find((e) => e.id === cita.employeeId);
  const [duracion, setDuracion] = useState(duracionInicial ?? cita.duration);
  const deuda = recargoActivo({ noShowFeeEur }) ? (cliente?.penaltyEur ?? 0) : 0;
  const pideSenal = depositEnabled && !!depositBizumPhone.trim();
  const fecha = new Date(cita.start);
  const fin = new Date(+fecha + duracion * 60_000);
  const dia = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  // Posición: centrada al abrir; al arrastrar la cabecera se mueve con
  // transform, escrito en requestAnimationFrame, sin re-render por píxel.
  const caja = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const origen = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const marco = useRef(0);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    pos.current = { x: Math.max(8, (window.innerWidth - r.width) / 2), y: Math.max(8, (window.innerHeight - r.height) / 2) };
    el.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
    el.style.visibility = "visible";
    el.focus();
  }, []);
  const colocar = () => {
    marco.current = 0;
    if (caja.current) caja.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
  };

  // Esc cierra, y el foco vuelve a donde estaba.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
      }
    };
    window.addEventListener("keydown", tecla, true);
    return () => {
      window.removeEventListener("keydown", tecla, true);
      previo?.focus?.();
    };
  }, [onCerrar]);

  function confirmar() {
    updateAppointment(cita.id, { status: "confirmed", duration: duracion });
    toast.success("Cita confirmada", { description: `${cita.clientName} · ${duracionCorta(duracion)}` });
    onCerrar();
  }
  function rechazar() {
    const estadoPrevio = cita.status;
    cancelAppointment(cita.id);
    toast.success("Solicitud rechazada", {
      description: cita.clientName,
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: () => {
          updateAppointment(cita.id, { status: estadoPrevio });
          toast.success("Solicitud recuperada", { description: cita.clientName });
        },
      },
    });
    onCerrar();
  }

  const chip = (activo: boolean) =>
    cn("h-9 rounded-full border px-3.5 text-[13px] font-bold tabular-nums", activo ? "border-salvia bg-salvia-clara text-foreground" : "border-lino bg-card text-cafe-medio hover:bg-beige");
  const r = ficha.resumen;

  return (
    <div
      ref={caja}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titulo}
      tabIndex={-1}
      data-ventana-confirmar
      className="fixed top-0 left-0 z-[60] flex max-h-[calc(100dvh-16px)] w-[min(880px,calc(100vw-16px))] flex-col overflow-hidden rounded-[22px] border border-lino-fuerte bg-superficie shadow-[0_18px_48px_rgba(59,47,42,0.22)] outline-none"
      style={{ visibility: "hidden" }}
    >
      {/* Cabecera: se coge de aquí para mover la ventana. */}
      <div
        className="flex cursor-grab touch-none items-center gap-3 border-b border-lino bg-beige px-5 py-3 select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          origen.current = { px: e.clientX, py: e.clientY, ...pos.current };
        }}
        onPointerMove={(e) => {
          const o = origen.current;
          const el = caja.current;
          if (!o || !el) return;
          const r2 = el.getBoundingClientRect();
          pos.current = {
            x: Math.min(window.innerWidth - 80, Math.max(80 - r2.width, o.x + e.clientX - o.px)),
            y: Math.min(window.innerHeight - 48, Math.max(0, o.y + e.clientY - o.py)),
          };
          if (!marco.current) marco.current = requestAnimationFrame(colocar);
        }}
        onPointerUp={(e) => {
          origen.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        <GripHorizontal className="size-4 shrink-0 text-cafe-suave" strokeWidth={1.6} aria-hidden="true" />
        <h2 id={titulo} className="flex-1 text-[16px] font-extrabold tracking-[-0.01em]">
          Confirmar la cita de {cita.clientName || "la clienta"}
        </h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full text-cafe-medio hover:bg-card">
          <X className="size-[18px]" strokeWidth={1.6} />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Ficha resumida */}
        <section aria-label="Ficha de la clienta" className="space-y-4 border-b border-lino p-5 md:border-r md:border-b-0">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-stylist-mario text-[15px] font-extrabold">{iniciales(cita.clientName || "?")}</span>
            <span className="min-w-0">
              <b className="block truncate text-[16px]">{cita.clientName}</b>
              {cliente?.phone && <span className="text-[13px] text-cafe-medio tabular-nums">{cliente.phone}</span>}
            </span>
          </div>
          <p className="rounded-2xl bg-nata px-3.5 py-2.5 text-[13.5px] text-cafe-medio">
            {r.numeroVisitas === 0 ? (
              <b className="text-foreground">Primera visita</b>
            ) : (
              <>
                <b className="text-foreground tabular-nums">{r.numeroVisitas}</b> {r.numeroVisitas === 1 ? "visita" : "visitas"}
                {r.ultimaVisita && ` · última el ${new Date(r.ultimaVisita).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}
                {r.frecuenciaMediaDias !== undefined && ` · cada ${r.frecuenciaMediaDias < 14 ? `${r.frecuenciaMediaDias} días` : `${Math.round(r.frecuenciaMediaDias / 7)} sem.`}`}
              </>
            )}
          </p>
          {r.ultimoColor && (
            <div className="rounded-2xl border border-salvia bg-salvia-suave px-3.5 py-2.5 text-[13px]">
              <p className="flex items-center gap-1.5 font-bold text-hoja-tinta">
                <Droplet className="size-3.5" strokeWidth={1.8} aria-hidden="true" /> Último color
              </p>
              <p className="mt-0.5 text-cafe">{r.ultimoColor.formula}</p>
            </div>
          )}
          {(deuda > 0 || ficha.avisos.length > 0) && (
            <ul className="space-y-1.5">
              {deuda > 0 && (
                <li className="flex items-start gap-1.5 rounded-xl bg-melocoton px-3 py-2 text-[13px] font-bold text-melocoton-tinta">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  Tiene un recargo pendiente de {eur(deuda)}
                </li>
              )}
              {ficha.avisos.map((a) => (
                <li key={a} className="flex items-start gap-1.5 text-[13px] text-cafe-medio">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-moca" strokeWidth={1.8} aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Propuesta de cita */}
        <section aria-label="Propuesta de cita" className="space-y-4 p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
            <dt className="text-cafe-suave">Servicio</dt>
            <dd className="font-bold">{serviceLabelOf(cita, carta)}</dd>
            <dt className="text-cafe-suave">Profesional</dt>
            <dd className="font-bold">{profesional?.name ?? "Sin indicar"}</dd>
            <dt className="text-cafe-suave">Día</dt>
            <dd className="font-bold first-letter:uppercase">{dia}</dd>
            <dt className="text-cafe-suave">Hora</dt>
            <dd className="font-bold tabular-nums">
              {hora(cita.start)} – {hora(fin.toISOString())}
            </dd>
            <dt className="text-cafe-suave">Precio</dt>
            <dd className="font-bold tabular-nums">{eur(cita.priceEur)}</dd>
          </dl>
          <div>
            <p className="mb-1.5 text-[13px] font-bold text-cafe">Duración</p>
            <div className="flex flex-wrap gap-1.5">
              {opcionesDeDuracion(duracion).map((m) => (
                <button key={m} type="button" aria-pressed={m === duracion} onClick={() => setDuracion(m)} className={chip(m === duracion)}>
                  {duracionCorta(m)}
                </button>
              ))}
              <DuracionOtra valor={duracion} onElegir={setDuracion} claseChip={chip(false)} />
            </div>
          </div>
          <p className="rounded-2xl bg-nata px-3.5 py-2.5 text-[13px] text-cafe-medio">
            {pideSenal
              ? `Señal configurada: ${eur(depositAmountEur)} por Bizum. Pídela después desde la cita si hace falta.`
              : "Sin señal: no está activada en Ajustes."}
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-lino bg-card px-5 py-3.5">
        <Button onClick={confirmar} className="gap-1.5">
          Confirmar cita · {duracionCorta(duracion)}
        </Button>
        {onCambiar && (
          <Button variant="secondary" onClick={() => onCambiar(cita)}>
            Cambiar…
          </Button>
        )}
        {cita.status === "pending" && (
          <Button variant="ghost" onClick={rechazar} className="text-melocoton-tinta hover:bg-melocoton">
            Rechazar
          </Button>
        )}
        <span className="ml-auto hidden text-[12.5px] text-cafe-suave sm:inline">Esc para cerrar</span>
      </div>
    </div>
  );
}
