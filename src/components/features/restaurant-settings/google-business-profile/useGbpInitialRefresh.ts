'use client';

import { useEffect, useRef } from 'react';

const FRESH_COMPARISON_MS = 30 * 60_000;

type InitialRefresh = {
  readonly connectionKey: string;
  readonly enabled: boolean;
  readonly checkedAt: string | null;
  readonly refresh: () => void;
};

export function useGbpInitialRefresh({
  connectionKey,
  enabled,
  checkedAt,
  refresh,
}: InitialRefresh) {
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || attempted.current === connectionKey) return;
    attempted.current = connectionKey;
    const checkedMs = checkedAt ? Date.parse(checkedAt) : Number.NaN;
    const age = Date.now() - checkedMs;
    if (Number.isFinite(age) && age >= 0 && age < FRESH_COMPARISON_MS) return;
    refresh();
  }, [checkedAt, connectionKey, enabled, refresh]);
}
