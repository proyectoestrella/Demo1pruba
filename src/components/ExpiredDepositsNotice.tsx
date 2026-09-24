import type { Appointment } from "@/lib/mock/types";
import { depositState, deadlineHours } from "@/lib/deposit-deadline";
import { useClientNow } from "@/lib/use-client-now";
import { useSalonStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function ExpiredDepositsNotice({ onOpenDetail }: { onOpenDetail: (appointment: Appointment) => void }) {
  const appointments = useSalonStore((s) => s.appointments);
  const hours = useSalonStore((s) => deadlineHours(s.salonProfile.depositDeadlineHours));
  const now = useClientNow();
  if (!now) return null;
  const expired = appointments.filter((a) => depositState(a, now, hours) === "expired");
  if (!expired.length) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
    <p className="font-medium text-destructive">{expired.length} {expired.length === 1 ? "señal vencida" : "señales vencidas"}</p>
    <Button size="sm" variant="outline" onClick={() => onOpenDetail(expired[0])}>Ver cita</Button>
  </div>;
}
