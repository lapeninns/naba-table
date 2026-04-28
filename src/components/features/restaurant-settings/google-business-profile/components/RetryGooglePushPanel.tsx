'use client';

import { RefreshCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { formatGbpDateTime } from '../lib/formatters';
import { formatWorkflowStatus, workflowStatusVariant } from '../lib/sync-review';

import type { GoogleBusinessProfileActivePublishJob } from '@/services/ops/restaurants';

type RetryGooglePushPanelProps = {
  activePublishJob: GoogleBusinessProfileActivePublishJob | null;
  onRetry: () => void;
  isRetryPending?: boolean;
};

export function RetryGooglePushPanel({
  activePublishJob,
  onRetry,
  isRetryPending = false,
}: RetryGooglePushPanelProps) {
  if (!activePublishJob) {
    return null;
  }

  const hasGoogleDirection = activePublishJob.directionIntent !== 'google_to_nabatable';
  if (!hasGoogleDirection) {
    return null;
  }

  return (
    <Card className="border-border/70">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Retry Google update</CardTitle>
          <Badge variant={workflowStatusVariant(activePublishJob.status)}>
            {formatWorkflowStatus(activePublishJob.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Direction</p>
            <p className="mt-2 text-sm font-medium text-foreground">Nabatable → Google</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Google fields
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {activePublishJob.googleUpdateMasks.length > 0
                ? activePublishJob.googleUpdateMasks.join(', ')
                : 'No Google fields selected'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last update</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formatGbpDateTime(activePublishJob.updatedAt) ?? activePublishJob.updatedAt}
            </p>
          </div>
        </div>

        {activePublishJob.canRetryGooglePush ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Retry the Google update</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nabatable changes were already prepared. Use password confirmation to retry Google
                only.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              disabled={isRetryPending}
              data-testid="gbp-retry-google-push-button"
            >
              <RefreshCcw className={isRetryPending ? 'mr-2 size-4 animate-spin' : 'mr-2 size-4'} />
              {isRetryPending ? 'Retrying…' : 'Retry Google update'}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
            {activePublishJob.retryBlockedReason ?? 'Retry is not available for this update.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
