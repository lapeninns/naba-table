'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/typography';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[settings] render error', error);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-background px-4 py-16 text-center">
      <div className="space-y-2">
        <Text variant="eyebrow">Settings</Text>
        <Heading variant="section" as="h1">
          Something went wrong
        </Heading>
        <Text variant="caption">
          Settings failed to load. Retry or return to dashboard.
        </Text>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Retry</Button>
        <Button asChild variant="outline">
          <Link href="/app">Go to dashboard</Link>
        </Button>
      </div>
      {process.env.NODE_ENV !== 'production' && error?.digest ? (
        <Text variant="caption">Error ID: {error.digest}</Text>
      ) : null}
    </div>
  );
}
