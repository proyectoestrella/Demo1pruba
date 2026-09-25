import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { CalendarDays, Check } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import {
  ETIQUETA_PERIODO,
  claveDeDia,
  deClaveDeDia,
  rangoDePeriodo,
  textoRango,
  type PeriodoId,
} from "@/lib/periodos";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BOTONES: PeriodoId[] = ["hoy", "semana", "mes", "personalizado"];

/** Nombre corto para móvil — ver el comentario del contenido del botón. */
const ETIQUETA_CORTA: Record<PeriodoId, string> = {
  hoy: "Hoy",
  semana: "Semana",
  mes: "Mes",
  personalizado: "Fechas",
};

/**
 * Selector de periodo de la analítica.
 *
 * Pensado para un dedo entre dos cortes: cuatro objetivos de 44 px de alto en
 * una sola fila, el elegido marcado con relleno sólido, y debajo —siempre
 * visible, sin tener que abrir nada— las fechas exactas que se están mirando.
 * "Fechas" abre un calendario de rango que se maneja tocando dos días.
 *
 * No calcula nada: el periodo vive en la store (y se persiste) y los números
 * salen de `lib/periodos.ts`.
 */
export function SelectorPeriodo({ className }: { className?: string }) {
  const periodo = useSalonStore((s) => s.periodoAnalitica);
  const rangoGuardado = useSalonStore((s) => s.rangoAnalitica);
  const setPeriodo = useSalonStore((s) => s.setPeriodoAnalitica);
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<DateRange | undefined>(() =>
    rangoGuardado
      ? { from: deClaveDeDia(rangoGuardado.desde), to: deClaveDeDia(rangoGuardado.hasta) }
      : undefined,
  );

  const rango = rangoDePeriodo(periodo, new Date(), rangoGuardado);

  function aplicar() {
    if (!borrador?.from) return;
    const hasta = borrador.to ?? borrador.from;
    setPeriodo("personalizado", { desde: claveDeDia(borrador.from), hasta: claveDeDia(hasta) });
    setAbierto(false);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      <div
        role="group"
        aria-label="Periodo de las estadísticas"
        className="grid w-full grid-cols-4 gap-0.5 rounded-full border border-border bg-nata p-1 sm:inline-flex sm:w-auto"
      >
        {BOTONES.map((id) => {
          const activo = periodo === id;
          const esFechas = id === "personalizado";
          // En un móvil de 390 px "Esta semana" parte la palabra en dos líneas;
          // el nombre corto cabe y significa lo mismo. Las fechas exactas no se
          // meten en el botón (se truncarían a "1 sep…"): viven en la línea de
          // abajo, que está siempre visible.
          const contenido = esFechas ? (
            <>
              <CalendarDays className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
              <span className="truncate"><span className="sm:hidden">Fechas</span><span className="hidden sm:inline">Personalizado</span></span>
            </>
          ) : (
            <>
              <span className="sm:hidden">{ETIQUETA_CORTA[id]}</span>
              <span className="hidden sm:inline">{ETIQUETA_PERIODO[id]}</span>
            </>
          );
          const clases = cn(
            // 44 px de alto: el mínimo para tocar sin fallar con el iPad en la mano.
            "flex h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-bold transition-colors sm:px-[15px] [@media(pointer:coarse)]:h-11",
            activo
              ? "bg-card text-foreground shadow-[0_1px_3px_rgba(59,47,42,0.12)]"
              : "text-cafe-medio hover:text-foreground",
          );

          if (!esFechas) {
            return (
              <button
                key={id}
                type="button"
                aria-pressed={activo}
                onClick={() => setPeriodo(id)}
                className={clases}
              >
                {contenido}
              </button>
            );
          }
          return (
            <Popover key={id} open={abierto} onOpenChange={setAbierto}>
              <PopoverTrigger asChild>
                <button type="button" aria-pressed={activo} className={clases}>
                  {contenido}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-auto max-w-[min(22rem,calc(100vw-1.5rem))] p-0"
              >
                <Calendar
                  mode="range"
                  locale={es}
                  weekStartsOn={1}
                  numberOfMonths={1}
                  defaultMonth={borrador?.from ?? new Date()}
                  selected={borrador}
                  onSelect={setBorrador}
                  // Celdas grandes: el calendario por defecto es de ratón.
                  className="[--cell-size:2.75rem]"
                />
                <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {borrador?.from
                      ? `${textoRango({
                          inicio: borrador.from,
                          fin: new Date(+(borrador.to ?? borrador.from) + 86_400_000),
                        })}`
                      : "Toca el primer día y luego el último."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-11 shrink-0 px-4"
                    disabled={!borrador?.from}
                    onClick={aplicar}
                  >
                    <Check className="mr-1 h-4 w-4" aria-hidden="true" />
                    Ver
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      <p className="text-[12.5px] text-muted-foreground" aria-live="polite">
        Estás viendo <strong className="font-bold text-foreground">{textoRango(rango)}</strong>
      </p>
    </div>
  );
}
