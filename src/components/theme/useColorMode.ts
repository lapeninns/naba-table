'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Color mode (light/dark) — orthogonal to the surface theme (guest/app).
 *
 * The FOUC-free initial application happens in the inline bootstrap script in
 * `src/app/layout.tsx`; this hook keeps the `.dark` class in sync afterwards,
 * persists the choice, follows the OS when set to 'system', and syncs across
 * tabs. Default (no stored preference) is light — dark is opt-in.
 */
export type ColorMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nabatable-color-mode';

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function readStoredMode(): ColorMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* localStorage unavailable (private mode, etc.) — fall through */
  }
  return 'light';
}

function resolveDark(mode: ColorMode): boolean {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark());
}

function applyDark(dark: boolean): void {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function useColorMode() {
  const [mode, setModeState] = useState<ColorMode>('light');

  // Hydrate from storage after mount (server render is always light).
  useEffect(() => {
    setModeState(readStoredMode());
  }, []);

  // Apply + persist whenever the mode changes.
  useEffect(() => {
    applyDark(resolveDark(mode));
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  // Follow the OS while in 'system' mode.
  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyDark(resolveDark('system'));
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mode]);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setModeState(readStoredMode());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMode = useCallback((next: ColorMode) => setModeState(next), []);
  const toggle = useCallback(
    () => setModeState((prev) => (resolveDark(prev) ? 'light' : 'dark')),
    [],
  );

  return { mode, setMode, toggle, isDark: resolveDark(mode) };
}
