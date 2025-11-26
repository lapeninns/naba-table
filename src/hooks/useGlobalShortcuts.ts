'use client';

import { useEffect } from 'react';

type Shortcut = {
  key: string; // lowercase key
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
  when?: () => boolean; // scope predicate
  handler: (event: KeyboardEvent) => void;
};

/**
 * Register global keyboard shortcuts with optional scoping and default prevention.
 * Examples:
 *  - Cmd/Ctrl+S: { key: 's', meta: true, ctrl: true, preventDefault: true }
 */
export function useGlobalShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    if (!shortcuts || shortcuts.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      shortcuts.forEach((shortcut) => {
        if (shortcut.enabled === false) return;
        if (shortcut.key !== key) return;
        if (shortcut.meta && !event.metaKey) return;
        if (shortcut.ctrl && !event.ctrlKey) return;
        if (shortcut.shift && !event.shiftKey) return;
        if (shortcut.alt && !event.altKey) return;
        if (!shortcut.meta && event.metaKey) return;
        if (!shortcut.ctrl && event.ctrlKey) return;
        if (!shortcut.shift && event.shiftKey) return;
        if (!shortcut.alt && event.altKey) return;
        if (shortcut.when && !shortcut.when()) return;

        if (shortcut.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }
        shortcut.handler(event);
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
