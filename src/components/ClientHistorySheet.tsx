import { useSalonStore } from "@/lib/store";
import { clientFrequency } from "@/lib/derive";
import { serviceMap, employeeMap } from "@/lib/mock/salon";
import type { Client } from "@/lib/mock/types";
import { StylistDot } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CalendarX } from "lucide-react";

export interface ClientHistorySheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Client history drawer: visits, spend and favorite service (DESIGN-DIRECTION, RECON §6 app.clients). */
export function ClientHistorySheet({ client, open, onOpenChange }: ClientHistorySheetProps) {
  const appointments = useSalonStore((s) => s.appointments);
  const stats = client ? clientFrequency(appointments, client.id) : null;
  const history = client
    ? appointments
        .filter((a) => a.clientId === client.id)
        .sort((a, b) => +new Date(b.start) - +new Date(a.start))
    : [];

  return (
    <Sheet open={open && !!client} onOpenChange={onOpenChange}>
      {client && stats && (
        <SheetContent className="flex flex-col gap-6 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{client.name}</SheetTitle>
            <SheetDescription>{client.phone}{client.email ? ` · ${client.email}` : ""}</SheetDescription>
          </SheetHeader>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
              <p className="font-display text-xl">{stats.visits}</p>
              <p className="text-xs text-muted-foreground">Visitas</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
              <p className="font-display text-xl">€{stats.totalSpent}</p>
              <p className="text-xs text-muted-foreground">Gasto total</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
              <p className="truncate font-display text-xl">{stats.favoriteService ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Favorito</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Historial de citas</p>
            {history.length === 0 ? (
              <EmptyState icon={CalendarX} title="Sin citas todavía" description="Este cliente aún no tiene reservas registradas." />
            ) : (
              <div className="divide-y divide-border/60">
                {history.map((a) => {
                  const svc = serviceMap[a.serviceId];
                  const emp = employeeMap[a.employeeId];
                  return (
                    <div key={a.id} className="flex items-center gap-3 py-3 text-sm">
                      <div className="w-16 shrink-0 text-xs text-muted-foreground">
                        {new Date(a.start).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                      </div>
                      <StylistDot employeeId={a.employeeId} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{svc?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">con {emp?.name}</p>
                      </div>
                      <span className="text-sm font-medium">€{a.priceEur}</span>
                      <StatusBadge status={a.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
