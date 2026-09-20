import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock, ArrowLeft, Loader2 } from "lucide-react";
import { salon } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
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

function LoginPage() {
  const navigate = useNavigate();
  const profile = useSalonStore((s) => s.salonProfile);
  const demoActive = useSalonStore((s) => s.demoActive);
  const salonName = profile.name;
  const tipo = inferBusinessType(profile.tagline, profile.name);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.includes("@") || password.length < 6) {
      setError("Introduce un correo válido y una contraseña de al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      navigate({ to: "/app" });
    }, 600);
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

          {/* Se ha abierto un enlace de demo en este navegador: se ofrece entrar
              directo, sin credenciales. Es el respaldo del fallo del botón
              "Acceso barbero" que ayer no respondió en el iPad — el formulario
              de abajo sigue funcionando exactamente igual, esto es un añadido. */}
          {demoActive && (
            <div className="mb-6 space-y-3">
              <Button
                type="button"
                onClick={() => navigate({ to: "/app" })}
                className="w-full rounded-lg py-6 text-base"
              >
                Entrar como {salonName}
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                o con tu contraseña
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full rounded-lg">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? "Accediendo…" : "Entrar al panel"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
