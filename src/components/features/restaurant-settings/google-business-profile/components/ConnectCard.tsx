'use client';

import { ShieldCheck, Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ConnectCardProps = {
  connectHref: string;
  isConfigured: boolean;
  isPendingAuth: boolean;
  lastError: string | null;
};

const BENEFITS = [
  'Link exactly one Google Business Profile location to this restaurant.',
  'Keep Nabatable profile, hours, and service periods aligned with Google.',
  'Review drift and open Google directly without leaving the dashboard.',
];

export function ConnectCard({
  connectHref,
  isConfigured,
  isPendingAuth,
  lastError,
}: ConnectCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden />
          Connect Google Business Profile
        </CardTitle>
        <CardDescription>
          Authorize a Google account, then pick the Business Profile location that represents this
          restaurant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {!isConfigured ? (
          <Alert>
            <AlertTitle>Integration not configured</AlertTitle>
            <AlertDescription>
              Google Business Profile credentials are not available in this environment, so the
              OAuth flow is disabled. Ask an administrator to configure the integration to enable
              connect.
            </AlertDescription>
          </Alert>
        ) : null}

        {isPendingAuth ? (
          <Alert>
            <AlertTitle>Waiting on Google</AlertTitle>
            <AlertDescription>
              The authorization handoff is in progress. Finish the Google consent flow in the open
              tab, or start over with Connect Google.
            </AlertDescription>
          </Alert>
        ) : null}

        {lastError ? (
          <Alert variant="destructive">
            <AlertTitle>Last connection attempt failed</AlertTitle>
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        ) : null}

        <div>
          <Button asChild size="lg" disabled={!isConfigured}>
            <a href={connectHref}>Connect Google</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
