import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { clientFrequency } from "@/lib/derive";
import type { Client } from "@/lib/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ClientHistorySheet } from "@/components/ClientHistorySheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";

export const Route = createFileRoute("/app/clients")({ component: Clients });

function Clients() {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const [selected, setSelected] = useState<Client | null>(null);

  const rows = clients
    .map((c) => ({ ...c, ...clientFrequency(appointments, c.id) }))
    .filter((c) => c.visits > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 40);

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" description="Tu cartera de clientes, ordenada por valor de vida." />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card">
          <EmptyState icon={Users} title="Todavía no hay clientes" description="Cuando se reserven citas, aparecerán aquí." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Visitas</TableHead>
                  <TableHead>Favorito</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead className="text-right">Gasto total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {rows.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(c)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                    <TableCell>{c.visits}</TableCell>
                    <TableCell className="text-muted-foreground">{c.favoriteService}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString("es", { month: "short", day: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">€{c.totalSpent}</TableCell>
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
                className="w-full rounded-xl border border-border/60 bg-card p-4 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium">{c.name}</p>
                  <span className="shrink-0 font-medium">€{c.totalSpent}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.visits} visitas · {c.favoriteService} · {c.phone}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      <ClientHistorySheet client={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
