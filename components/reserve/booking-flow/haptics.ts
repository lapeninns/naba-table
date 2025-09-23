export function triggerSubtleHaptic(pattern: number | number[] = 8) {
  if (typeof window === "undefined") return;
  const vibrate = typeof navigator !== "undefined" ? navigator.vibrate?.bind(navigator) : undefined;
  if (vibrate) {
    try {
      vibrate(pattern);
      return;
    } catch {
      // fall through to animation fallback
    }
  }

  if (typeof document === "undefined") return;
  try {
    document.body?.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(0.995)", opacity: 0.98 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 140, easing: "ease-out" },
    );
  } catch {
    // ignore - animation APIs not supported
  }
}
