import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { aceptarInvitacionAlSalon } from "@/lib/api/accesos.functions";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/**
 * Vuelta del correo de invitación al panel (lote 11): `/aceptar?s=<slug>&inv=<id>`.
 * Conectado (ensayo de fusión 2): al montar se llama a
 * `aceptarInvitacionAlSalon` (tras el enlace mágico ya hay sesión) y, si
 * responde bien, se entra en `/app?s=<slug>` con su rol.
 */
export const Route = createFileRoute("/aceptar")({
  validateSearch: (s: Record<string, unknown>): { s?: string; inv?: string } => ({
    s: typeof s.s === "string" ? s.s : undefined,
    inv: typeof s.inv === "string" ? s.inv : undefined,
  }),
  head: () => ({ meta: [{ title: "Entrar en el panel · siShow" }] }),
  component: Aceptar,
});

function Aceptar() {
  const { s: slug, inv } = Route.useSearch();
  const completo = !!slug && !!inv;
  const [estado, setEstado] = useState<{ fase: "comprobando" } | { fase: "ok" } | { fase: "error"; motivo: string }>({ fase: "comprobando" });
  useEffect(() => {
    if (!completo) return;
    let vivo = true;
    aceptarInvitacionAlSalon({ data: { slug: slug!, invitacionId: inv! } })
      .then((r) => vivo && setEstado(r.ok ? { fase: "ok" } : { fase: "error", motivo: r.motivo }))
      .catch(() => vivo && setEstado({ fase: "error", motivo: "No hemos podido comprobar la invitación. Vuelve a abrir el enlace del correo." }));
    return () => {
      vivo = false;
    };
  }, [completo, slug, inv]);
  const valida = completo && estado.fase === "ok";
  if (completo && estado.fase === "comprobando") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <p className="text-[14.5px] text-cafe-medio">Comprobando tu invitación…</p>
      </main>
    );
  }
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-3xl border border-lino bg-card px-6 py-8 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto mt-6 grid size-12 place-items-center rounded-full bg-salvia-suave text-hoja-tinta">
          <MailCheck className="size-5" strokeWidth={1.7} aria-hidden="true" />
        </span>
        {valida ? (
          <>
            <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.01em]">Ya tienes acceso al panel</h1>
            <p className="mt-2 text-[14.5px] text-cafe-medio">Tu salón te ha invitado a siShow. Entra y verás tu agenda.</p>
            <Button asChild className="mt-6 w-full rounded-full font-bold">
              <Link to="/app" search={{ s: slug } as never}>
                Entrar al panel
              </Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.01em]">{completo ? "No hemos podido darte acceso" : "Este enlace no está completo"}</h1>
            <p className="mt-2 text-[14.5px] text-cafe-medio">
              {estado.fase === "error" ? estado.motivo : "Ábrelo desde el correo de invitación o pide a tu salón que te lo reenvíe."}
            </p>
            <Button asChild variant="outline" className="mt-6 w-full rounded-full font-bold">
              <Link to="/login">Ir al acceso</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
