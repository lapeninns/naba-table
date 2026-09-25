import { CheckCircle2, CircleHelp, CircleSlash, XCircle, type LucideIcon } from 'lucide-react';

import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';

import { describeGbpPublishOutcome, type GbpPublishOutcomeStatus } from './gbpPublishOutcomeDomain';

const TONE_ICON: Record<ReturnType<typeof describeGbpPublishOutcome>['tone'], LucideIcon> = {
  success: CheckCircle2,
  danger: XCircle,
  warning: CircleHelp,
  muted: CircleSlash,
};

export function GbpPublishOutcomeBadge({ status }: { readonly status: GbpPublishOutcomeStatus }) {
  const outcome = describeGbpPublishOutcome(status);
  return (
    <OpsStatusBadge tone={outcome.tone} icon={TONE_ICON[outcome.tone]} label={outcome.label} />
  );
}
