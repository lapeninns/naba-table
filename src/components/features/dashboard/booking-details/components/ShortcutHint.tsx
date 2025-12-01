'use client';

import type { ShortcutHintProps } from '../types';

/**
 * Component to display a keyboard shortcut hint
 * Single Responsibility: Render a single shortcut hint
 */
export function ShortcutHint({ keys, description }: ShortcutHintProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
      <div className="flex items-center gap-1">
        {keys.map((keyValue, index) => (
          <span key={keyValue} className="flex items-center gap-1">
            <kbd className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold uppercase text-foreground">
              {keyValue}
            </kbd>
            {index < keys.length - 1 ? (
              <span className="text-xs text-muted-foreground">+</span>
            ) : null}
          </span>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{description}</span>
    </div>
  );
}
