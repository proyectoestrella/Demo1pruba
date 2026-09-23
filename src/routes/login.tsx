import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { salon } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import { useSesion, pedirEnlaceMagico } from "@/lib/sesion";
import { esSalonRealPublico } from "@/lib/api/salons.functions";
import { BUSINESS_LABEL, inferBusinessType, professionalWord } from "@/lib/business-type";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => {
    const profile = useSalonStore.getState().salonProfile;
    const tipo = inferBusinessType(profile.tagline, profile.name);
    return { meta: [{ title: `Acceso ${professionalWord(tipo)} · ${profile.name}` }] };
  },
  component: LoginPage,
});

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
  const profile = useSalonStore((s) => s.salonProfile);
  const demoActive = useSalonStore((s) => s.demoActive);
  const salonName = profile.name;
  const tipo = inferBusinessType(profile.tagline, profile.name);

  // El salón del que se quiere el panel: el de `?s=` si viene, si no el que ya
  // hubiera en este navegador. Es el mismo orden que usa /app.
  const desdeUrl = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.s,
  });
  const slug = (typeof desdeUrl === "string" && desdeUrl ? desdeUrl : profile.slug) || undefined;
  const esReal = useEsSalonReal(slug);

  const { correo: sesionDe } = useSesion();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Ya hay sesión: no tiene sentido volver a pedirla. Al panel.
  useEffect(() => {
    if (sesionDe) void navigate({ to: "/app" });
  }, [sesionDe, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.includes("@") || !email.includes(".")) {
      setError("Escribe tu correo completo, con la arroba y el punto.");
      return;
    }
    setEnviando(true);
    const volverA = `${window.location.origin}/app${slug ? `?s=${encodeURIComponent(slug)}` : ""}`;
    const res = await pedirEnlaceMagico(email, volverA);
    setEnviando(false);
    if (!res.ok) {
      setError(res.motivo);
      return;
    }
    setEnviado(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/s/$salonSlug" params={{ salonSlug: salon.slug }} className="flex items-center gap-2">
            <Logo />
            <div className="leading-tight">
              <p className="font-display text-base">{salonName}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {BUSINESS_LABEL[tipo]}
              </p>
            </div>
          </Link>
          <Link
            to="/s/$salonSlug"
            params={{ salonSlug: salon.slug }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Volver al sitio
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md flex-col justify-center px-5 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h1 className="font-display text-xl">Acceso {professionalWord(tipo)}</h1>
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

          {enviado ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <MailCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <p className="font-medium">Mira tu correo</p>
                <p className="text-sm text-muted-foreground">
                  Te hemos enviado un enlace a <span className="font-medium">{email}</span>. Ábrelo
                  desde este mismo dispositivo y entrarás directo, sin contraseña.
                </p>
                <p className="text-xs text-muted-foreground">
                  Si no lo ves en un par de minutos, mira en la carpeta de correo no deseado.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-lg"
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
                  Te mandamos un enlace y entras pinchándolo. Aquí no hay contraseñas que recordar.
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={enviando} className="w-full rounded-lg">
                {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {enviando ? "Enviando…" : "Enviarme el enlace"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
