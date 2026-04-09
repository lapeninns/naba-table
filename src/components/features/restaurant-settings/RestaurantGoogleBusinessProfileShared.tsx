import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type {
  RestaurantGoogleBusinessProfileChangeSummary,
  RestaurantGoogleBusinessProfileConnection,
  RestaurantGoogleBusinessProfileConnectionStatus,
  RestaurantGoogleBusinessProfileMediaItem,
  RestaurantGoogleBusinessProfileReviewSnippet,
  RestaurantGoogleBusinessProfileSyncFamily,
  RestaurantGoogleBusinessProfileSyncHistoryEvent,
} from '@/lib/restaurants/google-business-profile';
import type { ReactNode } from 'react';

export function buildLocationValue(accountId: string, locationId: string) {
  return `${accountId}::${locationId}`;
}

export function parseLocationValue(value: string) {
  const [accountId, locationId] = value.split('::');
  return {
    accountId: accountId ?? '',
    locationId: locationId ?? '',
  };
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

export function statusLabel(status: RestaurantGoogleBusinessProfileConnectionStatus | 'loading') {
  switch (status) {
    case 'synced':
      return 'Synced';
    case 'partial':
      return 'Partially synced';
    case 'needs_location':
      return 'Needs location';
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Attention needed';
    case 'loading':
      return 'Loading';
    default:
      return 'Not connected';
  }
}

function changeKindBadgeVariant(kind: 'added' | 'removed' | 'updated') {
  switch (kind) {
    case 'added':
      return 'default';
    case 'removed':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function ChangeSummarySection({
  summary,
}: {
  summary: RestaurantGoogleBusinessProfileChangeSummary | null;
}) {
  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground">
        No sync diff is available yet. Run a successful sync to establish a comparison baseline.
      </p>
    );
  }

  if (!summary.hasBaseline) {
    return (
      <p className="text-sm text-muted-foreground">
        This is the first successful sync for the current snapshot, so it establishes the baseline for future change detection.
      </p>
    );
  }

  if (summary.totalChanges === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No differences were detected between the latest sync and the previous synced snapshot.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{summary.totalChanges} changes detected</Badge>
        <p className="text-xs text-muted-foreground">
          Compared {formatDateTime(summary.generatedAt) ?? 'just now'}
        </p>
      </div>

      {summary.highlights.map((change) => (
        <div key={change.key} className="rounded-lg border border-border/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{change.label}</p>
            <Badge variant={changeKindBadgeVariant(change.kind)}>{change.kind}</Badge>
            <Badge variant="outline">{change.family}</Badge>
          </div>
          <div className="mt-2 space-y-2 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Previous</p>
              <p className="text-muted-foreground">{change.before ?? 'Not present'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest</p>
              <p className="text-foreground">{change.after ?? 'Removed'}</p>
            </div>
          </div>
        </div>
      ))}

      {summary.remainingChanges > 0 ? (
        <p className="text-sm text-muted-foreground">
          {summary.remainingChanges} more changes were captured in the latest sync.
        </p>
      ) : null}
    </div>
  );
}

export function statusBadgeVariant(status: RestaurantGoogleBusinessProfileConnectionStatus | 'loading') {
  switch (status) {
    case 'synced':
      return 'default';
    case 'partial':
    case 'needs_location':
      return 'outline';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function familyBadgeVariant(family: RestaurantGoogleBusinessProfileSyncFamily) {
  switch (family.status) {
    case 'success':
      return 'default';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function syncHistoryBadgeVariant(event: RestaurantGoogleBusinessProfileSyncHistoryEvent) {
  switch (event.status) {
    case 'success':
      return 'default';
    case 'partial':
      return 'outline';
    default:
      return 'destructive';
  }
}

export function SectionPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DetailList({
  items,
}: {
  items: Array<{ label: string; value: string | null | undefined }>;
}) {
  const visibleItems = items.filter((item) => item.value);

  if (visibleItems.length === 0) {
    return <p className="text-sm text-muted-foreground">No data imported yet.</p>;
  }

  return (
    <dl className="space-y-3 text-sm">
      {visibleItems.map((item) => (
        <div key={item.label} className="space-y-1">
          <dt className="font-medium text-foreground">{item.label}</dt>
          <dd className="text-muted-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewsList({ reviews }: { reviews: RestaurantGoogleBusinessProfileReviewSnippet[] }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent review snippets were returned for this location.</p>;
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div key={review.reviewId} className="rounded-lg border border-border/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {review.reviewerDisplayName ? <span>{review.reviewerDisplayName}</span> : null}
            {review.starRating ? <Badge variant="outline">{review.starRating}</Badge> : null}
            {review.updateTime ? <span>{formatDateTime(review.updateTime)}</span> : null}
          </div>
          <p className="mt-2 text-sm text-foreground">{review.comment ?? 'No review text provided.'}</p>
        </div>
      ))}
    </div>
  );
}

export function MediaList({ media }: { media: RestaurantGoogleBusinessProfileMediaItem[] }) {
  if (media.length === 0) {
    return <p className="text-sm text-muted-foreground">No media items were returned for this location.</p>;
  }

  return (
    <div className="space-y-3">
      {media.map((item) => (
        <div key={item.name} className="rounded-lg border border-border/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{item.description ?? item.name}</p>
            {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
            {item.format ? <Badge variant="outline">{item.format}</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {item.googleUrl ? (
              <a
                href={item.googleUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Open asset
              </a>
            ) : null}
            {item.thumbnailUrl ? (
              <a
                href={item.thumbnailUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Open thumbnail
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SyncHealthSection({
  connection,
}: {
  connection: RestaurantGoogleBusinessProfileConnection;
}) {
  if (connection.syncFamilies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sync run has completed yet. Connect a location and run a manual sync to populate family diagnostics.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {connection.syncFamilies.map((family) => (
        <div key={family.key} className="rounded-lg border border-border/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">{family.label}</p>
              <p className="text-xs text-muted-foreground">
                {family.updatedAt ? `Updated ${formatDateTime(family.updatedAt)}` : 'Not attempted yet'}
              </p>
            </div>
            <Badge variant={familyBadgeVariant(family)}>{family.status}</Badge>
          </div>
          {family.error ? <p className="mt-2 text-sm text-muted-foreground">{family.error}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function SyncHistoryTimeline({
  history,
}: {
  history: RestaurantGoogleBusinessProfileSyncHistoryEvent[];
}) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sync runs are recorded yet. The history timeline will fill in after the first manual sync completes.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((event) => (
        <div key={event.id} className="rounded-lg border border-border/60 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {event.locationTitle ?? event.accountName ?? 'Google Business Profile sync'}
              </p>
              <p className="text-xs text-muted-foreground">
                Started {formatDateTime(event.startedAt)}
                {event.completedAt ? ` • Completed ${formatDateTime(event.completedAt)}` : ''}
              </p>
            </div>
            <Badge variant={syncHistoryBadgeVariant(event)}>{event.status}</Badge>
          </div>

          {event.locationName || event.accountName ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {[event.accountName, event.locationName].filter(Boolean).join(' • ')}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {event.syncFamilies.map((family) => (
              <Badge key={`${event.id}-${family.key}`} variant={familyBadgeVariant(family)}>
                {family.label}: {family.status}
              </Badge>
            ))}
          </div>

          {event.error ? <p className="mt-2 text-sm text-muted-foreground">{event.error}</p> : null}
        </div>
      ))}
    </div>
  );
}
