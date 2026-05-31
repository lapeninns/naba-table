import { updateRestaurantBusinessContext } from '@/server/restaurants/businessContext';
import { updateRestaurantDetails } from '@/server/restaurants/details';
import { updateOperatingHours } from '@/server/restaurants/operatingHours';
import { updateServicePeriods } from '@/server/restaurants/servicePeriods';

import {
  buildPullOperatingHoursPayload,
  buildPullProfilePatch,
  buildPullServicePeriodsPayload,
  type ProfileVerificationField,
} from './core-sync';
import {
  getGoogleBusinessProfileConnectionState,
  syncRestaurantOperatingHoursWithGoogleBusinessProfile,
  syncRestaurantProfileWithGoogleBusinessProfile,
  syncRestaurantServicePeriodsWithGoogleBusinessProfile,
} from './service';
import {
  businessContextPayloadForDraft,
  operatingHoursSelectionForDraft,
  profileFieldsForDraft,
  selectedGooglePushAuditValues,
  servicePeriodsSelectionForDraft,
} from './workflowDraftPayloads';
import { buildDraftSections } from './workflowDraftSections';
import { selectedItems, selectedSectionKeys } from './workflowDraftSelection';
import {
  profileProjectionCleanupTargets,
  serializeOrFilters,
} from './workflowProfileProjectionCleanup';
import { assertGooglePushEnabled } from './workflowPublishPreflight';
import { classifyGoogleBusinessProfilePushError } from './workflowPushErrors';
import {
  insertPublishEvent,
  updatePublishEvent,
  GOOGLE_BUSINESS_PROFILE_PROVIDER,
  type DbClient,
  type ExternalProfileRow,
} from './workflowRepository';
import {
  restoreBusinessContextPayload,
  restoreOperatingHoursPayload,
  restoreProfilePayload,
  restoreServicePeriodsPayload,
  type PublishRollbackResult,
} from './workflowRollbackPayloads';
import { isEqualValue } from './workflowSerialization';

import type { GoogleBusinessProfileWorkflowDraft } from './workflow';
import type { GoogleBusinessProfileWorkflowCoreSnapshots } from './workflowDraftSections';
import type { GoogleBusinessProfileGoogleUpdateMask } from './workflowGoogleUpdateMasks';

const GOOGLE_PUSH_SECTIONS = ['profile', 'operatingHours', 'servicePeriods'];

function describeWorkflowError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.details === 'string' && record.details.trim()) {
      return record.details;
    }
  }

  return fallback;
}

function assertApprovedProviderSnapshotUnchanged(params: {
  draft: GoogleBusinessProfileWorkflowDraft;
  currentCore: GoogleBusinessProfileWorkflowCoreSnapshots;
  connection: Awaited<ReturnType<typeof getGoogleBusinessProfileConnectionState>>;
}): void {
  const sections = buildDraftSections({
    core: params.currentCore,
    businessInfo: params.connection.businessInfo,
    externalLocationTitle:
      params.connection.externalLocationTitle ?? params.connection.externalLocationName ?? null,
    canPushServicePeriods: true,
  });
  const currentProviderValues = new Map(
    sections.flatMap((section) => section.items.map((item) => [item.fieldKey, item.providerValue])),
  );
  const changedFields = selectedItems(params.draft)
    .filter((item) => currentProviderValues.has(item.fieldKey))
    .filter((item) => !isEqualValue(item.providerValue, currentProviderValues.get(item.fieldKey)))
    .map((item) => item.fieldKey);

  if (changedFields.length > 0) {
    throw new Error(
      `Approved Google Business Profile values changed before publish: ${changedFields.join(', ')}.`,
    );
  }
}

async function clearProjectedProfileRowsForPulledFields(params: {
  restaurantId: string;
  fields: ProfileVerificationField[] | undefined;
  client: DbClient;
}): Promise<void> {
  for (const target of profileProjectionCleanupTargets(params.fields)) {
    let query = params.client.from(target.table).delete().eq('restaurant_id', params.restaurantId);

    for (const [key, value] of Object.entries(target.filters)) {
      query = query.eq(key, value);
    }

    if (target.anyOf) {
      query = query.or(serializeOrFilters(target.anyOf));
    }

    const { error } = await query;
    if (error) {
      throw error;
    }
  }
}

export async function publishDraftToNabatable(params: {
  restaurantId: string;
  draft: GoogleBusinessProfileWorkflowDraft;
  currentCore: GoogleBusinessProfileWorkflowCoreSnapshots;
  externalProfile: ExternalProfileRow | null;
  actorUserId: string;
  publishJobId: string;
  client: DbClient;
}): Promise<string> {
  const nabatableEvent = await insertPublishEvent({
    restaurantId: params.restaurantId,
    draftId: params.draft.id,
    externalProfileId: params.externalProfile?.id ?? null,
    direction: 'pull_from_gbp_to_nabatable',
    sections: selectedSectionKeys(params.draft),
    oldValues: params.currentCore,
    newValues: selectedItems(params.draft),
    actorUserId: params.actorUserId,
    client: params.client,
  });

  try {
    if (selectedSectionKeys(params.draft).includes('profile')) {
      const connection = await getGoogleBusinessProfileConnectionState(
        params.restaurantId,
        params.client,
      );
      assertApprovedProviderSnapshotUnchanged({
        draft: params.draft,
        currentCore: params.currentCore,
        connection,
      });
      const profileFields = profileFieldsForDraft(params.draft);
      const patch = {
        timezone: params.currentCore.profile.timezone,
        ...buildPullProfilePatch({
          businessInfo: connection.businessInfo,
          externalLocationTitle:
            connection.externalLocationTitle ?? connection.externalLocationName ?? null,
          fields: profileFields,
        }),
      };
      await updateRestaurantDetails(params.restaurantId, patch, params.client);
      await clearProjectedProfileRowsForPulledFields({
        restaurantId: params.restaurantId,
        fields: profileFields,
        client: params.client,
      });
    }

    if (selectedSectionKeys(params.draft).includes('operatingHours')) {
      const connection = await getGoogleBusinessProfileConnectionState(
        params.restaurantId,
        params.client,
      );
      assertApprovedProviderSnapshotUnchanged({
        draft: params.draft,
        currentCore: params.currentCore,
        connection,
      });
      const payload = buildPullOperatingHoursPayload({
        currentSnapshot: params.currentCore.operatingHours,
        businessInfo: connection.businessInfo,
        selection: operatingHoursSelectionForDraft(params.draft),
      });
      await updateOperatingHours(params.restaurantId, payload, params.client);
    }

    if (selectedSectionKeys(params.draft).includes('servicePeriods')) {
      const connection = await getGoogleBusinessProfileConnectionState(
        params.restaurantId,
        params.client,
      );
      assertApprovedProviderSnapshotUnchanged({
        draft: params.draft,
        currentCore: params.currentCore,
        connection,
      });
      const payload = buildPullServicePeriodsPayload({
        currentPeriods: params.currentCore.servicePeriods,
        businessInfo: connection.businessInfo,
        selection: servicePeriodsSelectionForDraft(params.draft),
      });
      await updateServicePeriods(params.restaurantId, payload, params.client);
    }

    const businessPayload = businessContextPayloadForDraft(
      params.draft,
      params.currentCore.businessContext,
    );
    if (Object.keys(businessPayload).length > 0) {
      await updateRestaurantBusinessContext(params.restaurantId, businessPayload, params.client, {
        changeOrigin: 'google',
        changedByUserId: params.actorUserId,
        changedVia: 'gbp_workflow_publish',
        changeReason: 'Applied approved Google Business Profile draft to Nabatable.',
        externalProfileId: params.externalProfile?.id ?? null,
        externalProvider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
        draftId: params.draft.id,
        publishJobId: params.publishJobId,
        publishEventId: nabatableEvent.id,
      });
    }

    await updatePublishEvent(nabatableEvent.id, 'success', [], params.client);
    return nabatableEvent.id;
  } catch (error) {
    await updatePublishEvent(
      nabatableEvent.id,
      'failed',
      [describeWorkflowError(error, 'Unable to publish selected draft items.')],
      params.client,
    );
    throw error;
  }
}

export async function restoreCoreSnapshotAfterFailedPublish(params: {
  restaurantId: string;
  draft: GoogleBusinessProfileWorkflowDraft;
  snapshot: GoogleBusinessProfileWorkflowCoreSnapshots;
  client: DbClient;
  allowUnguardedRollback?: boolean;
}): Promise<PublishRollbackResult> {
  const sections = new Set(selectedSectionKeys(params.draft));
  const errors: string[] = [];

  if (!params.allowUnguardedRollback) {
    return {
      status: 'failed',
      errors: [
        'automatic rollback skipped because current restaurant sections cannot be proven unchanged; manual repair is required.',
      ],
    };
  }

  const attempt = async (label: string, restore: () => Promise<unknown>) => {
    try {
      await restore();
    } catch (error) {
      errors.push(`${label}: ${describeWorkflowError(error, 'restore failed')}`);
    }
  };

  if (sections.has('profile')) {
    await attempt('profile', () =>
      updateRestaurantDetails(
        params.restaurantId,
        restoreProfilePayload(params.snapshot.profile),
        params.client,
      ),
    );
  }

  if (sections.has('operatingHours')) {
    await attempt('operatingHours', () =>
      updateOperatingHours(
        params.restaurantId,
        restoreOperatingHoursPayload(params.snapshot.operatingHours),
        params.client,
      ),
    );
  }

  if (sections.has('servicePeriods')) {
    await attempt('servicePeriods', () =>
      updateServicePeriods(
        params.restaurantId,
        restoreServicePeriodsPayload(params.snapshot.servicePeriods),
        params.client,
      ),
    );
  }

  const businessPayload = restoreBusinessContextPayload(params.snapshot.businessContext, sections);
  if (Object.keys(businessPayload).length > 0) {
    await attempt('businessContext', () =>
      updateRestaurantBusinessContext(params.restaurantId, businessPayload, params.client),
    );
  }

  return errors.length > 0 ? { status: 'failed', errors } : { status: 'restored', errors: [] };
}

export async function pushDraftToGoogle(params: {
  restaurantId: string;
  draft: GoogleBusinessProfileWorkflowDraft;
  externalProfile: ExternalProfileRow | null;
  actorUserId: string;
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
  currentCore: GoogleBusinessProfileWorkflowCoreSnapshots;
  client: DbClient;
}): Promise<string | null> {
  if (params.googleUpdateMasks.length === 0) {
    return null;
  }
  assertGooglePushEnabled(params.externalProfile);

  const googleSections = selectedSectionKeys(params.draft, 'google_only').filter((section) =>
    GOOGLE_PUSH_SECTIONS.includes(section),
  );
  const auditValues = selectedGooglePushAuditValues(params.draft);
  const googleEvent = await insertPublishEvent({
    restaurantId: params.restaurantId,
    draftId: params.draft.id,
    externalProfileId: params.externalProfile?.id ?? null,
    direction: 'push_from_nabatable_to_google',
    sections: googleSections,
    oldValues: Object.fromEntries(
      Object.entries(auditValues).map(([fieldKey, value]) => [fieldKey, value.googleValue]),
    ),
    newValues: Object.fromEntries(
      Object.entries(auditValues).map(([fieldKey, value]) => [fieldKey, value.nabatableValue]),
    ),
    googleUpdateMasks: params.googleUpdateMasks,
    actorUserId: params.actorUserId,
    client: params.client,
  });

  const completedGoogleSections: string[] = [];
  const createReconciliationRequiredError = (message: string, cause?: unknown) =>
    Object.assign(new Error(message), {
      name: 'GBP_GOOGLE_PUSH_RECONCILIATION_REQUIRED',
      classification: null,
      retryable: false,
      reconciliationRequired: true,
      googleEventId: googleEvent.id,
      cause,
    });
  const runGoogleSection = async (section: string, action: () => Promise<unknown>) => {
    try {
      await action();
      completedGoogleSections.push(section);
    } catch (error) {
      if (completedGoogleSections.length > 0) {
        const classified = classifyGoogleBusinessProfilePushError(error);
        const reconciliationError = {
          ...classified,
          retryable: false,
          reconciliationRequired: true,
          completedSections: completedGoogleSections,
        };
        try {
          await updatePublishEvent(googleEvent.id, 'failed', [reconciliationError], params.client);
        } catch (eventError) {
          throw createReconciliationRequiredError(
            'Google push reached partial external state, but local publish event failure recording failed.',
            eventError,
          );
        }
        throw Object.assign(new Error(classified.message), {
          name: 'GBP_GOOGLE_PUSH_PARTIAL_STATE',
          classification: null,
          retryable: false,
          reconciliationRequired: true,
          googleEventId: googleEvent.id,
        });
      }
      throw error;
    }
  };

  try {
    if (googleSections.includes('profile')) {
      const fields = (profileFieldsForDraft(params.draft, 'google_only') ?? []).filter((field) =>
        ['name', 'contactPhone'].includes(field),
      ) as Array<'name' | 'contactPhone'>;
      if (fields.length > 0) {
        await runGoogleSection('profile', () =>
          syncRestaurantProfileWithGoogleBusinessProfile({
            restaurantId: params.restaurantId,
            direction: 'push_to_gbp',
            fields,
            approvedProfile: params.currentCore.profile,
            client: params.client,
          }),
        );
      }
    }
    if (googleSections.includes('operatingHours')) {
      await runGoogleSection('operatingHours', () =>
        syncRestaurantOperatingHoursWithGoogleBusinessProfile({
          restaurantId: params.restaurantId,
          direction: 'push_to_gbp',
          selection: operatingHoursSelectionForDraft(params.draft, 'google_only'),
          approvedSnapshot: params.currentCore.operatingHours,
          client: params.client,
        }),
      );
    }
    if (googleSections.includes('servicePeriods')) {
      await runGoogleSection('servicePeriods', () =>
        syncRestaurantServicePeriodsWithGoogleBusinessProfile({
          restaurantId: params.restaurantId,
          direction: 'push_to_gbp',
          selection: servicePeriodsSelectionForDraft(params.draft, 'google_only'),
          approvedPeriods: params.currentCore.servicePeriods,
          client: params.client,
        }),
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'GBP_GOOGLE_PUSH_PARTIAL_STATE') {
      throw error;
    }
    const classified = classifyGoogleBusinessProfilePushError(error);
    await updatePublishEvent(googleEvent.id, 'failed', [classified], params.client);
    throw Object.assign(new Error(classified.message), {
      name: 'GBP_GOOGLE_PUSH_FAILED',
      classification: classified.classification,
      googleEventId: googleEvent.id,
    });
  }

  try {
    await updatePublishEvent(googleEvent.id, 'success', [], params.client);
  } catch (error) {
    throw createReconciliationRequiredError(
      'Google push succeeded, but local publish event persistence failed.',
      error,
    );
  }
  return googleEvent.id;
}
