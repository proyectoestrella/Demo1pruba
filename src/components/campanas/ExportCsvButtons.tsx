import { useMemo } from "react";
import { Download } from "lucide-react";
import type { Appointment, Employee, Service } from "@/lib/mock/types";
import { textoRango, type Rango } from "@/lib/periodos";
import { selectServiceMap, useSalonStore } from "@/lib/store";
import { inferBusinessType } from "@/lib/business-type";
import { resumenCitasToCsv, downloadCsv } from "@/lib/export-csv";
import { zonaDelSalon, fechaEnZona } from "@/lib/zona-horaria";
import { enRango } from "@/lib/periodo-citas";
import { Button } from "@/components/ui/button";

export interface ExportCsvButtonsProps {
  /**
   * Citas a exportar. Sin `rango`, se exportan TAL CUAL: la pantalla Citas
   * ya las pasa filtradas por su periodo, estado, profesional y búsqueda.
   */
  appointments: Appointment[];
  services: Service[];
  employees: Employee[];
  /** Periodo que manda en Analítica: se recortan las citas a este rango. */
  rango?: Rango;
  /** Texto del periodo para la cabecera del CSV («Este mes (1 oct – 31 oct)»). */
  textoPeriodo?: string;
  /** Trozo del nombre de archivo («este-mes»). */
  archivo?: string;
  /** Filtros además del periodo, para la cabecera del CSV. */
  filtros?: string;
  className?: string;
}

/**
 * «Exportar resumen» (22-oct): un solo botón y un solo CSV con el resumen
 * del periodo (totales, por estado, por servicio, por profesional) y el
 * detalle cita a cita. Antes eran dos botones, y «Resumen del mes» ignoraba
 * el periodo elegido. Todo se genera en el navegador (ver `lib/export-csv.ts`).
 */
export function ExportCsvButtons({ appointments, services, employees, rango, textoPeriodo, archivo, filtros, className }: ExportCsvButtonsProps) {
  const serviceMap = useMemo(() => selectServiceMap(services), [services]);
  const employeeMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);
  const salonProfile = useSalonStore((s) => s.salonProfile);
  const zona = zonaDelSalon(salonProfile);

  function exportar() {
    const now = new Date();
    const citas = rango ? appointments.filter((a) => enRango(a, rango)) : appointments;
    const periodo = textoPeriodo ?? (rango ? textoRango(rango, zona) : "Todas las fechas");
    const csv = resumenCitasToCsv(citas, serviceMap, employeeMap, {
      periodo,
      filtros,
      salon: salonProfile.name,
      timeZone: zona,
      ahora: now,
      formulario: { perfil: salonProfile, tipo: inferBusinessType(salonProfile.tagline, salonProfile.name) },
    });
    const etiqueta = rango
      ? `${fechaEnZona(rango.inicio, zona)}_${fechaEnZona(new Date(+rango.fin - 1), zona)}`
      : (archivo ?? "citas");
    downloadCsv(`resumen-citas-${etiqueta}-${fechaEnZona(now, zona)}.csv`, csv);
  }

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      {rango && <span className="text-xs text-muted-foreground">{textoRango(rango, zona)}</span>}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 gap-1.5"
        onClick={exportar}
        title="Descarga un CSV para Excel con el resumen del periodo y el detalle de cada cita"
      >
        <Download className="size-4" /> Exportar resumen
      </Button>
    </div>
  );
}
