import { formatGbpDay } from '../../lib/formatters';

import type {
  GoogleBusinessProfileDraftItem,
  GoogleBusinessProfileDraftSection,
  GoogleBusinessProfileWorkflow,
} from '@/services/ops/restaurants';

export type ItemGroup = 'changed' | 'unchanged' | 'blocked';

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  return 'Structured value';
}

export function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'stale' || status === 'failed' || status === 'blocked') return 'destructive';
  if (status === 'published') return 'default';
  if (status === 'partially_published') return 'secondary';
  return 'outline';
}

export function formatDraftStatusLabel(status: string): string {
  switch (status) {
    case 'review_ready': return 'Ready for review';
    case 'approved': return 'Approved';
    case 'published': return 'Published';
    case 'partially_published': return 'Partially published';
    case 'failed': return 'Failed';
    case 'stale': return 'Stale';
    default: return status.replaceAll('_', ' ');
  }
}

export function formatSectionStatusLabel(status: GoogleBusinessProfileDraftSection['status']): string {
  switch (status) {
    case 'ready': return 'Has changes';
    case 'unchanged': return 'No changes';
    case 'stale': return 'Stale – refresh';
    case 'blocked': return 'Blocked';
    default: return status;
  }
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function humanFieldLabel(
  item: Pick<GoogleBusinessProfileDraftItem, 'fieldKey' | 'label'>,
): string {
  const { fieldKey, label } = item;
  const weekly = /^operatingHours\.weekly\.(\d+)$/.exec(fieldKey);
  if (weekly) {
    const day = formatGbpDay(Number(weekly[1]));
    return day ? `${day} opening hours` : label;
  }
  const override = /^operatingHours\.override\.(.+)$/.exec(fieldKey);
  if (override) return `Special hours ${override[1]}`;
  const service = /^servicePeriods\.([^.]+)\.(.+)$/.exec(fieldKey);
  if (service) {
    const [, dayPart, option] = service;
    const dayNumber = Number(dayPart);
    const optionLabel = capitalize(option);
    if (dayPart === 'all' || Number.isNaN(dayNumber)) return `${optionLabel} (all days)`;
    const day = formatGbpDay(dayNumber);
    return day ? `${day} ${option.toLowerCase()}` : label;
  }
  return label;
}

export function classifyItem(item: GoogleBusinessProfileDraftItem): ItemGroup {
  if (item.status === 'unchanged') return 'unchanged';
  if (item.status === 'unsupported' || !item.canPublishToNabatable) return 'blocked';
  return 'changed';
}

export function publishTargetLabel(item: GoogleBusinessProfileDraftItem): string {
  if (item.status === 'unsupported' || !item.canPublishToNabatable) return 'Cannot apply';
  return 'Google → Nabatable';
}

export function visibleItemWarnings(item: GoogleBusinessProfileDraftItem): string[] {
  return item.warnings.filter(
    (warning) => !/optional google sync is disabled for this section in v1/i.test(warning),
  );
}

export function formatAuditDirectionLabel(event: GoogleBusinessProfileWorkflow['auditEvents'][number]) {
  if (event.directionLabel) return event.directionLabel;
  if (event.direction === 'push_from_nabatable_to_google') return 'Legacy Google write';
  return 'Google → Nabatable apply';
}

export function buildDialogItems(workflow: GoogleBusinessProfileWorkflow | undefined) {
  return (
    workflow?.latestDraft?.sectionDiffs.flatMap((section) =>
      section.items
        .filter((item) => item.selected && item.canPublishToNabatable)
        .map((item) => ({
          id: item.fieldKey,
          label: humanFieldLabel(item),
          group: section.label,
          description: `${formatValue(item.currentValue)} → ${formatValue(item.proposedValue)}`,
          details: visibleItemWarnings(item),
          supportLabel: publishTargetLabel(item),
        })),
    ) ?? []
  );
}

export type SectionSummary = {
  section: GoogleBusinessProfileDraftSection;
  changedCount: number;
  selectedCount: number;
  blockedCount: number;
  unchangedCount: number;
  isActive: boolean;
};

export function buildSectionSummaries(sections: GoogleBusinessProfileDraftSection[]): SectionSummary[] {
  return sections.map((section) => {
    let changedCount = 0;
    let selectedCount = 0;
    let blockedCount = 0;
    let unchangedCount = 0;
    for (const item of section.items) {
      const group = classifyItem(item);
      if (group === 'changed') {
        changedCount++;
        if (item.selected) selectedCount++;
      } else if (group === 'unchanged') {
        unchangedCount++;
      } else {
        blockedCount++;
      }
    }
    const isActive = changedCount > 0 || blockedCount > 0 || section.status === 'stale' || section.status === 'blocked';
    return { section, changedCount, selectedCount, blockedCount, unchangedCount, isActive };
  });
}
