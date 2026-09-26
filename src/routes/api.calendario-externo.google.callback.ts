import { soloMetodos } from "@/lib/api/metodos";
import { createFileRoute } from "@tanstack/react-router";
import { completarConexionGoogle } from "@/lib/calendario-externo/calendario-externo.server";

/**
 * Vuelta del consentimiento de Google (navegación real del navegador, no una
 * función de servidor: por eso no hay `conSesion` aquí — la autorización de
 * quién puede conectar qué ya se comprobó al emitir el `state`, en
 * `iniciarConexionGoogle`, y viaja firmada dentro de él. Ver
 * docs/contrato-calendarios.md §2.
 */
function redirigir(salonSlug: string | undefined, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...(salonSlug ? { s: salonSlug } : {}), ...params }).toString();
  return new Response(null, { status: 302, headers: { Location: `/app/settings?${qs}`, "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/calendario-externo/google/callback")({
  server: {
    handlers: soloMetodos({
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const errorGoogle = params.get("error");
        if (errorGoogle) {
          // El usuario ha cancelado el consentimiento en Google, o Google ha
          // rechazado la petición antes de llegar a nuestro servidor.
          return redirigir(undefined, { calendario: "error", motivo: "Se ha cancelado la conexión con Google." });
        }
        const code = params.get("code");
        const state = params.get("state");
        if (!code || !state) return redirigir(undefined, { calendario: "error", motivo: "Falta código o estado en la respuesta de Google." });

        const resultado = await completarConexionGoogle(code, state);
        if (!resultado.ok) return redirigir(resultado.salonSlug, { calendario: "error", motivo: resultado.error ?? "No se ha podido completar la conexión." });
        return redirigir(resultado.salonSlug, { calendario: "ok" });
      },
    }),
  },
});
