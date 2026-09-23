/** La política de cobro por plantón solo existe si el salón fijó un importe. */
export function recargoActivo(profile: { noShowFeeEur?: number | null }): boolean {
  return (profile.noShowFeeEur ?? 0) > 0;
}
