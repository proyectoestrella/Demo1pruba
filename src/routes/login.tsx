import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock, ArrowLeft, Loader2 } from "lucide-react";
import { salon } from "@/lib/mock/salon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: `Acceso peluquero · ${salon.name}` }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("manuela@losmosqueteros.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.includes("@") || password.length < 6) {
      setError("Introduce un email válido y una contraseña de al menos 6 caracteres.");
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
            <div className="h-8 w-8 rounded-full bg-primary" />
            <div className="leading-tight">
              <p className="font-display text-base">{salon.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Atelier de peluquería</p>
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
              <h1 className="font-display text-xl">Acceso peluquero</h1>
              <p className="text-xs text-muted-foreground">Entra al panel de gestión del salón</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
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

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Las credenciales de demo ya están rellenadas. Pulsa &ldquo;Entrar al panel&rdquo; para continuar.
          </p>
        </div>
      </main>
    </div>
  );
}
