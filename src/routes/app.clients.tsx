import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { clientFrequency } from "@/lib/derive";
import type { Client } from "@/lib/mock/types";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ClientAvatar } from "@/components/ClientAvatar";
import { ClientHistorySheet } from "@/components/ClientHistorySheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { eur } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Users, UserPlus, Repeat, UserX, Search } from "lucide-react";

export const Route = createFileRoute("/app/clients")({ component: Clients });

const DAY_MS = 86400_000;
/** Sin visita en más de 60 días se trata como "en riesgo" de perderlo. */
const INACTIVE_DAYS = 60;
/** 3 o más visitas ya es un patrón, no una casualidad. */
const REGULAR_VISITS = 3;
/** "Nuevo" mientras el alta tenga menos de un mes. */
const NEW_DAYS = 30;

type ClientTag = "nuevo" | "habitual" | "inactivo" | "activo";

const TAG_CONFIG: Record<ClientTag, { label: string; className: string }> = {
  nuevo: { label: "Nuevo", className: "bg-primary/10 text-primary" },
  habitual: { label: "Habitual", className: "bg-success/15 text-success" },
  inactivo: { label: "Inactivo", className: "bg-destructive/10 text-destructive" },
  activo: { label: "Activo", className: "bg-muted text-muted-foreground" },
};

type Row = Client & ReturnType<typeof clientFrequency>;

function tagFor(row: Row, now: number): ClientTag {
  const isRecent = now - +new Date(row.createdAt) < NEW_DAYS * DAY_MS;
  // Desde que "última visita" solo cuenta las citas pasadas, un cliente que
  // acaba de reservar para la semana que viene se quedaba sin ninguna: sin
  // esta salida caía en "inactivo", que es justo lo contrario de lo que es.
  if (!row.lastVisit) {
    if (isRecent) return "nuevo";
    return row.nextVisit ? "activo" : "inactivo";
  }
  const daysSinceLast = (now - +new Date(row.lastVisit)) / DAY_MS;
  if (daysSinceLast > INACTIVE_DAYS) return "inactivo";
  if (row.pastVisits >= REGULAR_VISITS) return "habitual";
  if (isRecent) return "nuevo";
  return "activo";
}

function TagPill({ tag }: { tag: ClientTag }) {
  const cfg = TAG_CONFIG[tag];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

function Clients() {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const [selected, setSelected] = useState<Client | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | ClientTag | "penalizado">("todos");

  const now = Date.now();

  // El recorte va DESPUÉS de buscar: al revés, el buscador solo miraría dentro
  // de los 40 primeros. Y ya no se esconde a quien no tiene visitas todavía:
  // un cliente recién dado de alta también hay que poder encontrarlo.
  const allRows: (Row & { tag: ClientTag })[] = clients
    .map((c) => ({ ...c, ...clientFrequency(appointments, c.id) }))
    .map((r) => ({ ...r, tag: tagFor(r, now) }));

  const kpis = {
    total: allRows.length,
    nuevos: allRows.filter((r) => now - +new Date(r.createdAt) < NEW_DAYS * DAY_MS).length,
    habituales: allRows.filter((r) => r.tag === "habitual").length,
    enRiesgo: allRows.filter((r) => r.tag === "inactivo").length,
  };

  // Aparte de si es barato: solo se ofrece el filtro cuando hay a quién
  // filtrar — una pestaña "Con penalización" vacía es ruido en cualquier
  // demo que no tenga la política de plantón activa.
  const hayPenalizados = allRows.some((r) => (r.penaltyEur ?? 0) > 0);

  const termino = busqueda.trim().toLowerCase();
  const rows = allRows
    .filter((c) =>
      filtro === "todos" ? true : filtro === "penalizado" ? (c.penaltyEur ?? 0) > 0 : c.tag === filtro,
    )
    .filter((c) =>
      termino === ""
        ? true
        : [c.name, c.phone, c.email ?? ""].some((campo) => campo.toLowerCase().includes(termino)),
    )
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 60);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Tu cartera de clientes, ordenada por valor de vida."
      />

      {/* KPIs — panorama de la cartera antes de bajar al listado. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={Users} label="Clientes totales" value={kpis.total} />
        <StatTile icon={UserPlus} label="Nuevos este mes" value={kpis.nuevos} tone="primary" />
        <StatTile icon={Repeat} label="Recurrentes" value={kpis.habituales} tone="success" />
        <StatTile
          icon={UserX}
          label="En riesgo"
          value={kpis.enRiesgo}
          tone={kpis.enRiesgo > 0 ? "destructive" : "default"}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email…"
            className="pl-9"
          />
        </div>

        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="nuevo">Nuevos</TabsTrigger>
            <TabsTrigger value="habitual">Habituales</TabsTrigger>
            <TabsTrigger value="inactivo">Inactivos</TabsTrigger>
            {hayPenalizados && <TabsTrigger value="penalizado">Con penalización</TabsTrigger>}
          </TabsList>
        </Tabs>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card">
          <EmptyState
            icon={Users}
            title="Ningún cliente coincide"
            description="Prueba con otro término de búsqueda o quita el filtro."
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Visitas</TableHead>
                  <TableHead>Servicio favorito</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead>Próxima cita</TableHead>
                  <TableHead className="text-right">Gasto total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {rows.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <ClientAvatar name={c.name} size="sm" />
                        <span className="truncate">{c.name}</span>
                        {(c.penaltyEur ?? 0) > 0 && (
                          <Badge variant="destructive" className="shrink-0 text-[10px]">
                            Debe {eur(c.penaltyEur!)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                    <TableCell>{c.pastVisits}</TableCell>
                    <TableCell className="text-muted-foreground">{c.favoriteService}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lastVisit
                        ? new Date(c.lastVisit).toLocaleDateString("es", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    {/* "Próxima cita" existe porque hasta ahora era lo que
                        enseñaba "Última visita" sin decirlo: el dato hacía
                        falta, solo que en su propia columna. */}
                    <TableCell className="text-muted-foreground">
                      {c.nextVisit
                        ? new Date(c.nextVisit).toLocaleDateString("es", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">€{c.totalSpent}</TableCell>
                    <TableCell>
                      <TagPill tag={c.tag} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile stacked cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-4 text-left"
              >
                <ClientAvatar name={c.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{c.name}</p>
                    <span className="shrink-0 font-medium">€{c.totalSpent}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {c.pastVisits} {c.pastVisits === 1 ? "visita" : "visitas"} · {c.favoriteService} ·{" "}
                    {c.phone}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Última visita:{" "}
                    {c.lastVisit
                      ? new Date(c.lastVisit).toLocaleDateString("es", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                    {" · Próxima: "}
                    {c.nextVisit
                      ? new Date(c.nextVisit).toLocaleDateString("es", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <TagPill tag={c.tag} />
                    {(c.penaltyEur ?? 0) > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        Debe {eur(c.penaltyEur!)}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <ClientHistorySheet
        client={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone?: "default" | "primary" | "success" | "destructive";
}) {
  const toneClasses = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card p-4">
      <div className={cn("flex size-8 items-center justify-center rounded-full", toneClasses)}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 font-display text-2xl tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
