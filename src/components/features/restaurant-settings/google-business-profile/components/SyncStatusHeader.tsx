'use client';

import { ExternalLink, PencilLine, RefreshCcw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { StatusBadge, connectionStatusBadge } from './StatusBadge';
import { formatGbpDateTime } from '../lib/formatters';
import { formatWorkflowStatus, workflowStatusVariant } from '../lib/sync-review';

import type {
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileWorkflow,
} from '@/services/ops/restaurants';

type SyncStatusHeaderProps = {
  connection: GoogleBusinessProfileConnection;
  workflow: GoogleBusinessProfileWorkflow | undefined;
  manageOnGoogleHref: string | null;
  onGenerateDraft: () => void;
  onChangeLocation: () => void;
  isGeneratingDraft: boolean;
  showChangeLocation: boolean;
};

function publishDirectionLabel(directionIntent: string | null | undefined): string {
  switch (directionIntent) {
    case 'google_to_nabatable':
      return 'Google → Nabatable';
    case 'nabatable_to_google':
      return 'Nabatable → Google';
    case 'google_to_nabatable_with_google_sync':
      return 'Google → Nabatable, then Google update';
    default:
      return 'No active update';
  }
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function SyncStatusHeader({
  connection,
  workflow,
  manageOnGoogleHref,
  onGenerateDraft,
  onChangeLocation,
  isGeneratingDraft,
  showChangeLocation,
}: SyncStatusHeaderProps) {
  const connectionBadge = connectionStatusBadge(connection.status);
  const draft = workflow?.latestDraft ?? null;
  const activePublishJob = workflow?.activePublishJob ?? null;
  const lastCheckedAt = draft?.fetchedAt ?? connection.lastPullAt;
  const publishUpdatedAt = activePublishJob?.updatedAt ?? draft?.publishedAt ?? null;

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="gap-4 border-b bg-muted/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">Google profile changes</CardTitle>
              <StatusBadge tone={connectionBadge.tone} label={connectionBadge.label} />
              {draft ? (
                <Badge variant={workflowStatusVariant(draft.status)}>
                  {formatWorkflowStatus(draft.status)}
                </Badge>
              ) : null}
              {activePublishJob ? (
                <Badge variant={workflowStatusVariant(activePublishJob.status)}>
                  {formatWorkflowStatus(activePublishJob.status)}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Review differences between Google Business Profile and Nabatable before applying
                changes.
              </p>
              <p>
                Linked location:{' '}
                <span className="font-medium text-foreground">
                  {connection.externalLocationTitle ?? connection.externalLocationId ?? 'Unknown'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={onGenerateDraft} disabled={isGeneratingDraft}>
              <RefreshCcw
                className={isGeneratingDraft ? 'mr-2 size-4 animate-spin' : 'mr-2 size-4'}
              />
              {isGeneratingDraft ? 'Checking…' : 'Check for changes'}
            </Button>
            {manageOnGoogleHref ? (
              <Button type="button" variant="outline" asChild>
                <a href={manageOnGoogleHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 size-4" />
                  View on Google Maps
                </a>
              </Button>
            ) : null}
            {showChangeLocation ? (
              <Button type="button" variant="ghost" onClick={onChangeLocation}>
                <PencilLine className="mr-2 size-4" />
                Change location
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {connection.status === 'sync_error' && connection.lastError ? (
          <Alert variant="destructive">
            <AlertTitle>Connection needs attention</AlertTitle>
            <AlertDescription>{connection.lastError}</AlertDescription>
          </Alert>
        ) : null}

        {draft?.staleSections.length ? (
          <Alert variant="destructive">
            <AlertTitle>Check for changes again</AlertTitle>
            <AlertDescription>
              These sections changed since the review was prepared: {draft.staleSections.join(', ')}
              .
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Last checked"
            value={formatGbpDateTime(lastCheckedAt) ?? 'Not checked yet'}
            detail="Latest Google profile details compared with Nabatable"
          />
          <MetricCard
            label="Provider timezone"
            value={connection.providerTimezone ?? 'Inherited'}
            detail="Timezone stored from Google when available"
          />
          <MetricCard
            label="Latest review"
            value={draft ? formatWorkflowStatus(draft.status) : 'No review yet'}
            detail={
              draft?.approvedAt
                ? `Reviewed ${formatGbpDateTime(draft.approvedAt)}`
                : 'Check for changes to begin review'
            }
          />
          <MetricCard
            label="Active update"
            value={
              activePublishJob
                ? publishDirectionLabel(activePublishJob.directionIntent)
                : 'No active update'
            }
            detail={
              activePublishJob
                ? `${formatWorkflowStatus(activePublishJob.status)} · ${formatGbpDateTime(publishUpdatedAt) ?? 'No timestamp'}`
                : 'No update in progress'
            }
          />
          <MetricCard
            label="Change history"
            value={`${workflow?.auditEvents.length ?? 0} update${workflow?.auditEvents.length === 1 ? '' : 's'}`}
            detail={workflow?.blockedReasons[0] ?? 'Recent review decisions and results'}
          />
        </div>
      </CardContent>
    </Card>
  );
}
