import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import type { DateRange } from "react-day-picker";
import type { CustomRange, MetricPeriod } from "@/lib/derive";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const OPTIONS: { value: MetricPeriod; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "personalizado", label: "Personalizado" },
];

function formatRange(range: CustomRange | undefined) {
  if (!range) return "Elegir fechas";
  const fmt = (d: Date) => d.toLocaleDateString("es", { day: "2-digit", month: "short" });
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

/**
 * Espejo en JS del breakpoint `sm` de Tailwind (640px). Hace falta para algo
 * más que CSS: el Popover del calendario de escritorio no debe ni MONTARSE
 * en móvil, porque `open` lo abre igual aunque su disparador esté oculto con
 * `sm:hidden` — Radix teleporta el contenido a <body>, ajeno a esa clase, y
 * quedaba flotando encima del calendario propio del móvil (el bug de layout
 * roto a 390px que este hook evita).
 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

export interface PeriodFilterProps {
  value: MetricPeriod;
  onChange: (period: MetricPeriod) => void;
  customRange: CustomRange | undefined;
  onCustomRangeChange: (range: CustomRange) => void;
  className?: string;
}

/**
 * Segmented control (desplegable en móvil) para elegir el periodo de las
 * métricas: Hoy · Esta semana · Este mes · Personalizado. "Personalizado"
 * abre un calendario de rango — el mismo componente que ya usa la reserva
 * pública, sin dependencias nuevas.
 */
export function PeriodFilter({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
  className,
}: PeriodFilterProps) {
  const [draft, setDraft] = useState<DateRange | undefined>(
    customRange ? { from: customRange.from, to: customRange.to } : undefined,
  );
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const handleSelect = (period: MetricPeriod) => {
    onChange(period);
    if (period === "personalizado") setOpen(true);
  };

  /**
   * react-day-picker en modo rango marca `to` = `from` en el primer clic (un
   * rango de un solo día ya es "completo"). Si aplicáramos y cerráramos ahí,
   * nadie llegaría a elegir un segundo día: solo se cierra sobre un clic en
   * "Aplicar", o si el rango ya tenía dos días distintos y se pincha uno
   * nuevo por delante (ampliar/mover el rango sin tener que reabrir).
   */
  const canApply = !!draft?.from && !!draft?.to;

  const applyRange = () => {
    if (draft?.from && draft?.to) {
      onCustomRangeChange({ from: draft.from, to: draft.to });
      setOpen(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-stretch gap-2 sm:flex-row sm:items-center", className)}>
      {/* Desplegable — cabe siempre, incluso a 390px. */}
      <Select value={value} onValueChange={(v) => handleSelect(v as MetricPeriod)}>
        <SelectTrigger className="w-full sm:hidden" aria-label="Periodo de las métricas">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Segmentado — a partir de sm hay sitio de sobra en una fila. */}
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && handleSelect(v as MetricPeriod)}
        className="hidden rounded-lg border border-border/60 bg-card p-0.5 sm:inline-flex"
      >
        {OPTIONS.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            className="rounded-md px-3 py-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {value === "personalizado" && isDesktop && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden shrink-0 gap-1.5 text-xs sm:inline-flex"
            >
              <CalendarRange className="size-3.5" aria-hidden="true" />
              {formatRange(customRange)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={1}
              defaultMonth={customRange?.from}
            />
            <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
              <span className="text-xs text-muted-foreground">
                {draft?.from && draft?.to
                  ? formatRange({ from: draft.from, to: draft.to })
                  : "Elige desde y hasta"}
              </span>
              <Button size="sm" disabled={!canApply} onClick={applyRange}>
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* En móvil, el desplegable de arriba ya eligió "Personalizado": el
          calendario aparece debajo, siempre visible, sin depender del popover
          (que en una fila tan estrecha no tendría hueco donde anclarse). */}
      {value === "personalizado" && !isDesktop && (
        <div className="w-full">
          <div className="mt-1 flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
            <span>{formatRange(customRange)}</span>
          </div>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-card">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={1}
              defaultMonth={customRange?.from}
              className="mx-auto"
            />
            <div className="flex items-center justify-end border-t border-border/60 p-3">
              <Button size="sm" disabled={!canApply} onClick={applyRange} className="w-full">
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
