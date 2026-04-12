/**
 * Shared tonal background for guest-facing layouts.
 * Mirrors the Luminous Precision surface hierarchy instead of the older saturated preset.
 */
export function GuestBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(249,249,252,0.96)_0%,rgba(243,243,246,0.84)_48%,rgba(249,249,252,1)_100%)]" />
      <div className="absolute left-[-10rem] top-[-8rem] h-[24rem] w-[24rem] rounded-full bg-[rgba(0,64,161,0.08)] blur-[96px]" />
      <div className="absolute right-[-12rem] top-[8rem] h-[28rem] w-[28rem] rounded-full bg-[rgba(0,86,210,0.08)] blur-[110px]" />
      <div className="absolute bottom-[-16rem] left-1/4 h-[34rem] w-[34rem] rounded-full bg-[rgba(26,28,30,0.05)] blur-[120px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/50" />
    </div>
  );
}
