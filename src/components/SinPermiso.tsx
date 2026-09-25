import { Link } from "@tanstack/react-router";
import { LockKeyhole, MessageCircle } from "lucide-react";
import { useAccesosDemo, NOMBRE_ROL, type Miembro } from "@/lib/accesos-maqueta";
import { useMiembroActual } from "@/lib/use-permisos";
import { whatsappUrl } from "@/lib/campanas";
import { Button } from "@/components/ui/button";
import type { Rol } from "@/lib/permisos";

const LO_QUE_VES: Record<Rol, string> = {
  gerente: "todo el panel",
  subencargado: "todo menos el dinero del salón, el plan y los accesos",
  recepcion: "la agenda y las clientas de todas",
  estilista: "tu agenda, tus clientas y lo que cobras tú",
};

/**
 * Lo que sale en una sección que el rol no puede ver (lote 11): amable, con
 * quién la lleva y cómo pedir acceso. Nunca un error técnico.
 */
export function SinPermiso({ seccion }: { seccion: string }) {
  const miembro = useMiembroActual();
  const miembros = useAccesosDemo((s) => s.miembros);
  const gerentes = (miembros ?? []).filter((m: Miembro) => m.rol === "gerente" && m.estado === "activa");
  const quien = gerentes.length === 1 ? gerentes[0].displayName : null;
  const rol = miembro?.rol ?? "estilista";
  const pedir = `Hola${quien ? ` ${quien}` : ""}, ¿me das acceso a ${seccion} en siShow?`;
  return (
    <div className="mx-auto mt-10 max-w-md rounded-3xl border border-lino bg-card px-6 py-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-salvia-suave text-hoja-tinta">
        <LockKeyhole className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.01em]">
        {quien ? `Esta parte la lleva ${quien}` : "Esta parte la lleva la gerente del salón"}
      </h1>
      <p className="mt-2 text-[14.5px] leading-snug text-cafe-medio">
        Tu cuenta es de {NOMBRE_ROL[rol].toLowerCase()}: ves {LO_QUE_VES[rol]}.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild className="rounded-full px-5 font-bold">
          <Link to="/app">Ir a Hoy</Link>
        </Button>
        <Button asChild variant="outline" className="gap-2 rounded-full px-5 font-bold">
          <a href={whatsappUrl("", pedir)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Pedir acceso{quien ? ` a ${quien}` : ""}
          </a>
        </Button>
      </div>
    </div>
  );
}
