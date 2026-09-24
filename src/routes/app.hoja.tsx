import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { enlaceRecordatorio } from "@/lib/avisos";
import { useEquipo } from "@/lib/use-equipo";
import { hojaDelDia, fechaLocal, vistaHoja } from "@/lib/hoja-del-dia";
import { serviceLabelOf } from "@/lib/appointment-services";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { Button } from "@/components/ui/button";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import type { Appointment } from "@/lib/mock/types";

export const Route = createFileRoute("/app/hoja")({
  validateSearch: (search: Record<string, unknown>) => ({ dia: vistaHoja(search) }),
  component: HojaDelDia,
});

function HojaDelDia() {
  const citas = useSalonStore((s) => s.appointments);
  const salon = useSalonStore((s) => s.salonProfile);
  const clientes = useSalonStore((s) => s.clients);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const equipo = useEquipo();
  const { dia } = Route.useSearch();
  const navigate = useNavigate({ from: "/app/hoja" });
  const manana = dia === "manana";
  const [selected, setSelected] = useState<Appointment | null>(null);
  const fecha = new Date();
  if (manana) fecha.setDate(fecha.getDate() + 1);
  const hoja = hojaDelDia(citas, fechaLocal(fecha));
  const grupos = equipo.map((p) => ({ profesional: p, visitas: hoja.filter((v) => v.cita.employeeId === p.id) })).filter((g) => g.visitas.length);

  return <div className="hoja-dia mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{salon.name} · Agenda de trabajo</p>
        <h1 className="font-display text-3xl">Hoja del {manana ? "mañana" : "día"}</h1>
        <p className="text-sm text-muted-foreground">{fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <div className="hoja-controles flex gap-2">
        <Button variant={!manana ? "default" : "outline"} onClick={() => navigate({ search: { dia: "hoy" } })}>Hoy</Button>
        <Button variant={manana ? "default" : "outline"} onClick={() => navigate({ search: { dia: "manana" } })}>Mañana</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 size-4" />Imprimir</Button>
      </div>
    </header>
    {manana && <section className="hoja-recordatorios space-y-2 rounded-xl border border-border bg-card p-4">
      <h2 className="font-display text-lg">Recordatorios para mañana</h2>
      {hoja.length === 0 && <p className="text-sm text-muted-foreground">No hay citas que recordar.</p>}
      {hoja.map(({ cita }) => {
        const telefono = clientes.find((c) => c.id === cita.clientId)?.phone;
        return <div key={cita.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 py-2 text-sm">
          <span>{new Date(cita.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {cita.clientName} · {serviceLabelOf(cita)}</span>
          {cita.reminderSentAt ? <span className="text-primary">Recordado ✓</span> : <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!telefono} onClick={() => {
              if (!telefono) return;
              const url = enlaceRecordatorio(telefono, {
                clientName: cita.clientName.split(" ")[0], salonName: salon.name, startISO: cita.start,
                servicio: serviceLabelOf(cita), direccion: salon.address,
                senalPendiente: cita.depositRequestedAt && !cita.depositReceivedAt && salon.depositBizumPhone
                  ? { importeEur: cita.depositEur ?? salon.depositAmountEur ?? 10, bizumPhone: salon.depositBizumPhone, deadlineISO: cita.depositDueAt }
                  : undefined,
              });
              window.open(url, "_blank", "noopener,noreferrer");
            }}>Enviar recordatorio</Button>
            <Button size="sm" variant="ghost" onClick={() => updateAppointment(cita.id, { reminderSentAt: new Date().toISOString() })}>Marcar como enviado</Button>
          </div>}
          {!telefono && <span className="text-xs text-muted-foreground">Falta el teléfono en la ficha.</span>}
        </div>;
      })}
    </section>}
    {grupos.length === 0 && <p className="rounded-xl border p-6 text-sm text-muted-foreground">No hay citas para este día.</p>}
    {grupos.map(({ profesional, visitas }) => <section key={profesional.id} className="hoja-grupo rounded-xl border border-border bg-card">
      <h2 className="border-b border-border px-4 py-2 font-display text-lg">{profesional.name} <span className="ml-2 text-xs font-normal text-muted-foreground">{visitas.length} citas</span></h2>
      <div className="divide-y divide-border/70">{visitas.map(({ cita, ultimoColor }) => <button key={cita.id} type="button" onClick={() => setSelected(cita)} className="hoja-visita grid w-full grid-cols-[4rem_1fr] gap-3 px-4 py-3 text-left hover:bg-muted/30 sm:grid-cols-[4rem_12rem_1fr]">
        <time className="font-display text-lg tabular-nums">{new Date(cita.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>
        <div><p className="font-medium">{cita.clientName}</p><p className="text-xs text-muted-foreground">{serviceLabelOf(cita)} · {cita.duration} min</p></div>
        <div className="col-start-2 space-y-1 text-sm sm:col-start-3">
          <p><strong>Color:</strong> {ultimoColor?.colorFormula ?? "Sin color anotado"}</p>
          {ultimoColor?.technicalNotes && <p><strong>Notas técnicas:</strong> {ultimoColor.technicalNotes}</p>}
          <BookingAnswersSummary answers={cita.bookingAnswers} />
          <p className="text-xs text-muted-foreground">Señal: {cita.depositReceivedAt ? "recibida" : cita.depositRequestedAt ? "pedida, pendiente" : "sin pedir"}</p>
        </div>
      </button>)}</div>
    </section>)}
    <AppointmentDetailSheet appointment={selected} open={!!selected} onOpenChange={(open) => !open && setSelected(null)} />
  </div>;
}
