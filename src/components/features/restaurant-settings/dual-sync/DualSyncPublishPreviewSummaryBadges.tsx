import { Badge } from '@/components/ui/badge';

import { buildDualSyncPublishPreviewSummaryBadges } from './dualSyncPublishPreviewDomain';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

interface DualSyncPublishPreviewSummaryBadgesProps {
  readonly plan: Pick<
    DualSyncPublishPlan,
    'acceptedCount' | 'groups' | 'ignoredCount' | 'rejectedCount'
  >;
}

export function DualSyncPublishPreviewSummaryBadges({
  plan,
}: DualSyncPublishPreviewSummaryBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {buildDualSyncPublishPreviewSummaryBadges(plan).map((badge) => (
        <Badge key={badge.id} variant={badge.variant}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
