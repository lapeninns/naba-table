/**
 * Shared Radix Luma background for guest-facing layouts.
 */
export function GuestBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="pg-guest-ambient absolute inset-0" />

      <div className="pg-noise-overlay absolute inset-0 opacity-[0.018]" />
    </div>
  );
}
