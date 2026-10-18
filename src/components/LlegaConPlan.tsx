import { useEffect, useState } from "react";
import {
  ArchiveRestore,
  BarChart3,
  Bot,
  Download,
  FileSpreadsheet,
  Landmark,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Upload,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { FUNCIONES_POR_PLAN, NOMBRE_PLAN, QUE_ES, resumenPlanSuperior, type FuncionPlan } from "@/lib/plan";
import { useEsDemo, usePlanSalon } from "@/lib/accesos-panel";
import { useSalonStore } from "@/lib/store";
import { esVistaCliente, useVistaDemo } from "@/lib/vista-demo";
import { descartarFuncionPlan, destacarFuncionPlan } from "@/lib/plan-descubrimiento";
import { enlaceCorreo } from "@/lib/sishow-web";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const ICONOS: Record<FuncionPlan, LucideIcon> = {
  asistente: Bot,
  "roles-ampliados": UsersRound,
  "historial-completo": ArchiveRestore,
  "campanas-ampliadas": Megaphone,
  "analitica-avanzada": BarChart3,
  exportar: FileSpreadsheet,
  "senal-liberacion-automatica": ShieldCheck,
  "importacion-mensual": Upload,
  "caja-exportar": Download,
  "caja-cierre": Landmark,
};

/** localStorage sin romper si el navegador lo bloquea. */
export function duradero(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Demo enseñada a un prospecto (con selector de plan): ahí no hay avisos destacados. */
function useEsProspecto() {
  const esDemo = useEsDemo();
  const slug = useSalonStore((s) => s.salonProfile.slug);
  const vista = useVistaDemo((s) => s.vista);
  return esDemo && !esVistaCliente(slug, vista);
}

function useEsMovil() {
  const [movil, setMovil] = useState(true);
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 639px)");
    const actualizar = () => setMovil(consulta.matches);
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);
  return movil;
}

/** Miniatura 100 % estática: nunca recibe ni lee datos de la cuenta. */
export function VistaPreviaFuncionPlan({ funcion, className }: { funcion: FuncionPlan; className?: string }) {
  const ejemplo = QUE_ES[funcion].ejemplo;
  return (
    <div
      role="group"
      className={cn("overflow-hidden rounded-xl border border-lino bg-blanco", className)}
      aria-label={`Ejemplo de ${QUE_ES[funcion].titulo.toLowerCase()}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-lino bg-beige/70 px-3 py-2">
        <p className="truncate text-[12px] font-bold text-cafe-medio">{ejemplo.titulo}</p>
        <span className="shrink-0 rounded-full bg-arena px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-cafe-medio">Ejemplo</span>
      </div>
      <dl className="divide-y divide-lino px-3">
        {ejemplo.filas.map((fila) => (
          <div key={fila.etiqueta} className="flex items-baseline justify-between gap-3 py-2 text-[12.5px]">
            <dt className="min-w-0 text-cafe-suave">{fila.etiqueta}</dt>
            <dd className="shrink-0 text-right font-extrabold tabular-nums text-cafe">{fila.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ContenidoHoja({ funcion, onAhoraNo }: { funcion: FuncionPlan; onAhoraNo: () => void }) {
  const plan = FUNCIONES_POR_PLAN[funcion];
  const { titulo, texto } = QUE_ES[funcion];
  const asunto = `siShow · ${titulo}`;
  const cuerpo = `Hola, me interesa ${titulo.toLowerCase()} (plan ${NOMBRE_PLAN[plan]}). ¿Me contáis cómo funciona?`;
  return (
    <div className="space-y-4 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-salvia-suave text-hoja-tinta">
          <Sparkles className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[12.5px] font-bold text-hoja-tinta">Plan {NOMBRE_PLAN[plan]}</p>
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-cafe">{titulo}</h2>
        </div>
      </div>
      <p className="text-[14px] leading-snug text-cafe-medio">{texto}</p>
      <VistaPreviaFuncionPlan funcion={funcion} />
      <p className="text-[13px] font-bold text-cafe-medio">Para tenerla, escríbenos y lo vemos.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onAhoraNo} className="rounded-full font-bold">
          Ahora no
        </Button>
        <Button asChild className="rounded-full px-5 font-bold">
          <a href={enlaceCorreo(asunto, cuerpo)}>Quiero saber más</a>
        </Button>
      </div>
    </div>
  );
}

/** Hoja inferior en móvil y diálogo centrado en escritorio. */
export function HojaFuncionPlan({ funcion, abierto, onCerrar }: { funcion: FuncionPlan; abierto: boolean; onCerrar: () => void }) {
  const movil = useEsMovil();
  if (movil) {
    return (
      <Drawer open={abierto} onOpenChange={(s) => !s && onCerrar()}>
        <DrawerContent className="max-h-[88dvh] overflow-y-auto rounded-t-[20px] border-lino bg-card">
          <DrawerTitle className="sr-only">{QUE_ES[funcion].titulo}</DrawerTitle>
          <DrawerDescription className="sr-only">Información del plan {NOMBRE_PLAN[FUNCIONES_POR_PLAN[funcion]]}</DrawerDescription>
          <ContenidoHoja funcion={funcion} onAhoraNo={onCerrar} />
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={abierto} onOpenChange={(s) => !s && onCerrar()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto rounded-[20px] border-lino bg-card p-0 shadow-[0_24px_60px_rgba(59,47,42,.25)]">
        <DialogTitle className="sr-only">{QUE_ES[funcion].titulo}</DialogTitle>
        <DialogDescription className="sr-only">Información del plan {NOMBRE_PLAN[FUNCIONES_POR_PLAN[funcion]]}</DialogDescription>
        <ContenidoHoja funcion={funcion} onAhoraNo={onCerrar} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tarjeta discreta en el contexto natural de una función no incluida. La
 * miniatura es de ejemplo; no toca la store salvo para saber si es una demo.
 */
export function LlegaConPlan({ funcion, compacta = false, className }: { funcion: FuncionPlan; compacta?: boolean; className?: string }) {
  const esDemo = useEsProspecto();
  const [abierto, setAbierto] = useState(false);
  const [destacada, setDestacada] = useState(false);
  const plan = FUNCIONES_POR_PLAN[funcion];
  const { titulo, texto } = QUE_ES[funcion];
  const Icono = ICONOS[funcion];

  useEffect(() => {
    if (esDemo || typeof window === "undefined") return;
    setDestacada(destacarFuncionPlan(funcion, window.sessionStorage, duradero()));
  }, [esDemo, funcion]);

  function cerrar() {
    if (typeof window !== "undefined") descartarFuncionPlan(funcion, window.sessionStorage, duradero());
    setDestacada(false);
    setAbierto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "group w-full overflow-hidden rounded-[20px] border border-lino bg-card text-left transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-salvia hover:shadow-[0_12px_32px_rgba(59,47,42,.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          destacada && "border-dashed border-moca",
          compacta ? "p-4" : "p-5",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nata text-cafe-medio group-hover:bg-salvia-suave group-hover:text-hoja-tinta">
            <Icono className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] font-extrabold tracking-[-0.01em] text-cafe">{titulo}</span>
              <span className="rounded-full bg-arena px-2.5 py-0.5 text-[11.5px] font-bold text-cafe-medio">Plan {NOMBRE_PLAN[plan]}</span>
              {destacada && <span className="rounded-full bg-salvia-suave px-2 py-0.5 text-[11px] font-bold text-hoja-tinta">Para conocer</span>}
            </span>
            <span className="mt-1 block text-[13.5px] leading-snug text-cafe-medio">{texto}</span>
          </span>
        </div>
        <VistaPreviaFuncionPlan funcion={funcion} className="mt-3" />
      </button>
      <HojaFuncionPlan funcion={funcion} abierto={abierto} onCerrar={cerrar} />
    </>
  );
}

/**
 * Un único resumen, sobrio, de lo que añade el plan superior: tres filas con
 * su insignia. Pulsar una abre la misma hoja con el ejemplo. Si el salón ya
 * tiene todo, no se pinta.
 */
export function ResumenPlanSuperior({ className }: { className?: string }) {
  const plan = usePlanSalon();
  const funciones = resumenPlanSuperior(plan);
  const [abierta, setAbierta] = useState<FuncionPlan | null>(null);
  if (funciones.length === 0) return null;
  const siguiente = NOMBRE_PLAN[FUNCIONES_POR_PLAN[funciones[0]]];
  return (
    <section className={cn("overflow-hidden rounded-[20px] border border-lino bg-card", className)} aria-label={`Lo que añade el plan ${siguiente}`}>
      <h2 className="px-5 pt-4 text-[16px] font-extrabold tracking-[-0.01em] text-cafe">Lo que añade el plan {siguiente}</h2>
      <ul className="mt-2 divide-y divide-lino">
        {funciones.map((funcion) => {
          const Icono = ICONOS[funcion];
          return (
            <li key={funcion}>
              <button type="button" onClick={() => setAbierta(funcion)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-beige/50">
                <Icono className="mt-0.5 size-[18px] shrink-0 text-cafe-medio" strokeWidth={1.6} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-extrabold text-cafe">{QUE_ES[funcion].titulo}</span>
                  <span className="block text-[13px] leading-snug text-cafe-medio">{QUE_ES[funcion].texto}</span>
                </span>
                <span className="shrink-0 rounded-full bg-arena px-2 py-0.5 text-[10.5px] font-bold text-cafe-medio">{NOMBRE_PLAN[FUNCIONES_POR_PLAN[funcion]]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {abierta && <HojaFuncionPlan funcion={abierta} abierto onCerrar={() => setAbierta(null)} />}
    </section>
  );
}
