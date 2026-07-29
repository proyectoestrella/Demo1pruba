import { cn } from "@/lib/utils";

export interface ComingSoonActionProps {
  label: string;
  className?: string;
}

/**
 * Disabled call-to-action for features that don't do anything yet (no backend
 * behind them). Visibly inert + labeled, so nobody clicks expecting a result.
 * Mirrors the tone of the "Próximamente" WhatsApp block on the Marketing page.
 */
export function ComingSoonAction({ label, className }: ComingSoonActionProps) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Próximamente"
      className={cn(
        "mt-5 inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-dashed border-border bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {label}
      <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
        Próximamente
      </span>
    </button>
  );
}
