import { formatGbpDay } from './formatters';

import type {
  GoogleBusinessProfileDraftItem,
  GoogleBusinessProfileDraftSection,
  GoogleBusinessProfilePublishDirectionIntent,
  GoogleBusinessProfileWorkflow,
  GoogleBusinessProfileWorkflowDraft,
} from '@/services/ops/restaurants';

export type SyncPublishDirection = Exclude<
  GoogleBusinessProfilePublishDirectionIntent,
  'google_to_nabatable_with_google_sync'
>;

export type FieldDecision =
  | 'pull_from_google'
  | 'push_to_google'
  | 'keep_nabatable'
  | 'ignore_suggestion'
  | 'manual';

export type DirectionSectionSummary = {
  section: GoogleBusinessProfileDraftSection;
  changedItems: GoogleBusinessProfileDraftItem[];
  actionableCount: number;
  selectedCount: number;
  oppositeDirectionCount: number;
  blockedCount: number;
  ignoredCount: number;
  unchangedCount: number;
};

export type DirectionStats = {
  selectedCount: number;
  actionableCount: number;
  blockedCount: number;
  ignoredCount: number;
};

export const SYNC_DIRECTION_OPTIONS: Array<{
  value: SyncPublishDirection;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 'google_to_nabatable',
    label: 'Update Nabatable',
    shortLabel: 'Google → Nabatable',
    description: 'Use selected Google profile details in Nabatable.',
  },
  {
    value: 'nabatable_to_google',
    label: 'Update Google',
    shortLabel: 'Nabatable → Google',
    description: 'Send selected Nabatable details to Google.',
  },
];

function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function directionLabel(direction: SyncPublishDirection): string {
  return SYNC_DIRECTION_OPTIONS.find((option) => option.value === direction)?.label ?? direction;
}

export function directionShortLabel(direction: SyncPublishDirection): string {
  return (
    SYNC_DIRECTION_OPTIONS.find((option) => option.value === direction)?.shortLabel ?? direction
  );
}

export function oppositeDirection(direction: SyncPublishDirection): SyncPublishDirection {
  return direction === 'google_to_nabatable' ? 'nabatable_to_google' : 'google_to_nabatable';
}

export function isChangedItem(item: GoogleBusinessProfileDraftItem): boolean {
  return item.status !== 'unchanged';
}

export function supportsDirection(
  item: GoogleBusinessProfileDraftItem,
  direction: SyncPublishDirection,
): boolean {
  return direction === 'google_to_nabatable' ? item.canPublishToNabatable : item.canPushToGoogle;
}

export function decisionMatchesDirection(
  decision: FieldDecision,
  direction: SyncPublishDirection,
): boolean {
  return (
    (direction === 'google_to_nabatable' && decision === 'pull_from_google') ||
    (direction === 'nabatable_to_google' && decision === 'push_to_google')
  );
}

export function directionDecision(direction: SyncPublishDirection): FieldDecision {
  return direction === 'google_to_nabatable' ? 'pull_from_google' : 'push_to_google';
}

export function formatValuePreview(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'No items';
    }

    if (value.every((entry) => typeof entry === 'string' || typeof entry === 'number')) {
      const joined = value.map(String).join(', ');
      return joined.length > 120 ? `${value.length} items` : joined;
    }

    return `${value.length} items`;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Structured value';
  }
}

export function isStructuredValue(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

export function humanFieldLabel(item: Pick<GoogleBusinessProfileDraftItem, 'fieldKey' | 'label'>) {
  const weekly = /^operatingHours\.weekly\.(\d+)$/.exec(item.fieldKey);
  if (weekly) {
    const day = formatGbpDay(Number(weekly[1]));
    return day ? `${day} opening hours` : item.label;
  }

  const override = /^operatingHours\.override\.(.+)$/.exec(item.fieldKey);
  if (override) {
    return `Special hours ${override[1]}`;
  }

  const service = /^servicePeriods\.([^.]+)\.(.+)$/.exec(item.fieldKey);
  if (service) {
    const [, dayPart, option] = service;
    const optionLabel = capitalize(option);
    if (dayPart === 'all') {
      return `${optionLabel} (all days)`;
    }
    const day = formatGbpDay(Number(dayPart));
    return day ? `${day} ${option.toLowerCase()}` : item.label;
  }

  return item.label;
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

export function deriveInitialFieldDecisions(
  draft: GoogleBusinessProfileWorkflowDraft | null,
): Record<string, FieldDecision> {
  if (!draft) {
    return {};
  }

  return Object.fromEntries(
    draft.sectionDiffs.flatMap((section) =>
      section.items.map((item) => {
        if (!isChangedItem(item)) {
          return [item.fieldKey, 'keep_nabatable' as const];
        }

        if (draft.selectedApprovals[item.fieldKey] && item.canPublishToNabatable) {
          return [item.fieldKey, 'pull_from_google' as const];
        }

        if (!item.canPublishToNabatable && !item.canPushToGoogle) {
          return [item.fieldKey, 'manual' as const];
        }

        return [item.fieldKey, 'keep_nabatable' as const];
      }),
    ),
  );
}

export function getFieldDecision(
  item: GoogleBusinessProfileDraftItem,
  decisions: Record<string, FieldDecision>,
): FieldDecision {
  return decisions[item.fieldKey] ?? 'keep_nabatable';
}

export function buildSelectedApprovalsForDirection(
  draft: GoogleBusinessProfileWorkflowDraft | null,
  decisions: Record<string, FieldDecision>,
  direction: SyncPublishDirection,
): Record<string, boolean> {
  if (!draft) {
    return {};
  }

  return Object.fromEntries(
    draft.sectionDiffs.flatMap((section) =>
      section.items.map((item) => [
        item.fieldKey,
        isChangedItem(item) &&
          supportsDirection(item, direction) &&
          decisionMatchesDirection(getFieldDecision(item, decisions), direction),
      ]),
    ),
  );
}

export function buildDirectionStats(
  draft: GoogleBusinessProfileWorkflowDraft | null,
  decisions: Record<string, FieldDecision>,
  direction: SyncPublishDirection,
): DirectionStats {
  if (!draft) {
    return { selectedCount: 0, actionableCount: 0, blockedCount: 0, ignoredCount: 0 };
  }

  let selectedCount = 0;
  let actionableCount = 0;
  let blockedCount = 0;
  let ignoredCount = 0;

  for (const section of draft.sectionDiffs) {
    for (const item of section.items) {
      if (!isChangedItem(item)) {
        continue;
      }

      const decision = getFieldDecision(item, decisions);
      if (supportsDirection(item, direction) && section.status !== 'stale') {
        actionableCount += 1;
      } else {
        blockedCount += 1;
      }

      if (decision === 'ignore_suggestion') {
        ignoredCount += 1;
      }

      if (
        section.status !== 'stale' &&
        supportsDirection(item, direction) &&
        decisionMatchesDirection(decision, direction)
      ) {
        selectedCount += 1;
      }
    }
  }

  return { selectedCount, actionableCount, blockedCount, ignoredCount };
}

export function buildDirectionSectionSummaries(
  draft: GoogleBusinessProfileWorkflowDraft | null,
  decisions: Record<string, FieldDecision>,
  direction: SyncPublishDirection,
): DirectionSectionSummary[] {
  if (!draft) {
    return [];
  }

  return draft.sectionDiffs
    .map((section) => {
      const changedItems = section.items.filter(isChangedItem);
      let actionableCount = 0;
      let selectedCount = 0;
      let oppositeDirectionCount = 0;
      let blockedCount = 0;
      let ignoredCount = 0;

      for (const item of changedItems) {
        const decision = getFieldDecision(item, decisions);
        const matchesDirection = decisionMatchesDirection(decision, direction);
        const matchesOpposite = decisionMatchesDirection(decision, oppositeDirection(direction));
        const supported = supportsDirection(item, direction) && section.status !== 'stale';

        if (supported) {
          actionableCount += 1;
        } else {
          blockedCount += 1;
        }

        if (matchesDirection && supported) {
          selectedCount += 1;
        }

        if (matchesOpposite) {
          oppositeDirectionCount += 1;
        }

        if (decision === 'ignore_suggestion') {
          ignoredCount += 1;
        }
      }

      return {
        section,
        changedItems,
        actionableCount,
        selectedCount,
        oppositeDirectionCount,
        blockedCount,
        ignoredCount,
        unchangedCount: section.items.length - changedItems.length,
      } satisfies DirectionSectionSummary;
    })
    .filter((summary) => summary.changedItems.length > 0 || summary.section.status === 'stale');
}

export function buildSelectedItemsForDirection(
  draft: GoogleBusinessProfileWorkflowDraft | null,
  decisions: Record<string, FieldDecision>,
  direction: SyncPublishDirection,
): Array<GoogleBusinessProfileDraftItem & { sectionLabel: string }> {
  if (!draft) {
    return [];
  }

  return draft.sectionDiffs.flatMap((section) =>
    section.items
      .filter(
        (item) =>
          isChangedItem(item) &&
          section.status !== 'stale' &&
          supportsDirection(item, direction) &&
          decisionMatchesDirection(getFieldDecision(item, decisions), direction),
      )
      .map((item) => ({ ...item, sectionLabel: section.label })),
  );
}

export function countSelectionsByDirection(
  draft: GoogleBusinessProfileWorkflowDraft | null,
  decisions: Record<string, FieldDecision>,
): Record<SyncPublishDirection, number> {
  return {
    google_to_nabatable: buildSelectedItemsForDirection(draft, decisions, 'google_to_nabatable')
      .length,
    nabatable_to_google: buildSelectedItemsForDirection(draft, decisions, 'nabatable_to_google')
      .length,
  };
}

export function hasMixedDirectionSelections(
  draft: GoogleBusinessProfileWorkflowDraft | null,
  decisions: Record<string, FieldDecision>,
): boolean {
  const counts = countSelectionsByDirection(draft, decisions);
  return counts.google_to_nabatable > 0 && counts.nabatable_to_google > 0;
}

export function compareBooleanRecords(
  left: Record<string, boolean>,
  right: Record<string, boolean>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (Boolean(left[key]) !== Boolean(right[key])) {
      return false;
    }
  }
  return true;
}

export function workflowStatusVariant(
  status: string,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'published') {
    return 'default';
  }
  if (status === 'failed' || status === 'google_failed' || status === 'stale') {
    return 'destructive';
  }
  if (status === 'partially_published' || status === 'preflight_ready') {
    return 'secondary';
  }
  return 'outline';
}

export function formatWorkflowStatus(status: string): string {
  switch (status) {
    case 'review_ready':
      return 'Ready to review';
    case 'approved':
      return 'Reviewed';
    case 'publishing':
      return 'Applying';
    case 'published':
      return 'Applied';
    case 'partially_published':
      return 'Partly applied';
    case 'google_failed':
      return 'Google update failed';
    case 'preflight_ready':
      return 'Final check passed';
    case 'failed':
      return 'Failed';
    case 'stale':
      return 'Refresh required';
    default:
      return status.replaceAll('_', ' ');
  }
}

export function formatAuditFlowLabel(event: GoogleBusinessProfileWorkflow['auditEvents'][number]) {
  if (event.direction === 'push_from_nabatable_to_google') {
    return 'Nabatable → Google';
  }

  return 'Google → Nabatable';
}

export function itemEligibilityLabel(item: GoogleBusinessProfileDraftItem): string {
  if (item.canPublishToNabatable && item.canPushToGoogle) {
    return 'Can update both';
  }
  if (item.canPublishToNabatable) {
    return 'Nabatable only';
  }
  if (item.canPushToGoogle) {
    return 'Google update available';
  }
  return 'Manual review';
}

export function itemChangeLabel(item: GoogleBusinessProfileDraftItem): string {
  if (isEmptyValue(item.currentValue) && !isEmptyValue(item.providerValue)) {
    return 'New from Google';
  }

  if (!isEmptyValue(item.currentValue) && isEmptyValue(item.providerValue)) {
    return 'Changed in Nabatable';
  }

  return 'Values differ';
}

export function decisionLabel(decision: FieldDecision): string {
  switch (decision) {
    case 'pull_from_google':
      return 'Use Google value';
    case 'push_to_google':
      return 'Send to Google';
    case 'ignore_suggestion':
      return 'Ignored';
    case 'manual':
      return 'Manual';
    case 'keep_nabatable':
    default:
      return 'Keep Nabatable';
  }
}

export function itemActionDisabledReason(
  item: GoogleBusinessProfileDraftItem,
  section: GoogleBusinessProfileDraftSection,
  decision: FieldDecision,
): string | null {
  if (section.status === 'stale') {
    return 'Check for changes again before changing this section.';
  }

  if (decision === 'pull_from_google' && !item.canPublishToNabatable) {
    return 'This field cannot be updated in Nabatable from here yet.';
  }

  if (decision === 'push_to_google' && !item.canPushToGoogle) {
    return 'This field cannot be sent to Google from here yet.';
  }

  if (decision === 'manual') {
    return 'Manual conflict resolution is not available here yet.';
  }

  return null;
}
