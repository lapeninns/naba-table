export function triggerSubtleHaptic(pattern: number | number[] = 8) {
  if (typeof window === "undefined") return;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(pattern);
  } catch {
    // ignore - vibration not supported
  }
}
