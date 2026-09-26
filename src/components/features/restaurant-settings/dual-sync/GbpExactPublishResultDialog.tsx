import { CircleHelp } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { GbpPublishOutcomeBadge } from './GbpPublishOutcomeBadge';
import { describeGbpPublishOutcome, hasUnknownGbpPublishOutcome } from './gbpPublishOutcomeDomain';

import type { GbpPublishResponseV1 } from '@/services/ops/dual-sync';

export function GbpExactPublishResultDialog({
  open,
  result,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly result: GbpPublishResponseV1 | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const hasUnknown = hasUnknownGbpPublishOutcome(result);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86dvh] max-w-2xl overflow-y-auto">
        <DialogHeader className="pr-12 sm:pr-0">
          <DialogTitle>
            {result?.mode === 'queued' ? 'Google publish queued' : 'Google publish outcome'}
          </DialogTitle>
          <DialogDescription>
            Queued is not complete, and an unknown provider outcome is never treated as success.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3">
            {hasUnknown ? (
              <Alert variant="warning">
                <CircleHelp className="size-4" aria-hidden />
                <AlertTitle>Provider outcome unknown</AlertTitle>
                <AlertDescription>
                  Refresh Google state, verify the listing, and create a new preview before any
                  retry. The in-app outcome remains available; verify the operational notification
                  channel.
                </AlertDescription>
              </Alert>
            ) : null}
            {result.mode === 'immediate' ? (
              <ul className="flex flex-col divide-y divide-border/60">
                {result.outcomes.map((outcome) => (
                  <li
                    key={outcome.groupId}
                    className="flex flex-col gap-1 py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{outcome.groupId}</span>
                      <GbpPublishOutcomeBadge status={outcome.status} />
                    </span>
                    <span>{describeGbpPublishOutcome(outcome.status).detail}</span>
                    <span className="text-xs text-muted-foreground">
                      Reason code <span className="font-mono">{outcome.reasonCode}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">
                The publish is queued. Follow job{' '}
                <span className="font-mono text-xs">{result.jobId}</span> for Google’s final
                outcome.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono font-normal">
                bundle {result.bundleId}
              </Badge>
              {result.mode === 'queued' ? (
                <Badge variant="outline" className="font-mono font-normal">
                  job {result.jobId}
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Back to review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
