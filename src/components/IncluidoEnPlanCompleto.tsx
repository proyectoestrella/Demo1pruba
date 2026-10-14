import { Sparkles } from "lucide-react";

/** Puerta visual única para las rutas que el Básico no contrató. */
export function IncluidoEnPlanCompleto() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center rounded-3xl border border-salvia bg-salvia-suave p-7 text-center">
      <Sparkles className="mx-auto size-8 text-hoja-tinta" strokeWidth={1.6} aria-hidden="true" />
      <p className="mt-4 text-sm font-bold text-hoja-tinta">Plan Completo</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Incluido en el plan Completo</h1>
      <p className="mt-2 text-sm leading-relaxed text-cafe-medio">Esta función no forma parte de tu plan Básico. No mostramos ningún dato de tu salón aquí.</p>
    </section>
  );
}
