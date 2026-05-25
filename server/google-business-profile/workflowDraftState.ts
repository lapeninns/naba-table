import { hashJson, toJson } from './workflowSerialization';
import { READ_ONLY_REVIEW_DRAFT_STATUSES } from './workflowStatusValidation';

import type { GoogleBusinessProfileFieldDecision } from './workflowFieldDecisions';

export type WorkflowDraftStateItem<SectionKey extends string = string> = {
  fieldKey: string;
  label: string;
  sectionKey: SectionKey;
  currentValue: unknown;
  providerValue: unknown;
  status: 'ready' | 'unchanged' | 'unsupported' | 'warning';
  selected: boolean;
  canPublishToNabatable: boolean;
  canPushToGoogle: boolean;
  normalizedNabatableValue?: unknown;
  normalizedGoogleValue?: unknown;
  nabatableValueHash?: string;
  googleValueHash?: string;
  capabilities?: {
    canImportFromGoogle: boolean;
    canExportToGoogle: boolean;
    canIgnore: boolean;
  };
  blockedReasons?: string[];
};

export type WorkflowDraftStateSection<
  SectionKey extends string = string,
  Item extends WorkflowDraftStateItem<SectionKey> = WorkflowDraftStateItem<SectionKey>,
> = {
  sectionKey: SectionKey;
  label: string;
  status: 'ready' | 'unchanged' | 'stale' | 'blocked';
  summary: string;
  items: Item[];
  canPublishToNabatable: boolean;
  canPushToGoogle: boolean;
  blockedReasons: string[];
};

export type WorkflowDraftState<
  SectionKey extends string = string,
  Item extends WorkflowDraftStateItem<SectionKey> = WorkflowDraftStateItem<SectionKey>,
  Section extends WorkflowDraftStateSection<SectionKey, Item> = WorkflowDraftStateSection<
    SectionKey,
    Item
  >,
> = {
  status: string;
  staleSections: string[];
  selectedApprovals: Record<string, boolean>;
  decisions: Array<GoogleBusinessProfileFieldDecision<SectionKey>>;
  sectionDiffs: Section[];
};

const STALE_SECTION_BLOCKED_REASON =
  'Restaurant details changed after this review was created. Check for changes again before applying this section.';

export function summarizeSection<Item extends WorkflowDraftStateItem<string>>(
  sectionKey: Item['sectionKey'],
  label: string,
  items: Item[],
): WorkflowDraftStateSection<Item['sectionKey'], Item> {
  const changedCount = items.filter((item) => item.status === 'ready').length;
  const blockedReasons = [
    ...new Set(
      items
        .filter((item) => item.status === 'ready' && !item.canPublishToNabatable)
        .map((item) => `${item.label} cannot be updated in Nabatable from this review yet.`),
    ),
  ];

  return {
    sectionKey,
    label,
    status: changedCount > 0 ? 'ready' : 'unchanged',
    summary:
      changedCount > 0
        ? `${changedCount} change${changedCount === 1 ? '' : 's'} ready to review.`
        : 'No Google changes need review in this section.',
    items,
    canPublishToNabatable: items.some((item) => item.selected && item.canPublishToNabatable),
    canPushToGoogle: items.some((item) => item.canPushToGoogle),
    blockedReasons,
  };
}

export function ensureDraftItemV2<
  SectionKey extends string,
  Item extends WorkflowDraftStateItem<SectionKey>,
>(item: Item): Item {
  const normalizedNabatableValue = item.normalizedNabatableValue ?? item.currentValue;
  const normalizedGoogleValue = item.normalizedGoogleValue ?? item.providerValue;

  return {
    ...item,
    normalizedNabatableValue: toJson(normalizedNabatableValue),
    normalizedGoogleValue: toJson(normalizedGoogleValue),
    nabatableValueHash: item.nabatableValueHash ?? hashJson(normalizedNabatableValue),
    googleValueHash: item.googleValueHash ?? hashJson(normalizedGoogleValue),
    capabilities: item.capabilities ?? {
      canImportFromGoogle: item.canPublishToNabatable,
      canExportToGoogle: item.canPushToGoogle,
      canIgnore: true,
    },
    blockedReasons: item.blockedReasons ?? [
      ...(!item.canPublishToNabatable
        ? [`${item.label} cannot be imported from Google automatically.`]
        : []),
      ...(!item.canPushToGoogle
        ? [`${item.label} cannot be exported to Google automatically.`]
        : []),
    ],
  };
}

function decisionMap<SectionKey extends string>(
  decisions: Array<GoogleBusinessProfileFieldDecision<SectionKey>> = [],
) {
  return new Map(decisions.map((decision) => [decision.fieldKey, decision]));
}

export function selectedApprovalsFromDecisions<SectionKey extends string>(
  decisions: Array<GoogleBusinessProfileFieldDecision<SectionKey>>,
): Record<string, boolean> {
  return Object.fromEntries(
    decisions.map((decision) => [
      decision.fieldKey,
      decision.action === 'import_from_google' || decision.action === 'export_to_google',
    ]),
  );
}

export function applySelectedApprovals<
  SectionKey extends string,
  Item extends WorkflowDraftStateItem<SectionKey>,
  Section extends WorkflowDraftStateSection<SectionKey, Item>,
>(
  sections: Section[],
  selectedApprovals: Record<string, boolean>,
  staleSections: string[],
  decisions: Array<GoogleBusinessProfileFieldDecision<SectionKey>> = [],
): Section[] {
  const staleSet = new Set(staleSections);
  const decisionsByField = decisionMap(decisions);
  return sections.map((section) => {
    const items = section.items.map((rawItem) => {
      const item = ensureDraftItemV2(rawItem);
      const decision = decisionsByField.get(item.fieldKey);
      return {
        ...item,
        selected: decision
          ? decision.action === 'import_from_google' || decision.action === 'export_to_google'
          : (selectedApprovals[item.fieldKey] ?? false),
      };
    });
    const isStale = staleSet.has(section.sectionKey);
    return {
      ...section,
      status: isStale ? 'stale' : section.status,
      items,
      canPublishToNabatable:
        !isStale && items.some((item) => item.selected && item.canPublishToNabatable),
      blockedReasons: isStale ? [STALE_SECTION_BLOCKED_REASON] : section.blockedReasons,
    };
  }) as Section[];
}

function summarizeReconciledSection<
  SectionKey extends string,
  Item extends WorkflowDraftStateItem<SectionKey>,
  Section extends WorkflowDraftStateSection<SectionKey, Item>,
>(section: Section): WorkflowDraftStateSection<SectionKey, Item> {
  return summarizeSection(section.sectionKey, section.label, section.items);
}

export function reconcileDraftWithCurrentSections<
  SectionKey extends string,
  Item extends WorkflowDraftStateItem<SectionKey>,
  Section extends WorkflowDraftStateSection<SectionKey, Item>,
  Draft extends WorkflowDraftState<SectionKey, Item, Section>,
>(draft: Draft, currentSections: Section[]): Draft {
  const currentSectionsByKey = new Map<SectionKey, Section>(
    currentSections.map((section) => [section.sectionKey, section]),
  );
  const staleSections = new Set(draft.staleSections);
  const selectedApprovals = draft.selectedApprovals;
  const decisionsByField = decisionMap(draft.decisions);

  const sectionDiffs = currentSections.map((currentSection) => {
    const wasStale = staleSections.has(currentSection.sectionKey);
    const items = currentSection.items.map((item) => {
      const decision = decisionsByField.get(item.fieldKey);
      const selected = Boolean(
        item.status === 'ready' &&
        (decision
          ? decision.action === 'import_from_google' || decision.action === 'export_to_google'
          : (selectedApprovals[item.fieldKey] ?? item.selected)),
      );

      return {
        ...item,
        selected,
      };
    });
    const summarized = summarizeReconciledSection({
      ...currentSection,
      items,
    });

    if (!wasStale || summarized.status === 'unchanged') {
      return summarized;
    }

    return {
      ...summarized,
      status: 'stale' as const,
      canPublishToNabatable: false,
      blockedReasons: [STALE_SECTION_BLOCKED_REASON],
    };
  });

  const currentSectionKeys = new Set(currentSectionsByKey.keys());
  const remainingStaleSections = draft.staleSections.filter((sectionKey) => {
    const typedSectionKey = sectionKey as SectionKey;
    if (!currentSectionKeys.has(typedSectionKey)) {
      return true;
    }

    return sectionDiffs.some(
      (section) => section.sectionKey === typedSectionKey && section.status === 'stale',
    );
  });

  return {
    ...draft,
    staleSections: remainingStaleSections,
    sectionDiffs,
  } as Draft;
}

export function suppressActionsForReadOnlyReview<
  SectionKey extends string,
  Item extends WorkflowDraftStateItem<SectionKey>,
  Section extends WorkflowDraftStateSection<SectionKey, Item>,
  Draft extends WorkflowDraftState<SectionKey, Item, Section>,
>(draft: Draft): Draft {
  if (!READ_ONLY_REVIEW_DRAFT_STATUSES.includes(draft.status)) {
    return draft;
  }

  return {
    ...draft,
    selectedApprovals: Object.fromEntries(
      Object.keys(draft.selectedApprovals).map((fieldKey) => [fieldKey, false]),
    ),
    decisions: [],
    staleSections: [],
    sectionDiffs: draft.sectionDiffs.map((section) => ({
      ...section,
      status: 'unchanged',
      summary: 'Check for changes to review new differences.',
      canPublishToNabatable: false,
      canPushToGoogle: section.items.some((item) => item.canPushToGoogle),
      blockedReasons: [],
      items: section.items.map((item) => ({
        ...item,
        status: 'unchanged',
        selected: false,
      })),
    })),
  } as Draft;
}
