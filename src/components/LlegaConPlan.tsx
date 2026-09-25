import { useState } from "react";
import { Sparkles } from "lucide-react";
import { FUNCIONES_POR_PLAN, NOMBRE_PLAN, PLANES, QUE_ES, incluye, type FuncionPlan } from "@/lib/plan";
import { useSalonStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CORREO = "ejemplo@sishow.com";

/**
 * Lo que el plan del salón no incluye (lote 13): qué es, con qué plan llega
 * y cómo pedirlo. Nunca un botón roto ni un pago desde el panel: «Quiero
 * probarlo» escribe al equipo de siShow con el mensaje preparado.
 */
export function LlegaConPlan({ funcion, compacta = false, className }: { funcion: FuncionPlan; compacta?: boolean; className?: string }) {
  const salon = useSalonStore((s) => s.salonProfile.name);
  const [verPlanes, setVerPlanes] = useState(false);
  const plan = FUNCIONES_POR_PLAN[funcion];
  const { titulo, texto, plural } = QUE_ES[funcion];
  const mensaje = `Hola, soy de ${salon}. Me interesa ${titulo.toLowerCase()} (plan ${NOMBRE_PLAN[plan]}). ¿Me contáis cómo probarlo?`;
  return (
    <div className={cn("rounded-3xl border border-salvia bg-salvia-suave text-left", compacta ? "px-4 py-3.5" : "px-6 py-6", className)}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-hoja-tinta">
        <Sparkles className="size-4" strokeWidth={1.7} aria-hidden="true" /> Plan {NOMBRE_PLAN[plan]}
      </p>
      <h2 className={cn("mt-1 font-extrabold tracking-[-0.01em] text-foreground", compacta ? "text-[16px]" : "text-[21px]")}>
        {titulo} {plural ? "llegan" : "llega"} con el plan {NOMBRE_PLAN[plan]}
      </h2>
      <p className="mt-1.5 max-w-prose text-[14px] leading-snug text-cafe-medio">{texto}</p>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button asChild className="rounded-full px-5 font-bold">
          <a href={`mailto:${CORREO}?subject=${encodeURIComponent(`siShow · ${titulo}`)}&body=${encodeURIComponent(mensaje)}`}>Quiero probarlo</a>
        </Button>
        <button type="button" onClick={() => setVerPlanes((v) => !v)} aria-expanded={verPlanes} className="px-2 text-[13.5px] font-bold text-hoja-tinta hover:underline">
          Qué incluye cada plan
        </button>
      </div>
      {verPlanes && (
        <ul className="mt-3 space-y-2 border-t border-salvia pt-3 text-[13.5px]">
          {PLANES.map((p) => (
            <li key={p}>
              <b className={cn(p === plan && "text-hoja-tinta")}>{NOMBRE_PLAN[p]}</b>
              <span className="text-cafe-medio">
                {" · "}
                {p === "reservas"
                  ? "agenda, clientas, tu página de reservas, señal, avisos por WhatsApp y el aviso de 10 s para deshacer"
                  : incluye(p).map((f) => QUE_ES[f].titulo.toLowerCase()).join(", ")}
                {p !== "reservas" ? ", y todo lo del plan anterior" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
