import { useCitasVisibles, useEquipoVisible } from "@/lib/accesos-panel";
import { useFichas } from "@/lib/use-fichas";
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Clock3, History, Printer, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { whatsappUrl } from "@/lib/campanas";
import { mensajeRecordatorioDe } from "@/lib/plantillas-whatsapp";
import { employeeMap } from "@/lib/mock/salon";
import { useEquipo } from "@/lib/use-equipo";
import { hojaDelDia, fechaLocal, vistaHoja } from "@/lib/hoja-del-dia";
import { serviceLabelOf } from "@/lib/appointment-services";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { Button } from "@/components/ui/button";
import { fichaDeClienta } from "@/lib/ficha-clienta";
import type { Appointment, Client } from "@/lib/mock/types";
import { franjasProfesional } from "@/lib/horario-equipo";

export const Route = createFileRoute("/app/hoja")({
  validateSearch: (search: Record<string, unknown>) => ({ dia: vistaHoja(search) }),
  component: HojaDelDia,
});

function HojaDelDia() {
  const citas = useCitasVisibles();
  const salon = useSalonStore((s) => s.salonProfile);
  const clientes = useSalonStore((s) => s.clients);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const servicios = useSalonStore((s) => s.services);
  const equipo = useEquipoVisible();
  const { dia } = Route.useSearch();
  const navigate = useNavigate({ from: "/app/hoja" });
  const manana = dia === "manana";
  const { abrirCita, abrirClienta } = useFichas();
  const setSelected = (a: Appointment | null) => {
    if (a) abrirCita(a.id);
  };
  const fecha = new Date();
  if (manana) fecha.setDate(fecha.getDate() + 1);
  const hoja = hojaDelDia(citas, fechaLocal(fecha));
  const grupos = equipo.map((p) => ({
    profesional: p,
    visitas: hoja.filter((v) => v.cita.employeeId === p.id),
  }));

  const carta = selectServiceMap(servicios);
  const hhmm = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const segmento = (activo: boolean) =>
    cn(
      "h-[34px] rounded-full px-[15px] text-[13px] font-bold text-cafe-medio",
      activo && "bg-card text-foreground shadow-[0_1px_3px_rgba(59,47,42,0.12)]",
    );

  return (
    <div className="hoja-dia pagina">
      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] md:text-[32px]">
            Hoja {manana ? "de mañana" : "del día"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {fecha.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="hoja-controles flex flex-wrap items-center gap-2 md:ml-auto">
          <div
            role="tablist"
            aria-label="Día de la hoja"
            className="inline-flex gap-0.5 rounded-full border border-border bg-nata p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!manana}
              className={segmento(!manana)}
              onClick={() => navigate({ search: { dia: "hoy" } })}
            >
              Hoy
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={manana}
              className={segmento(manana)}
              onClick={() => navigate({ search: { dia: "manana" } })}
            >
              Mañana
            </button>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-[18px]" strokeWidth={1.6} />
            Imprimir
          </Button>
        </div>
      </header>
      {manana && (
        <section className="hoja-recordatorios overflow-hidden tarjeta-principal bg-card">
          <div className="px-[var(--relleno-tarjeta)] py-4">
            <h2 className="text-base font-extrabold tracking-[-0.01em]">
              Recordatorios para mañana
            </h2>
            <p className="text-[12.5px] text-muted-foreground">
              Se abren en tu WhatsApp con el mensaje escrito; lo envías tú.
            </p>
          </div>
          {hoja.length === 0 && (
            <p className="border-t border-border px-[var(--relleno-tarjeta)] py-3 text-[12.5px] text-muted-foreground">
              No hay citas que recordar.
            </p>
          )}
          {/* Por hora: la hoja viene agrupada por profesional y aquí no hay rótulos de grupo. */}
          {[...hoja]
            .sort((a, b) => +new Date(a.cita.start) - +new Date(b.cita.start))
            .map(({ cita }) => {
              const telefono = clientes.find((c) => c.id === cita.clientId)?.phone;
              return (
                <div
                  key={cita.id}
                  className="flex flex-wrap items-center gap-3 border-t border-border px-[var(--relleno-tarjeta)] py-3"
                >
                  <span className="w-[46px] shrink-0 font-extrabold tabular-nums">
                    {new Date(cita.start).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{cita.clientName}</b>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {serviceLabelOf(cita, carta)}
                    </span>
                  </span>
                  {cita.reminderSentAt ? (
                    <span className="inline-flex h-6 items-center rounded-full bg-nata px-2.5 text-[12.5px] font-bold text-cafe-medio">
                      Enviado
                    </span>
                  ) : (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        disabled={!telefono}
                        onClick={() => {
                          if (!telefono) return;
                          // El texto de la dueña si lo escribió en Ajustes; si no, el de siempre.
                          const url = whatsappUrl(
                            telefono,
                            mensajeRecordatorioDe(salon.plantillas?.recordatorio, {
                              clientName: cita.clientName.split(" ")[0],
                              salonName: salon.name,
                              startISO: cita.start,
                              profesional: employeeMap[cita.employeeId]?.name,
                              servicio: serviceLabelOf(cita, carta),
                              direccion: salon.address,
                              senalPendiente:
                                cita.depositRequestedAt &&
                                !cita.depositReceivedAt &&
                                salon.depositBizumPhone
                                  ? {
                                      importeEur: cita.depositEur ?? salon.depositAmountEur ?? 10,
                                      bizumPhone: salon.depositBizumPhone,
                                      deadlineISO: cita.depositDueAt,
                                    }
                                  : undefined,
                            }),
                          );
                          useSalonStore.getState().abrirWhatsAppDeCita(cita.id, url);
                        }}
                      >
                        Enviar recordatorio
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateAppointment(cita.id, { reminderSentAt: new Date().toISOString() })
                        }
                      >
                        Marcar como enviado
                      </Button>
                    </div>
                  )}
                  {!telefono && (
                    <span className="w-full text-[12.5px] text-muted-foreground">
                      Falta el teléfono en la ficha.
                    </span>
                  )}
                </div>
              );
            })}
        </section>
      )}
      {grupos.length === 0 && (
        <p className="tarjeta-principal border border-border relleno-tarjeta text-[12.5px] text-muted-foreground">
          No hay citas para este día.
        </p>
      )}
      {grupos.map(({ profesional, visitas }) => {
        const jornadas = franjasProfesional(profesional, fecha.getDay()).map(
          (r) => `${hhmm(r.start)}–${hhmm(r.end)}`,
        );
        return (
          <section
            key={profesional.id}
            className="hoja-grupo overflow-hidden tarjeta-principal bg-card"
          >
            <h2 className="flex flex-wrap items-center gap-2.5 border-b border-border bg-perla px-[var(--relleno-tarjeta)] py-3">
              <span
                className="grid size-8 place-items-center rounded-full bg-nata text-xs font-extrabold text-cafe-medio"
                aria-hidden="true"
              >
                {profesional.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-base font-extrabold">{profesional.name}</span>
              <span className="inline-flex h-6 items-center rounded-full bg-nata px-2.5 text-[12.5px] font-bold text-cafe-medio tabular-nums">
                {visitas.length} {visitas.length === 1 ? "cita" : "citas"} ·{" "}
                {jornadas.length ? jornadas.join(", ") : "No trabaja"}
              </span>
            </h2>
            {visitas.length === 0 && (
              <p className="px-[var(--relleno-tarjeta)] py-3 text-[12.5px] text-muted-foreground">
                Sin citas este día.
              </p>
            )}
            <div className="divide-y divide-border">
              {visitas.map(({ cita, ultimoColor }) => {
                const ficha = fichaDeClienta(cita.clientId, {
                  citas,
                  clientes,
                  servicios,
                  equipo,
                  ahora: new Date(),
                });
                const anteriores = ficha.visitas
                  .filter((v) => +new Date(v.fecha) < +new Date(cita.start))
                  .slice(0, 3);
                return (
                  <article
                    key={cita.id}
                    className="hoja-visita grid items-start gap-3 px-[var(--relleno-tarjeta)] py-3 lg:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.2fr)_minmax(190px,0.9fr)]"
                    aria-label={`Cita de ${cita.clientName}`}
                  >
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                      <time
                        className="grid min-h-10 min-w-[60px] shrink-0 place-items-center rounded-xl bg-nata px-2 text-base font-extrabold text-cafe tabular-nums"
                        dateTime={cita.start}
                      >
                        {new Date(cita.start).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      <button
                        type="button"
                        onClick={() => setSelected(cita)}
                        className="min-w-0 flex-1 rounded-lg text-left hover:text-primary"
                      >
                        <h3 className="font-display text-[18px] leading-tight font-medium">
                          {cita.clientName}
                        </h3>
                        <p className="mt-0.5 text-[12.5px] leading-snug text-cafe-medio">
                          {serviceLabelOf(cita, carta)}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                          {cita.duration} min
                        </span>
                      </button>
                      <div className="hoja-ficha flex w-full flex-wrap items-center gap-1 lg:pl-[72px]">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelected(cita)}
                        >
                          Ver cita
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => abrirClienta(cita.clientId)}
                        >
                          Ficha completa
                        </Button>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-2">
                      {(ultimoColor?.colorFormula || ultimoColor?.technicalNotes || cita.note) && (
                        <div className="grid gap-2">
                          {ultimoColor?.colorFormula && (
                            <div className="rounded-xl bg-nata/60 px-3 py-2 text-cafe-medio">
                              <p className="mb-0.5 text-[11px] font-bold">
                                Última fórmula de color
                              </p>
                              <p className="text-[12.5px] leading-snug">
                                {ultimoColor.colorFormula}
                              </p>
                            </div>
                          )}
                          {(ultimoColor?.technicalNotes || cita.note) && (
                            <div className="rounded-xl bg-nata/60 px-3 py-2">
                              {ultimoColor?.technicalNotes && (
                                <div>
                                  <p className="mb-1 text-xs font-bold text-cafe-medio">
                                    Notas técnicas
                                  </p>
                                  <p className="text-[12.5px] leading-snug text-cafe-medio">
                                    {ultimoColor.technicalNotes}
                                  </p>
                                </div>
                              )}
                              {cita.note && (
                                <div className={ultimoColor?.technicalNotes ? "mt-2" : ""}>
                                  <p className="mb-1 text-xs font-bold text-cafe-medio">
                                    Para esta cita
                                  </p>
                                  <p className="text-[12.5px] leading-snug text-cafe-medio">
                                    {cita.note}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <BookingAnswersSummary answers={cita.bookingAnswers} formato="hoja" />
                      {(cita.depositReceivedAt || cita.depositRequestedAt) && (
                        <p className="inline-flex rounded-full bg-nata/60 px-2.5 py-1 text-xs font-semibold text-cafe-medio">
                          {cita.depositReceivedAt ? "Señal recibida" : "Señal pendiente"}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      {ficha.avisos.length > 0 && (
                        <div className="flex items-start gap-2 rounded-xl bg-melocoton/50 px-3 py-2 text-[13px] text-melocoton-tinta">
                          <TriangleAlert
                            className="mt-0.5 size-4 shrink-0"
                            strokeWidth={1.6}
                            aria-hidden="true"
                          />
                          <div>
                            <p className="mb-1 font-bold">Ten en cuenta</p>
                            {ficha.avisos.map((aviso) => (
                              <p key={aviso} className="leading-snug">
                                {aviso}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {anteriores.length > 0 && (
                        <details className="rounded-xl bg-nata/60 px-3 py-2">
                          <summary className="flex min-h-6 cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-cafe-medio [&::-webkit-details-marker]:hidden">
                            <History className="size-4 shrink-0" aria-hidden="true" />
                            Visitas anteriores{" "}
                            <span className="font-normal text-muted-foreground">
                              ({anteriores.length})
                            </span>
                            <ChevronDown className="ml-auto size-4" aria-hidden="true" />
                          </summary>
                          <ol className="mt-3 grid gap-3">
                            {anteriores.map((visita) => (
                              <li
                                key={visita.id}
                                className="grid gap-1 text-[13px] sm:grid-cols-[100px_1fr] sm:gap-4"
                              >
                                <time className="text-xs font-semibold text-muted-foreground tabular-nums">
                                  {new Date(visita.fecha).toLocaleDateString("es-ES", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </time>
                                <div>
                                  <p className="font-semibold text-cafe-medio">
                                    {visita.servicios.join(" + ")}
                                  </p>
                                  {visita.colorFormula && (
                                    <p className="mt-1 leading-relaxed text-muted-foreground">
                                      {visita.colorFormula}
                                    </p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
