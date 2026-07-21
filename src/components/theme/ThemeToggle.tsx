'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useColorMode } from '@/components/theme/useColorMode';
import { Button } from '@/components/ui/button';

/**
 * Light/dark toggle. Renders a stable placeholder until mounted so the
 * server-rendered (always-light) markup and the client agree — the actual
 * icon depends on the persisted preference, which is only known client-side.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggle } = useColorMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggle}
      aria-label={mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle color mode'}
      aria-pressed={mounted ? isDark : undefined}
    >
      {mounted && isDark ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </Button>
  );
}
