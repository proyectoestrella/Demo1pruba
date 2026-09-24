import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelPublicLink } from "@/lib/panel-public-link";

export function ViewSwitcher({ mode }: { mode: "client" | "dashboard" }) {
  const publicLink = usePanelPublicLink();
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition";
  const active = "bg-foreground text-background shadow-sm";
  const inactive = "text-muted-foreground hover:text-foreground";

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
      <a
        href={publicLink}
        className={cn(base, mode === "client" ? active : inactive)}
      >
        <Globe className="h-3 w-3" />
        Cliente
      </a>
      <Link to="/app" className={cn(base, mode === "dashboard" ? active : inactive)}>
        <LayoutDashboard className="h-3 w-3" />
        Panel
      </Link>
    </div>
  );
}
