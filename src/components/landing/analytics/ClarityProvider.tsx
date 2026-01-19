'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

export function ClarityProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (!CLARITY_PROJECT_ID || typeof window === 'undefined') return;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;

    const head = document.getElementsByTagName('head')[0];
    if (head) {
      head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!CLARITY_PROJECT_ID || typeof window === 'undefined') return;

    if (window.clarity) {
      window.clarity('set', 'page', pathname);
    }
  }, [pathname]);

  return null;
}

declare global {
  interface Window {
    clarity?: (action: string, ...args: unknown[]) => void;
  }
}
