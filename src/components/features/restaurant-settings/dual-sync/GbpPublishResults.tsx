import { CircleHelp } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

import { GbpPublishOutcomeBadge } from './GbpPublishOutcomeBadge';
import { describeGbpPublishOutcome, hasUnknownGbpPublishOutcome } from './gbpPublishOutcomeDomain';

import type { GbpPublishResponseV1 } from '@/services/ops/dual-sync';

/**
 * "Publish results" on the page: what Google confirmed for the last exact publish in this
 * session. It is kept after the result dialog closes, and an unknown outcome is never shown as
 * success.
 */
export function GbpPublishResults({ result }: { readonly result: GbpPublishResponseV1 | null }) {
  return (
    <Card
      variant="compact"
      role="region"
      aria-labelledby="gbp-publish-results-heading"
      data-testid="gbp-publish-results"
      className="min-w-0 border-border/70 shadow-none"
    >
      <CardHeader className="gap-1 px-4 py-4 sm:px-5">
        <h2
          id="gbp-publish-results-heading"
          className="text-base font-semibold leading-6 text-foreground"
        >
          Publish results
        </h2>
        <CardDescription>
          What Google confirmed. An unknown outcome is never shown as success.
        </CardDescription>
      </CardHeader>
      <CardContent
        aria-live="polite"
        className="flex flex-col gap-3 border-t border-border/60 px-4 py-4 sm:px-5"
      >
        {!result ? (
          <p className="text-sm text-muted-foreground">No publishes yet in this session.</p>
        ) : result.mode === 'queued' ? (
          <p className="text-sm">
            Queued, not complete. Follow job{' '}
            <span className="font-mono text-xs">{result.jobId}</span> under Write controls and
            evidence for Google’s final outcome.
          </p>
        ) : (
          <>
            {hasUnknownGbpPublishOutcome(result) ? (
              <Alert variant="warning">
                <CircleHelp className="size-4" aria-hidden />
                <AlertTitle>Google did not confirm every change</AlertTitle>
                <AlertDescription>
                  Get the latest from Google and check the listing before publishing again. The
                  affected differences stay listed until then.
                </AlertDescription>
              </Alert>
            ) : null}
            <ul className="flex flex-col divide-y divide-border/60">
              {result.outcomes.map((outcome) => (
                <li key={outcome.groupId} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-foreground">{outcome.groupId}</span>
                    <GbpPublishOutcomeBadge status={outcome.status} />
                  </span>
                  <span className="text-sm">
                    {describeGbpPublishOutcome(outcome.status).detail}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Reason code <span className="font-mono">{outcome.reasonCode}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {result ? (
          <p className="font-mono text-xs text-muted-foreground">Bundle {result.bundleId}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
