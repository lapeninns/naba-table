const DEFAULT_GRACE_MINUTES = 10;

function getEnvGraceMinutes(): number {
  const raw = process.env.NEXT_PUBLIC_BOOKING_PENDING_GRACE_MINUTES;
  if (!raw) {
    return DEFAULT_GRACE_MINUTES;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    return DEFAULT_GRACE_MINUTES;
  }
  return Math.max(0, Math.min(parsed, 60));
}

export function getPendingSelfServeGraceMinutes(): number {
  return getEnvGraceMinutes();
}

export function isPendingSelfServeLocked(
  status: string | null | undefined,
  createdAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (status !== 'pending') {
    return false;
  }

  const graceMinutes = getEnvGraceMinutes();
  if (graceMinutes <= 0) {
    return true;
  }

  if (!createdAt) {
    return true;
  }

  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) {
    return true;
  }

  const elapsedMs = now - created;
  return elapsedMs >= graceMinutes * 60_000;
}
