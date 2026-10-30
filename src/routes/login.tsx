import { hostActual } from "@/lib/host-actual";
import { aceptarMisInvitaciones } from "@/lib/api/accesos.functions";
import { cerrarSesion } from "@/lib/sesion";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lock, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { accesoConReintento } from "@/lib/acceso-con-reintento";
import { haySesionLocal, refrescarSesion } from "@/lib/supabase-browser";
import { useSesion, pedirEnlaceMagico, verificarCodigo } from "@/lib/sesion";
import { esSalonRealPublico, accesoAlPanel } from "@/lib/api/salons.functions";
import { BUSINESS_LABEL, inferBusinessType } from "@/lib/business-type";
import { IconoSiShow } from "@/components/MarcaSiShow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  manifestDelAcceso,
  perfilInicialDeAcceso,
  slugDeAcceso,
  terminoProfesionalDeAcceso,
  volverAlSitio,
} from "@/lib/identidad-acceso";
import { useIdentidadAcceso } from "@/lib/use-identidad-acceso";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { s?: string } => ({
    s: typeof search.s === "string" && search.s ? search.s : undefined,
  }),
  head: ({ match }) => {
    const guardado = useSalonStore.getState().salonProfile;
    const slug = slugDeAcceso({
      slugDesdeUrl: (match.search as Record<string, unknown>)?.s,
      hostname: hostActual(),
      slugGuardado: guardado.slug,
    });
    const profile = perfilInicialDeAcceso(slug, guardado);
    return {
      meta: [
        {
          title: `Acceso ${terminoProfesionalDeAcceso(profile)} · ${profile.name}`,
        },
      ],
      links: [
        {
          rel: "manifest",
          href: manifestDelAcceso(slug),
        },
      ],
    };
  },
  component: LoginPage,
});

/** Supabase permite códigos de 6 a 10 cifras; el proyecto envía 8. Al llegar a 8 se comprueba sola. */
const CODIGO_MIN = 6;
const CODIGO_MAX = 10;
const CODIGO_AUTO = 8;

/**
 * ¿Este salón es de pago, o es una demo de venta?
 *
 * Lo decide el SERVIDOR mirando si hay fila en `salons`, nunca el navegador.
 * Mientras no se sabe, se devuelve `null` y la pantalla no ofrece ningún
 * atajo: en la duda, se pide el correo.
 */

function useEsSalonReal(slug: string | undefined): boolean | null {
  const [real, setReal] = useState<boolean | null>(null);
  useEffect(() => {
    if (!slug) {
      setReal(false);
      return;
    }
    let vivo = true;
    esSalonRealPublico({ data: { slug } })
      .then((r) => {
        if (vivo) setReal(r.real);
      })
      // Si no se puede preguntar, se trata como demo: es el comportamiento de
      // siempre y no abre nada, porque el servidor vuelve a comprobarlo antes
      // de entregar un solo dato.
      .catch(() => {
        if (vivo) setReal(false);
      });
    return () => {
      vivo = false;
    };
  }, [slug]);
  return real;
}

function LoginPage() {
  const navigate = useNavigate();
  const demoActive = useSalonStore((s) => s.demoActive);

  // El salón del que se quiere el panel: el de `?s=` si viene, si no el que ya
  // hubiera en este navegador. Es el mismo orden que usa /app.
  const desdeUrl = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.s,
  });
  const slugGuardado = useSalonStore((s) => s.salonProfile.slug);
  const slug = slugDeAcceso({ slugDesdeUrl: desdeUrl, hostname: hostActual(), slugGuardado });
  const profile = useIdentidadAcceso(slug);
  const salonName = profile.name;
  const tipo = inferBusinessType(profile.tagline, profile.name);
  const terminoProfesional = terminoProfesionalDeAcceso(profile);
  const sitioSalon = volverAlSitio(slug, hostActual());
  const esReal = useEsSalonReal(slug);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `Acceso ${terminoProfesional} · ${salonName}`;
    }
  }, [salonName, terminoProfesional]);

  const { correo: sesionDe } = useSesion();

  const [codigo, setCodigo] = useState("");
  const verificando = useRef(false);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Código aceptado: la sesión ya existe y solo falta cruzar al panel. Mientras
  // tanto la pantalla no se toca (ni formulario, ni error) para que no parpadee.
  const [entrando, setEntrando] = useState(false);

  // Ya hay sesión: no tiene sentido volver a pedirla. Al panel.
  useEffect(() => {
    if (!sesionDe || !slug) return;
    let vivo = true;
    setEntrando(true);
    aceptarMisInvitaciones({ data: { slug } })
      .then(() => accesoConReintento(() => accesoAlPanel({ data: { slug } }), refrescarSesion, haySesionLocal))
      .then((r) => {
        if (!vivo) return;
        if (r.permitido) window.location.replace(`/app?s=${encodeURIComponent(slug)}`);
        else {
          setEntrando(false);
          setSinAcceso(true);
        }
      })
      .catch(() => {
        if (!vivo) return;
        setEntrando(false);
        setError("No se pudo comprobar tu acceso. Vuelve a intentarlo.");
      });
    return () => {
      vivo = false;
    };
  }, [sesionDe, slug]);

  const comprobarCodigo = async (valor: string) => {
    if (verificando.current || entrando || valor.length < CODIGO_MIN) return;
    verificando.current = true;
    setEnviando(true);
    setError("");
    const r = await verificarCodigo(email, valor);
    if (r.ok) {
      // Se queda "Entrando…" y el bloqueo puesto: la redirección la hace el
      // efecto de la sesión, una sola vez.
      setEntrando(true);
      return;
    }
    setError(r.motivo);
    setEnviando(false);
    verificando.current = false;
  };

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!email.includes("@") || !email.includes(".")) {
      setError("Escribe tu correo completo, con la arroba y el punto.");
      return;
    }
    setEnviando(true);
    const volverA = `${window.location.origin}/app${slug ? `?s=${encodeURIComponent(slug)}` : ""}`;
    const res = await pedirEnlaceMagico(email, volverA).catch(() => ({
      ok: false as const,
      motivo: "No hemos podido conectar. Inténtalo otra vez.",
    }));
    setEnviando(false);
    if (!res.ok) {
      setError(res.motivo);
      return;
    }
    setCodigo("");
    setEnviado(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gutter-x pt-[calc(16px+var(--seguro-arriba))] pb-4">
          <a href={sitioSalon} className="flex items-center gap-2">
            {profile.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt={`Logo de ${salonName}`}
                className="h-9 w-9 rounded-full border border-border bg-white object-cover"
              />
            ) : (
              <IconoSiShow size={36} />
            )}
            <div className="leading-tight">
              <p className="font-display text-base">{salonName}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {BUSINESS_LABEL[tipo]}
              </p>
            </div>
          </a>
          <a
            href={sitioSalon}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Volver al sitio
          </a>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-[calc(28rem+2*var(--gutter))] flex-col justify-center gutter-x py-6 sm:py-12">
        <div className="rounded-2xl border border-border bg-card relleno-tarjeta shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h1 className="font-display text-xl">Acceso {terminoProfesional}</h1>
              <p className="text-xs text-muted-foreground">Entra al panel de gestión del salón</p>
            </div>
          </div>

          {/* Atajo SOLO para las demos de venta: un salón que no existe en la
              base de datos no tiene nada que proteger, y una demo que pida
              credenciales en mitad de la calle es una venta perdida. En un
              salón de pago (`esReal`) este botón NO aparece, y aunque
              apareciera no serviría de nada: el servidor no entrega ni una
              cita sin comprobar antes quién llama. */}
          {demoActive && esReal === false && (
            <div className="mb-6 space-y-3">
              <Button
                type="button"
                onClick={() => navigate({ to: "/app" })}
                className="w-full rounded-lg py-6 text-base"
              >
                Entrar como {salonName}
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />o con tu correo
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          {sinAcceso ? (
            <div className="space-y-3">
              <p role="alert">
                Este correo no tiene acceso a este salón. Pide a María que te dé acceso.
              </p>
              <Button variant="outline" onClick={() => void cerrarSesion()}>
                Usar otro correo
              </Button>
            </div>
          ) : enviado ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <MailCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <p className="font-medium">Mira tu correo</p>
                <p className="text-sm text-muted-foreground">
                  Te hemos enviado un código y un enlace a{" "}
                  <span className="font-medium">{email}</span>. Escribe aquí el código o abre
                  el enlace, sin contraseña.
                </p>
                <p className="text-xs text-muted-foreground">
                  Si no lo ves en un par de minutos, mira en la carpeta de correo no deseado.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void comprobarCodigo(codigo);
                }}
                className="space-y-3"
              >
                <Label htmlFor="codigo">Código del correo</Label>
                <Input
                  id="codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,10}"
                  maxLength={CODIGO_MAX}
                  autoFocus
                  className="h-16 text-center text-3xl tracking-[0.25em]"
                  value={codigo}
                  disabled={enviando || entrando}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/\D/g, "").slice(0, CODIGO_MAX);
                    setCodigo(valor);
                    if (valor.length === CODIGO_AUTO) void comprobarCodigo(valor);
                  }}
                />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={enviando || entrando || codigo.length < CODIGO_MIN}
                  aria-busy={enviando || entrando}
                >
                  {(enviando || entrando) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {entrando ? "Entrando…" : enviando ? "Comprobando…" : "Entrar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={enviando || entrando}
                  onClick={() => void onSubmit()}
                >
                  Enviar otro
                </Button>
              </form>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-lg"
                disabled={entrando}
                onClick={() => {
                  setEnviado(false);
                  setError("");
                }}
              >
                Usar otro correo
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Tu correo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Te mandamos un código y un enlace en el mismo correo. Aquí no hay contraseñas que
                  recordar.
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={enviando} className="w-full rounded-lg">
                {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {enviando ? "Enviando…" : "Enviar código"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
