'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  DEFAULT_RUN_SHEET_PREFERENCES,
  parseRunSheetPreferences,
  type RunSheetPreferences,
} from './opsBookingsPrintViewDomain';

export const RUN_SHEET_PREFERENCES_STORAGE_KEY = 'nabatable-run-sheet-v1';

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: RunSheetPreferences = DEFAULT_RUN_SHEET_PREFERENCES;
// Holds the latest value when storage refuses writes (private mode, quota, blocked site data).
let unsavedRaw: string | null = null;

function readRaw(): string | null {
  if (unsavedRaw !== null) return unsavedRaw;
  try {
    return window.localStorage.getItem(RUN_SHEET_PREFERENCES_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): RunSheetPreferences {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    cachedValue = parseRunSheetPreferences(parsed);
  }
  return cachedValue;
}

function getServerSnapshot(): RunSheetPreferences {
  return DEFAULT_RUN_SHEET_PREFERENCES;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === RUN_SHEET_PREFERENCES_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function write(next: RunSheetPreferences) {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(RUN_SHEET_PREFERENCES_STORAGE_KEY, raw);
    unsavedRaw = null;
  } catch {
    // Keep the change for this page view only.
    unsavedRaw = raw;
  }
  listeners.forEach((listener) => listener());
}

/**
 * Run sheet layout preferences for this device. They are stored in localStorage, validated on
 * every read, and shared across tabs. Date, filter, search and sort live in the URL instead,
 * so a link reproduces the same list.
 */
export function useOpsRunSheetPreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback((patch: Partial<RunSheetPreferences>) => {
    const current = getSnapshot();
    write({
      ...current,
      ...patch,
      columns: { ...current.columns, ...patch.columns },
    });
  }, []);

  const reset = useCallback(() => {
    const { view } = getSnapshot();
    write({ ...DEFAULT_RUN_SHEET_PREFERENCES, view });
  }, []);

  return { preferences, update, reset };
}
