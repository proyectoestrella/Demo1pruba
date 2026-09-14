import { cn } from "@/lib/utils";

export interface ComingSoonActionProps {
  label: string;
  className?: string;
}

/**
 * Disabled call-to-action for features that don't do anything yet (no backend
 * behind them). Visibly inert + labeled, so nobody clicks expecting a result.
 * Sin la etiqueta "Próximamente": en una demo delante del cliente solo restaba.
 */
export function ComingSoonAction({ label, className }: ComingSoonActionProps) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className={cn(
        "mt-5 inline-flex w-fit cursor-default items-center rounded-full border border-border bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {label}
    </button>
  );
}
