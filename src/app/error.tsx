'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <main className="flex min-h-screen min-h-[100svh] flex-col items-center justify-center bg-background px-6 py-24 text-center">
          <Card className="mx-auto w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-3xl">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              We couldn’t load this page. Please try again.
            </CardContent>
            <CardFooter className="flex justify-center gap-3">
              <Button type="button" onClick={() => reset()}>
                Try again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/guest/dashboard">Go to Dashboard</Link>
              </Button>
            </CardFooter>
            {process.env.NODE_ENV !== 'production' && error?.digest && (
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Error ID: {error.digest}
              </CardContent>
            )}
          </Card>
        </main>
      </body>
    </html>
  );
}
