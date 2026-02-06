'use client';

import { useEffect } from 'react';

type Shortcut = {
  key: string; // lowercase key
  /**
   * Treat Cmd (macOS) and Ctrl (Windows/Linux) as the primary modifier.
   * Useful for cross-platform shortcuts like "primary action" or "save".
   */
  metaOrCtrl?: boolean;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
  when?: () => boolean; // scope predicate
  allowRepeat?: boolean;
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
        if (event.repeat && shortcut.allowRepeat !== true) return;

        const wantsMetaOrCtrl = shortcut.metaOrCtrl === true;
        const wantsMeta = shortcut.meta === true;
        const wantsCtrl = shortcut.ctrl === true;
        const wantsShift = shortcut.shift === true;
        const wantsAlt = shortcut.alt === true;

        const hasMeta = event.metaKey;
        const hasCtrl = event.ctrlKey;
        const hasShift = event.shiftKey;
        const hasAlt = event.altKey;

        if (wantsMetaOrCtrl) {
          // Cross-platform primary modifier: Cmd on macOS, Ctrl elsewhere.
          if (!hasMeta && !hasCtrl) return;
        } else {
          // Exact matching for meta/ctrl unless metaOrCtrl is used.
          if (wantsMeta && !hasMeta) return;
          if (wantsCtrl && !hasCtrl) return;
          if (!wantsMeta && hasMeta) return;
          if (!wantsCtrl && hasCtrl) return;
        }

        // Exact matching for shift/alt to avoid collisions.
        if (wantsShift && !hasShift) return;
        if (!wantsShift && hasShift) return;
        if (wantsAlt && !hasAlt) return;
        if (!wantsAlt && hasAlt) return;

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
