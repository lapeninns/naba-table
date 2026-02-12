'use client';

import { useEffect, useRef, useState } from 'react';

type MinimumDelayOptions = {
  delayMs?: number;
  minDurationMs?: number;
  enabled?: boolean;
};

const DEFAULT_DELAY_MS = 120;
const DEFAULT_MIN_DURATION_MS = 300;

export function useMinimumDelay(isLoading: boolean, options: MinimumDelayOptions = {}): boolean {
  const {
    delayMs = DEFAULT_DELAY_MS,
    minDurationMs = DEFAULT_MIN_DURATION_MS,
    enabled = true,
  } = options;
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const showStartRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      showStartRef.current = isLoading ? Date.now() : null;
      setVisible(isLoading);
      return;
    }

    if (isLoading) {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (visible) return;
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      const delay = Math.max(0, delayMs);
      if (delay === 0) {
        showStartRef.current = Date.now();
        setVisible(true);
        return;
      }

      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        showStartRef.current = Date.now();
        setVisible(true);
      }, delay);
      return;
    }

    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (!visible) {
      showStartRef.current = null;
      return;
    }

    const minDuration = Math.max(0, minDurationMs);
    const showStart = showStartRef.current ?? Date.now();
    const elapsed = Date.now() - showStart;
    const remaining = minDuration - elapsed;
    if (remaining <= 0) {
      showStartRef.current = null;
      setVisible(false);
      return;
    }

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      showStartRef.current = null;
      setVisible(false);
    }, remaining);
  }, [delayMs, enabled, isLoading, minDurationMs, visible]);

  return visible;
}
