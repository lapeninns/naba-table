/**
 * Shared Radix Luma background for guest-facing layouts.
 */
export function GuestBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(20,71,230,0.08),transparent_28rem),radial-gradient(circle_at_88%_10%,rgba(9,9,11,0.04),transparent_24rem)]" />

      <div className="pg-noise-overlay absolute inset-0 opacity-[0.018]" />
    </div>
  );
}
