import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Printer, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { enlaceRecordatorio } from "@/lib/avisos";
import { useEquipo } from "@/lib/use-equipo";
import { hojaDelDia, fechaLocal, vistaHoja } from "@/lib/hoja-del-dia";
import { serviceLabelOf } from "@/lib/appointment-services";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { Button } from "@/components/ui/button";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { ClientHistorySheet } from "@/components/ClientHistorySheet";
import { fichaDeClienta } from "@/lib/ficha-clienta";
import type { Appointment, Client } from "@/lib/mock/types";
import { franjasProfesional } from "@/lib/horario-equipo";

export const Route = createFileRoute("/app/hoja")({
  validateSearch: (search: Record<string, unknown>) => ({ dia: vistaHoja(search) }),
  component: HojaDelDia,
});

function HojaDelDia() {
  const citas = useSalonStore((s) => s.appointments);
  const salon = useSalonStore((s) => s.salonProfile);
  const clientes = useSalonStore((s) => s.clients);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const servicios = useSalonStore((s) => s.services);
  const equipo = useEquipo();
  const { dia } = Route.useSearch();
  const navigate = useNavigate({ from: "/app/hoja" });
  const manana = dia === "manana";
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [fichaAbierta, setFichaAbierta] = useState<Client | null>(null);
  const fecha = new Date();
  if (manana) fecha.setDate(fecha.getDate() + 1);
  const hoja = hojaDelDia(citas, fechaLocal(fecha));
  const grupos = equipo.map((p) => ({ profesional: p, visitas: hoja.filter((v) => v.cita.employeeId === p.id) }));

  const carta = selectServiceMap(servicios);
  const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const segmento = (activo: boolean) =>
    cn("h-[34px] rounded-full px-[15px] text-[13px] font-bold text-cafe-medio", activo && "bg-card text-foreground shadow-[0_1px_3px_rgba(59,47,42,0.12)]");

  return <div className="hoja-dia flex flex-1 flex-col gap-5">
    <header className="flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{salon.name} · Agenda de trabajo</p>
        <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] md:text-[32px]">Hoja {manana ? "de mañana" : "del día"}</h1>
        <p className="mt-1 text-muted-foreground">{fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <div className="hoja-controles flex flex-wrap items-center gap-2 md:ml-auto">
        <div role="tablist" aria-label="Día de la hoja" className="inline-flex gap-0.5 rounded-full border border-border bg-nata p-1">
          <button type="button" role="tab" aria-selected={!manana} className={segmento(!manana)} onClick={() => navigate({ search: { dia: "hoy" } })}>Hoy</button>
          <button type="button" role="tab" aria-selected={manana} className={segmento(manana)} onClick={() => navigate({ search: { dia: "manana" } })}>Mañana</button>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="size-[18px]" strokeWidth={1.6} />Imprimir</Button>
      </div>
    </header>
    {manana && <section className="hoja-recordatorios overflow-hidden rounded-[20px] border border-border bg-card">
      <div className="px-5 py-4">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Recordatorios para mañana</h2>
        <p className="text-[12.5px] text-muted-foreground">Se abren en tu WhatsApp con el mensaje escrito; lo envías tú.</p>
      </div>
      {hoja.length === 0 && <p className="border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">No hay citas que recordar.</p>}
      {/* Por hora: la hoja viene agrupada por profesional y aquí no hay rótulos de grupo. */}
      {[...hoja].sort((a, b) => +new Date(a.cita.start) - +new Date(b.cita.start)).map(({ cita }) => {
        const telefono = clientes.find((c) => c.id === cita.clientId)?.phone;
        return <div key={cita.id} className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-[11px]">
          <span className="w-[46px] shrink-0 font-extrabold tabular-nums">{new Date(cita.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="min-w-0 flex-1"><b className="block truncate">{cita.clientName}</b><span className="block truncate text-[12.5px] text-muted-foreground">{serviceLabelOf(cita, carta)}</span></span>
          {cita.reminderSentAt ? <span className="inline-flex h-6 items-center rounded-full bg-salvia-clara px-2.5 text-[12.5px] font-bold text-hoja-tinta">Enviado</span> : <div className="flex gap-1.5">
            <Button size="sm" disabled={!telefono} onClick={() => {
              if (!telefono) return;
              const url = enlaceRecordatorio(telefono, {
                clientName: cita.clientName.split(" ")[0], salonName: salon.name, startISO: cita.start,
                servicio: serviceLabelOf(cita, carta), direccion: salon.address,
                senalPendiente: cita.depositRequestedAt && !cita.depositReceivedAt && salon.depositBizumPhone
                  ? { importeEur: cita.depositEur ?? salon.depositAmountEur ?? 10, bizumPhone: salon.depositBizumPhone, deadlineISO: cita.depositDueAt }
                  : undefined,
              });
              window.open(url, "_blank", "noopener,noreferrer");
            }}>Enviar recordatorio</Button>
            <Button size="sm" variant="outline" onClick={() => updateAppointment(cita.id, { reminderSentAt: new Date().toISOString() })}>Marcar como enviado</Button>
          </div>}
          {!telefono && <span className="w-full text-[12.5px] text-muted-foreground">Falta el teléfono en la ficha.</span>}
        </div>;
      })}
    </section>}
    {grupos.length === 0 && <p className="rounded-[20px] border border-border p-6 text-[12.5px] text-muted-foreground">No hay citas para este día.</p>}
    {grupos.map(({ profesional, visitas }, gi) => {
      const jornadas = franjasProfesional(profesional, fecha.getDay()).map((r) => `${hhmm(r.start)}–${hhmm(r.end)}`);
      return <section key={profesional.id} className="hoja-grupo overflow-hidden rounded-[20px] border border-border bg-card">
      <h2 className="flex flex-wrap items-center gap-2.5 border-b border-border bg-perla px-5 py-3">
        <span className="grid size-8 place-items-center rounded-full text-xs font-extrabold" style={{ background: `var(--stylist-${["mario", "diego", "ruben"][gi % 3]})` }} aria-hidden="true">{profesional.name.slice(0, 2).toUpperCase()}</span>
        <span className="text-base font-extrabold">{profesional.name}</span>
        <span className="inline-flex h-6 items-center rounded-full bg-nata px-2.5 text-[12.5px] font-bold text-cafe-medio tabular-nums">{visitas.length} {visitas.length === 1 ? "cita" : "citas"} · {jornadas.length ? jornadas.join(", ") : "No trabaja"}</span>
      </h2>
      {visitas.length === 0 && <p className="px-5 py-3 text-[12.5px] text-muted-foreground">Sin citas este día.</p>}
      <div className="divide-y divide-border">{visitas.map(({ cita, ultimoColor }) => {
        const ficha = fichaDeClienta(cita.clientId, { citas, clientes, servicios, equipo, ahora: new Date() });
        const anteriores = ficha.visitas.filter((v) => +new Date(v.fecha) < +new Date(cita.start)).slice(0, 3);
        return <div key={cita.id} className="hoja-visita grid grid-cols-[3.5rem_1fr] gap-x-4 px-5 py-3.5 lg:grid-cols-[3.5rem_15rem_1fr_1fr]">
          <button type="button" onClick={() => setSelected(cita)} className="col-span-2 grid grid-cols-[3.5rem_1fr] gap-x-4 gap-y-2 text-left focus-visible:outline-2 focus-visible:outline-primary lg:col-span-4 lg:grid-cols-[3.5rem_15rem_1fr_1fr]">
            <time className="pt-px font-extrabold tabular-nums">{new Date(cita.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>
            <div className="min-w-0"><p className="font-bold hover:text-primary">{cita.clientName}</p><p className="text-[12.5px] text-muted-foreground">{serviceLabelOf(cita, carta)} · {cita.duration} min</p></div>
            <div className="col-start-2 space-y-1 text-[12.5px] lg:col-start-3">
              <p className={cn("rounded-xl px-2.5 py-1.5", ultimoColor?.colorFormula ? "bg-salvia-clara text-hoja-tinta" : "bg-nata text-cafe-medio")}><b>Color:</b> {ultimoColor?.colorFormula ?? "Sin color anotado"}</p>
              {ultimoColor?.technicalNotes && <p className="px-2.5"><b>Notas técnicas:</b> {ultimoColor.technicalNotes}</p>}
              <BookingAnswersSummary answers={cita.bookingAnswers} />
              <p className="px-2.5 text-muted-foreground">Señal: {cita.depositReceivedAt ? "recibida" : cita.depositRequestedAt ? "pedida, pendiente" : "sin pedir"}</p>
            </div>
            <div className="col-start-2 space-y-1 text-[12.5px] lg:col-start-4">
            {anteriores.length > 0 && <div><b className="text-muted-foreground">Visitas anteriores</b>
              {anteriores.map((v, i) => <p key={v.id} className={i === 2 ? "hoja-tercera-visita hidden" : ""}><span className="tabular-nums">{new Date(v.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span> · {v.servicios.join(" + ")}{v.colorFormula ? ` · ${v.colorFormula}` : " · Sin color anotado"}</p>)}
            </div>}
            {ficha.avisos.length > 0 && <div className="flex gap-1.5 rounded-xl bg-melocoton px-2.5 py-1.5 text-melocoton-tinta"><TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.6} /><div>{ficha.avisos.map((a) => <p key={a}>{a}</p>)}</div></div>}
            </div>
          </button>
          <Button type="button" variant="outline" size="sm" className="hoja-ficha col-start-2 mt-2 justify-self-start lg:col-start-3" onClick={() => setFichaAbierta(clientes.find((c) => c.id === cita.clientId) ?? null)}>Ficha completa</Button>
        </div>;
      })}</div>
    </section>;
    })}
    <AppointmentDetailSheet appointment={selected} open={!!selected} onOpenChange={(open) => !open && setSelected(null)} />
    <ClientHistorySheet client={fichaAbierta} open={!!fichaAbierta} onOpenChange={(open) => !open && setFichaAbierta(null)} />
  </div>;
}
