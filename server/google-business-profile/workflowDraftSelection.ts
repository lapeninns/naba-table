import type {
  GoogleBusinessProfileFieldDecision,
  GoogleBusinessProfileFieldDecisionInput,
  GoogleBusinessProfileSyncDecisionAction,
} from './workflowFieldDecisions';
import type { GoogleBusinessProfilePublishMode } from './workflowPublishDirection';

export type WorkflowDraftSelectionItem<SectionKey extends string = string> = {
  fieldKey: string;
  label: string;
  sectionKey: SectionKey;
  status: string;
  selected: boolean;
  nabatableValueHash: string;
  googleValueHash: string;
  capabilities: {
    canImportFromGoogle: boolean;
    canExportToGoogle: boolean;
    canIgnore: boolean;
  };
  canPublishToNabatable: boolean;
  canPushToGoogle: boolean;
};

export type WorkflowDraftSelectionSection<
  SectionKey extends string,
  Item extends WorkflowDraftSelectionItem<SectionKey>,
> = {
  sectionKey: SectionKey;
  items: Item[];
};

export type WorkflowDraftSelectionDraft<
  SectionKey extends string,
  Item extends WorkflowDraftSelectionItem<SectionKey>,
> = {
  sectionDiffs: Array<WorkflowDraftSelectionSection<SectionKey, Item>>;
  decisions?: Array<GoogleBusinessProfileFieldDecision<SectionKey>>;
  coreSnapshotHashes: Record<string, string>;
};

function createFieldDecisionInvalidError(message: string): Error {
  const error = new Error(message);
  error.name = 'GBP_DECISION_INVALID';
  return error;
}

function draftItemLookup<
  SectionKey extends string,
  Item extends WorkflowDraftSelectionItem<SectionKey>,
>(draft: Pick<WorkflowDraftSelectionDraft<SectionKey, Item>, 'sectionDiffs'>) {
  return new Map<string, Item>(
    draft.sectionDiffs.flatMap((section) =>
      section.items.map((item) => [`${section.sectionKey}:${item.fieldKey}`, item] as const),
    ),
  );
}

export function validateAndStampFieldDecisions<
  SectionKey extends string,
  Item extends WorkflowDraftSelectionItem<SectionKey>,
>(params: {
  draft: Pick<WorkflowDraftSelectionDraft<SectionKey, Item>, 'sectionDiffs'>;
  decisions: Array<GoogleBusinessProfileFieldDecisionInput<SectionKey>>;
  actorUserId: string;
  decidedAt: string;
}): Array<GoogleBusinessProfileFieldDecision<SectionKey>> {
  const itemsByKey = draftItemLookup(params.draft);
  const result: Array<GoogleBusinessProfileFieldDecision<SectionKey>> = [];
  const seen = new Set<string>();

  for (const decision of params.decisions) {
    const decisionKey = `${decision.sectionKey}:${decision.fieldKey}`;
    if (seen.has(decisionKey)) {
      continue;
    }
    seen.add(decisionKey);

    const item = itemsByKey.get(decisionKey);
    if (!item || item.status === 'unchanged') {
      throw createFieldDecisionInvalidError(
        `Decision field is no longer reviewable: ${decision.fieldKey}.`,
      );
    }
    if (decision.reviewedNabatableValueHash !== item.nabatableValueHash) {
      throw createFieldDecisionInvalidError(
        `${item.label} changed in Nabatable since it was reviewed.`,
      );
    }
    if (decision.reviewedGoogleValueHash !== item.googleValueHash) {
      throw createFieldDecisionInvalidError(
        `${item.label} changed in Google since it was reviewed.`,
      );
    }
    if (decision.action === 'import_from_google' && !item.capabilities.canImportFromGoogle) {
      throw createFieldDecisionInvalidError(`${item.label} cannot be imported from Google.`);
    }
    if (decision.action === 'export_to_google' && !item.capabilities.canExportToGoogle) {
      throw createFieldDecisionInvalidError(`${item.label} cannot be exported to Google.`);
    }
    if (decision.action === 'ignore' && !item.capabilities.canIgnore) {
      throw createFieldDecisionInvalidError(`${item.label} cannot be ignored.`);
    }

    result.push({
      ...decision,
      decidedByUserId: params.actorUserId,
      decidedAt: params.decidedAt,
    });
  }

  return result;
}

export function decisionActionForItem<
  SectionKey extends string,
  Item extends Pick<WorkflowDraftSelectionItem<SectionKey>, 'fieldKey'>,
>(
  draft: Pick<
    WorkflowDraftSelectionDraft<SectionKey, WorkflowDraftSelectionItem<SectionKey>>,
    'decisions'
  >,
  item: Item,
): GoogleBusinessProfileSyncDecisionAction | null {
  return draft.decisions?.find((decision) => decision.fieldKey === item.fieldKey)?.action ?? null;
}

export function selectedDraftItems<
  SectionKey extends string,
  Item extends WorkflowDraftSelectionItem<SectionKey>,
>(draft: WorkflowDraftSelectionDraft<SectionKey, Item>): Item[] {
  if ((draft.decisions?.length ?? 0) > 0) {
    return draft.sectionDiffs.flatMap((section) =>
      section.items.filter((item) => {
        const action = decisionActionForItem(draft, item);
        return action === 'import_from_google' || action === 'export_to_google';
      }),
    );
  }

  return draft.sectionDiffs.flatMap((section) => section.items.filter((item) => item.selected));
}

export function selectedItems<
  SectionKey extends string,
  Item extends WorkflowDraftSelectionItem<SectionKey>,
>(
  draft: WorkflowDraftSelectionDraft<SectionKey, Item>,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): Item[] {
  if ((draft.decisions?.length ?? 0) > 0) {
    return draft.sectionDiffs.flatMap((section) =>
      section.items.filter((item) => {
        const action = decisionActionForItem(draft, item);
        if (mode === 'google_only') {
          return action === 'export_to_google' && item.canPushToGoogle;
        }
        if (mode === 'nabatable_only') {
          return action === 'import_from_google' && item.canPublishToNabatable;
        }
        return (
          (action === 'import_from_google' && item.canPublishToNabatable) ||
          (action === 'export_to_google' && item.canPushToGoogle)
        );
      }),
    );
  }

  return draft.sectionDiffs.flatMap((section) =>
    section.items.filter((item) => {
      if (!item.selected) {
        return false;
      }
      return mode === 'google_only' ? item.canPushToGoogle : item.canPublishToNabatable;
    }),
  );
}

export function selectedSectionKeys<
  SectionKey extends string,
  Item extends WorkflowDraftSelectionItem<SectionKey>,
>(
  draft: WorkflowDraftSelectionDraft<SectionKey, Item>,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): SectionKey[] {
  return [...new Set(selectedItems(draft, mode).map((item) => item.sectionKey))];
}

export function detectStaleSections<
  SectionKey extends string,
  Item extends WorkflowDraftSelectionItem<SectionKey>,
>(
  draft: WorkflowDraftSelectionDraft<SectionKey, Item>,
  currentHashes: Record<string, string>,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): SectionKey[] {
  return selectedSectionKeys(draft, mode).filter(
    (sectionKey) => draft.coreSnapshotHashes[sectionKey] !== currentHashes[sectionKey],
  );
}
