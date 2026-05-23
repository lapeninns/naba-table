import { getRestaurantBusinessContext } from '@/server/restaurants/businessContext';
import { getRestaurantDetails } from '@/server/restaurants/details';
import { getOperatingHours } from '@/server/restaurants/operatingHours';
import { getServicePeriods } from '@/server/restaurants/servicePeriods';

import { buildServicePeriodsVerificationSummary } from './core-sync';
import { syncGoogleBusinessProfileBusinessInformation } from './service';
import { providerValueChangedForStaleCheck } from './workflowBusinessContextComparison';
import { googleMasksForDraft } from './workflowDraftPayloads';
import {
  buildDraftSections,
  type GoogleBusinessProfileWorkflowCoreSnapshots,
} from './workflowDraftSections';
import {
  detectStaleSections,
  selectedDraftItems,
  selectedItems,
  selectedSectionKeys,
  validateAndStampFieldDecisions,
} from './workflowDraftSelection';
import { selectedApprovalsFromDecisions } from './workflowDraftState';
import { extractFieldDecisions } from './workflowFieldDecisions';
import { buildCoreSnapshotHashes, mapDraft } from './workflowMappers';
import {
  directionIntentForPublishMode,
  normalizePublishDirectionIntent,
  publishModeForDirectionIntent,
} from './workflowPublishDirection';
import {
  assertApprovalWorkflowDirectionSupported,
  type GoogleBusinessProfilePublishDirectionIntent,
  type GoogleBusinessProfilePublishMode,
} from './workflowPublishDirection';
import {
  assertGooglePushEnabled,
  buildPreflightWarnings,
  buildPublishJobIdempotencyKey,
  createWorkflowNamedError,
  publishModeForDecisions,
} from './workflowPublishPreflight';
import {
  findExternalProfile,
  readLatestDraft,
  type DbClient,
  type DraftRow,
  type ExternalProfileRow,
} from './workflowRepository';
import { toJson } from './workflowSerialization';
import { assertDraftPublishable } from './workflowStatusValidation';

import type {
  GoogleBusinessProfileDraftItem,
  GoogleBusinessProfileDraftSectionKey,
  GoogleBusinessProfileFieldDecision,
  GoogleBusinessProfileFieldDecisionInput,
  GoogleBusinessProfileGoogleUpdateMask,
  GoogleBusinessProfilePublishPreflightNotice,
  GoogleBusinessProfileWorkflowDraft,
} from './workflow';

export type CoreSnapshots = GoogleBusinessProfileWorkflowCoreSnapshots;

export type PublishPreflightContext = {
  draftRow: DraftRow;
  draft: GoogleBusinessProfileWorkflowDraft;
  currentCore: CoreSnapshots;
  currentHashes: Record<GoogleBusinessProfileDraftSectionKey, string>;
  externalProfile: ExternalProfileRow | null;
  mode: GoogleBusinessProfilePublishMode;
  directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  selectedApprovals: Record<string, boolean>;
  decisions: GoogleBusinessProfileFieldDecision[];
  sections: GoogleBusinessProfileDraftSectionKey[];
  nabatableUpdates: GoogleBusinessProfileDraftItem[];
  googleUpdates: GoogleBusinessProfileDraftItem[];
  pullOnlyItems: GoogleBusinessProfileDraftItem[];
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
  warnings: GoogleBusinessProfilePublishPreflightNotice[];
  errors: GoogleBusinessProfilePublishPreflightNotice[];
  idempotencyKey: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function readCoreSnapshots(
  restaurantId: string,
  client: DbClient,
): Promise<CoreSnapshots> {
  const [profile, operatingHours, servicePeriods, businessContext] = await Promise.all([
    getRestaurantDetails(restaurantId, client),
    getOperatingHours(restaurantId, client),
    getServicePeriods(restaurantId, client),
    getRestaurantBusinessContext(restaurantId, client),
  ]);

  return {
    profile,
    operatingHours,
    servicePeriods,
    businessContext,
  };
}

export function resolveCanPushServicePeriods(input: {
  core: CoreSnapshots;
  businessInfo: Parameters<typeof buildDraftSections>[0]['businessInfo'];
  lastPulledAt: string | null;
  lastPushedAt: string | null;
}): boolean {
  try {
    const serviceSummary = buildServicePeriodsVerificationSummary({
      periodsUpdatedAt:
        input.core.servicePeriods
          .map((period) => period.updatedAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null,
      businessInfo: input.businessInfo,
      lastPulledAt: input.lastPulledAt,
      lastPushedAt: input.lastPushedAt,
      canPush: true,
    });
    return serviceSummary.canPush;
  } catch {
    return false;
  }
}

export async function markDraftStaleAndThrow(params: {
  draft: GoogleBusinessProfileWorkflowDraft;
  staleSections: GoogleBusinessProfileDraftSectionKey[];
  staleFieldKeys?: string[];
  reason?: 'nabatable_changed_after_draft' | 'google_changed_after_draft';
  client: DbClient;
}): Promise<never> {
  const { error } = await params.client
    .from('restaurant_external_profile_drafts')
    .update({
      status: 'stale',
      stale_sections: params.staleSections,
      conflict_metadata: toJson({
        staleSections: params.staleSections,
        staleFieldKeys: params.staleFieldKeys ?? [],
        reason: params.reason ?? 'nabatable_changed_after_draft',
        checkedAt: nowIso(),
      }),
    })
    .eq('id', params.draft.id);

  if (error) {
    throw error;
  }

  throw createWorkflowNamedError(
    'GBP_DRAFT_STALE',
    `Changes need another check for section${params.staleSections.length === 1 ? '' : 's'}: ${params.staleSections.join(', ')}`,
  );
}

export async function detectProviderStaleItems(params: {
  restaurantId: string;
  draft: GoogleBusinessProfileWorkflowDraft;
  currentCore: CoreSnapshots;
  mode: GoogleBusinessProfilePublishMode;
  client: DbClient;
}): Promise<GoogleBusinessProfileDraftItem[]> {
  const selected = selectedItems(params.draft, params.mode);
  if (selected.length === 0) {
    return [];
  }

  const refreshedConnection = await syncGoogleBusinessProfileBusinessInformation(
    params.restaurantId,
    params.client,
    { runKind: 'core_sync' },
  );
  const refreshedSections = buildDraftSections({
    core: params.currentCore,
    businessInfo: refreshedConnection.businessInfo,
    externalLocationTitle: refreshedConnection.externalLocationTitle,
    canPushServicePeriods: resolveCanPushServicePeriods({
      core: params.currentCore,
      businessInfo: refreshedConnection.businessInfo,
      lastPulledAt: refreshedConnection.lastPullAt,
      lastPushedAt: refreshedConnection.lastPushAt,
    }),
  });
  const refreshedItemsByKey = new Map(
    refreshedSections.flatMap((section) => section.items.map((item) => [item.fieldKey, item])),
  );

  return selected.filter((item) => {
    const refreshedItem = refreshedItemsByKey.get(item.fieldKey);
    return refreshedItem ? providerValueChangedForStaleCheck(item, refreshedItem) : false;
  });
}

export async function buildPublishPreflightContext(params: {
  restaurantId: string;
  draftId: string;
  selectedApprovals: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  actorUserId?: string;
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
  client: DbClient;
}): Promise<PublishPreflightContext> {
  const latestDraft = await readLatestDraft(params.restaurantId, params.client);
  if (!latestDraft || latestDraft.id !== params.draftId) {
    throw new Error('Active Google Business Profile review was not found.');
  }
  assertDraftPublishable(latestDraft.status);

  const baseDraft = mapDraft(latestDraft);
  const decisions =
    params.decisions && params.actorUserId
      ? validateAndStampFieldDecisions({
          draft: baseDraft,
          decisions: params.decisions,
          actorUserId: params.actorUserId,
          decidedAt: nowIso(),
        })
      : extractFieldDecisions<GoogleBusinessProfileDraftSectionKey>(latestDraft.selected_approvals);
  const selectedApprovals =
    decisions.length > 0 ? selectedApprovalsFromDecisions(decisions) : params.selectedApprovals;
  const decisionMode = publishModeForDecisions(decisions);
  const directionIntent =
    params.directionIntent || params.pushToGoogle !== undefined
      ? normalizePublishDirectionIntent({
          directionIntent: params.directionIntent,
          pushToGoogle: params.pushToGoogle,
        })
      : decisionMode
        ? directionIntentForPublishMode(decisionMode)
        : 'google_to_nabatable';
  assertApprovalWorkflowDirectionSupported(directionIntent);
  const mode = decisionMode ?? publishModeForDirectionIntent(directionIntent);
  const draft = mapDraft(latestDraft, selectedApprovals, decisions);
  const currentCore = await readCoreSnapshots(params.restaurantId, params.client);
  const currentHashes = buildCoreSnapshotHashes(currentCore);
  const staleSections = detectStaleSections(draft, currentHashes, mode);
  if (staleSections.length > 0) {
    await markDraftStaleAndThrow({
      draft,
      staleSections,
      reason: 'nabatable_changed_after_draft',
      client: params.client,
    });
  }

  const importItems = selectedItems(draft, 'nabatable_only');
  const exportItems = selectedItems(draft, 'google_only');
  if (importItems.length === 0 && exportItems.length === 0) {
    throw createWorkflowNamedError(
      'GBP_DRAFT_NO_SELECTION',
      mode === 'google_only'
        ? 'Choose at least one field that can be sent to Google.'
        : 'Choose at least one field before applying changes.',
    );
  }

  const providerStaleItems = await detectProviderStaleItems({
    restaurantId: params.restaurantId,
    draft,
    currentCore,
    mode,
    client: params.client,
  });
  if (providerStaleItems.length > 0) {
    await markDraftStaleAndThrow({
      draft,
      staleSections: [...new Set(providerStaleItems.map((item) => item.sectionKey))],
      staleFieldKeys: providerStaleItems.map((item) => item.fieldKey),
      reason: 'google_changed_after_draft',
      client: params.client,
    });
  }

  const selectedDraftItemsForWarnings = selectedDraftItems(draft);
  const sections = selectedSectionKeys(draft, mode);
  const nabatableUpdates = mode === 'google_only' ? [] : importItems;
  const googleUpdateMasks =
    mode === 'nabatable_only' ? [] : googleMasksForDraft(draft, 'google_only');
  const pullOnlyItems =
    mode === 'nabatable_only'
      ? nabatableUpdates
      : selectedDraftItemsForWarnings.filter((item) => !item.canPushToGoogle);
  const warnings = buildPreflightWarnings<
    GoogleBusinessProfileDraftSectionKey,
    GoogleBusinessProfileDraftItem
  >({
    mode,
    selectedDraftItems: selectedDraftItemsForWarnings,
    googleUpdateMasks,
  });
  const externalProfile = await findExternalProfile(params.restaurantId, params.client);
  if (mode !== 'nabatable_only') {
    assertGooglePushEnabled(externalProfile);
  }

  return {
    draftRow: latestDraft,
    draft,
    currentCore,
    currentHashes,
    externalProfile,
    mode,
    directionIntent,
    selectedApprovals,
    decisions,
    sections,
    nabatableUpdates,
    googleUpdates: mode === 'nabatable_only' ? [] : exportItems,
    pullOnlyItems,
    googleUpdateMasks,
    warnings,
    errors: [],
    idempotencyKey: buildPublishJobIdempotencyKey({
      restaurantId: params.restaurantId,
      draftId: params.draftId,
      mode,
      selectedApprovals,
      decisions,
      currentHashes,
    }),
  };
}
