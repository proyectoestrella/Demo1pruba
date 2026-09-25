import type { Appointment } from "./mock/types";
import { estadoSenal } from "./senal";

export const DEPOSIT_DEADLINE_OPTIONS = [1, 2, 3, 4, 12, 24] as const;
export type DepositDeadlineHours = typeof DEPOSIT_DEADLINE_OPTIONS[number];

export function deadlineHours(value: number | undefined): DepositDeadlineHours {
  return DEPOSIT_DEADLINE_OPTIONS.includes(value as DepositDeadlineHours) ? value as DepositDeadlineHours : 4;
}

export function depositDueAt(requestedAt: string, hours: number): string {
  return new Date(new Date(requestedAt).getTime() + deadlineHours(hours) * 3_600_000).toISOString();
}

export function extendDepositDueAt(dueAt: string, hours: number, now = new Date()): string {
  return new Date(Math.max(new Date(dueAt).getTime(), now.getTime()) + deadlineHours(hours) * 3_600_000).toISOString();
}

export type DepositState = "none" | "requested" | "expired" | "received";

/**
 * Estado resumido para los controles de siempre (pedida / vencida / recibida).
 * Delega en el ciclo de vida completo (lib/senal.ts, `estadoSenal`): una señal
 * ya aplicada, devuelta, retenida o anulada no ofrece esos botones.
 */
export function depositState(
  a: Pick<Appointment, "status" | "depositRequestedAt" | "depositReceivedAt" | "depositDueAt"> &
    Partial<Pick<Appointment, "start" | "priceEur" | "depositStatus" | "depositEur" | "depositPeriodHours">>,
  now = new Date(),
  hours = 4,
): DepositState {
  if (a.status !== "pending" && a.status !== "confirmed") return "none";
  const e = estadoSenal(
    {
      ...a,
      // Sin la hora de la cita no se puede topar el plazo con ella.
      start: a.start ?? "9999-12-31T00:00:00.000Z",
      priceEur: a.priceEur ?? 0,
      depositPeriodHours: a.depositPeriodHours ?? (hours as Appointment["depositPeriodHours"]),
    },
    now,
  );
  return e === "pedida" ? "requested" : e === "vencida" ? "expired" : e === "recibida" ? "received" : "none";
}

export function effectiveDepositDueAt(a: Pick<Appointment, "depositRequestedAt" | "depositDueAt">, hours = 4): string | undefined {
  return a.depositDueAt ?? (a.depositRequestedAt ? depositDueAt(a.depositRequestedAt, hours) : undefined);
}

const MARKER = "[siShow:senal:v1:";

/** TODO: mover `depositDueAt` a columna opcional. Se guarda en `note` hasta aplicar esa migración. */
export function serializeDepositNote(note: string | undefined, deposit: {
  depositDueAt?: string;
  depositPeriodHours?: number;
  depositRequestedAt?: string;
  depositReceivedAt?: string;
  depositEur?: number;
}): string | undefined {
  if (!deposit.depositRequestedAt) return note;
  const value = {
    dueAt: deposit.depositDueAt,
    hours: deadlineHours(deposit.depositPeriodHours),
    requestedAt: deposit.depositRequestedAt,
    receivedAt: deposit.depositReceivedAt,
    eur: deposit.depositEur,
  };
  return `${note?.trim() ?? ""}\n${MARKER}${encodeURIComponent(JSON.stringify(value))}]`.trim();
}

export function parseDepositNote(note: string | null | undefined): {
  note?: string;
  dueAt?: string;
  hours?: DepositDeadlineHours;
  requestedAt?: string;
  receivedAt?: string;
  eur?: number;
} {
  if (!note) return {};
  const marker = note.lastIndexOf(`\n${MARKER}`);
  const start = marker >= 0 ? marker + 1 : note.startsWith(MARKER) ? 0 : -1;
  if (start < 0 || !note.endsWith("]")) return { note };
  try {
    const value = JSON.parse(decodeURIComponent(note.slice(start + MARKER.length, -1))) as {
      dueAt?: string; hours?: number; requestedAt?: string; receivedAt?: string; eur?: number;
    };
    const validDate = (date: string | undefined) => date && Number.isFinite(new Date(date).getTime()) ? date : undefined;
    const dueAt = validDate(value.dueAt);
    const requestedAt = validDate(value.requestedAt);
    if (!requestedAt) return { note };
    return {
      note: note.slice(0, marker >= 0 ? marker : 0).trim() || undefined,
      dueAt,
      hours: deadlineHours(value.hours),
      requestedAt,
      receivedAt: validDate(value.receivedAt),
      eur: typeof value.eur === "number" && Number.isFinite(value.eur) ? value.eur : undefined,
    };
  } catch { return { note }; }
}
