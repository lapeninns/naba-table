'use client';

import { toast } from '@/hooks/use-toast';

let redirectInFlight = false;
let lastPath: string | null = null;
let lastToastTs = 0;
const TOAST_DEBOUNCE_MS = 1500;

export function triggerSessionRedirect(path?: string, message?: string) {
  if (typeof window === 'undefined') return;

  const currentPath = path ?? `${window.location.pathname}${window.location.search}`;
  if (!currentPath || currentPath.startsWith('/auth')) return;

  if (redirectInFlight && lastPath === currentPath) return;

  const now = Date.now();
  if (now - lastToastTs > TOAST_DEBOUNCE_MS) {
    toast({
      title: 'Session expired',
      description: message ?? 'Please sign in again to continue.',
      variant: 'destructive',
    });
    lastToastTs = now;
  }

  const target = `/auth/signin?redirectedFrom=${encodeURIComponent(currentPath)}`;
  redirectInFlight = true;
  lastPath = currentPath;
  window.location.assign(target);
}
