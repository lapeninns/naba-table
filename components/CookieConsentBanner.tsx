'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

const CONSENT_COOKIE = 'nat_consent';
type ConsentValue = 'granted' | 'denied';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return null;
}

function writeConsent(value: ConsentValue): void {
  const maxAgeSeconds = 180 * 24 * 60 * 60;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const cookie = [
    `${CONSENT_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'SameSite=Lax',
    secure ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ');

  document.cookie = cookie;
}

export function CookieConsentBanner() {
  const initial = useMemo(() => readCookie(CONSENT_COOKIE), []);
  const [consent, setConsent] = useState<string | null>(initial);

  useEffect(() => {
    setConsent(readCookie(CONSENT_COOKIE));
  }, []);

  if (consent === 'granted' || consent === 'denied') {
    return null;
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4"
      role="region"
      aria-label="Cookie preferences"
    >
      <div className="mx-auto max-w-3xl">
        <Card className="border-muted-foreground/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm leading-relaxed">
              We use analytics cookies (Plausible and PostHog) to understand usage and improve the
              product. You can accept or decline non-essential cookies.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Read more in our{' '}
              <Link className="underline underline-offset-4" href="/privacy">
                privacy policy
              </Link>
              .
            </p>
          </CardContent>
          <CardFooter className="gap-2 p-4 pt-0 sm:p-5 sm:pt-0">
            <Button
              type="button"
              onClick={() => {
                writeConsent('denied');
                setConsent('denied');
                window.location.reload();
              }}
              variant="outline"
            >
              Decline
            </Button>
            <Button
              type="button"
              onClick={() => {
                writeConsent('granted');
                setConsent('granted');
                window.location.reload();
              }}
            >
              Accept
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
