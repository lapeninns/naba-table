import { buildBusinessContextPayloadForSections } from './workflowBusinessContextPayload';
import {
  selectedItems,
  selectedSectionKeys,
  type WorkflowDraftSelectionDraft,
  type WorkflowDraftSelectionItem,
} from './workflowDraftSelection';
import {
  buildGoogleUpdateMasksForSelections,
  type GoogleBusinessProfileGoogleUpdateMask,
} from './workflowGoogleUpdateMasks';

import type { ProfileVerificationField } from './core-sync';
import type { GoogleBusinessProfilePublishMode } from './workflowPublishDirection';
import type {
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';

type GoogleBusinessProfileDraftPayloadItem<SectionKey extends string = string> =
  WorkflowDraftSelectionItem<SectionKey> & {
    currentValue: unknown;
    providerValue: unknown;
  };

type GoogleBusinessProfileDraftPayloadDraft<
  SectionKey extends string,
  Item extends GoogleBusinessProfileDraftPayloadItem<SectionKey>,
> = WorkflowDraftSelectionDraft<SectionKey, Item>;

export function getSelectedFieldSuffixes<
  SectionKey extends string,
  Item extends GoogleBusinessProfileDraftPayloadItem<SectionKey>,
>(
  draft: GoogleBusinessProfileDraftPayloadDraft<SectionKey, Item>,
  sectionKey: SectionKey,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): string[] {
  return selectedItems(draft, mode)
    .filter((item) => item.sectionKey === sectionKey)
    .map((item) => item.fieldKey);
}

export function profileFieldsForDraft<
  SectionKey extends string,
  Item extends GoogleBusinessProfileDraftPayloadItem<SectionKey>,
>(
  draft: GoogleBusinessProfileDraftPayloadDraft<SectionKey, Item>,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): ProfileVerificationField[] | undefined {
  const fields = getSelectedFieldSuffixes(draft, 'profile' as SectionKey, mode)
    .map((fieldKey) => fieldKey.replace('profile.', ''))
    .filter((field): field is ProfileVerificationField =>
      ['name', 'contactPhone', 'address', 'googleMapUrl', 'googleReviewUrl'].includes(field),
    );
  return fields.length > 0 ? fields : undefined;
}

export function operatingHoursSelectionForDraft<
  SectionKey extends string,
  Item extends GoogleBusinessProfileDraftPayloadItem<SectionKey>,
>(
  draft: GoogleBusinessProfileDraftPayloadDraft<SectionKey, Item>,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
) {
  const keys = getSelectedFieldSuffixes(draft, 'operatingHours' as SectionKey, mode);
  const weeklyDays = keys
    .map((key) => key.match(/^operatingHours\.weekly\.(\d)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number.parseInt(value, 10));
  const overrideDates = keys
    .map((key) => key.match(/^operatingHours\.override\.(\d{4}-\d{2}-\d{2})$/)?.[1])
    .filter((value): value is string => Boolean(value));

  return {
    ...(weeklyDays.length > 0 ? { weeklyDays } : {}),
    ...(overrideDates.length > 0 ? { overrideDates } : {}),
  };
}

export function servicePeriodsSelectionForDraft<
  SectionKey extends string,
  Item extends GoogleBusinessProfileDraftPayloadItem<SectionKey>,
>(
  draft: GoogleBusinessProfileDraftPayloadDraft<SectionKey, Item>,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
) {
  const dayOfWeeks = [
    ...new Set(
      getSelectedFieldSuffixes(draft, 'servicePeriods' as SectionKey, mode)
        .map((key) => key.match(/^servicePeriods\.(\d|all)\./)?.[1])
        .filter((value): value is string => Boolean(value && value !== 'all'))
        .map((value) => Number.parseInt(value, 10)),
    ),
  ];

  return dayOfWeeks.length > 0 ? { dayOfWeeks } : undefined;
}

export function businessContextPayloadForDraft<
  SectionKey extends string,
  Item extends GoogleBusinessProfileDraftPayloadItem<SectionKey>,
>(
  draft: GoogleBusinessProfileDraftPayloadDraft<SectionKey, Item>,
  current: RestaurantBusinessContextSnapshot,
): UpdateRestaurantBusinessContextInput {
  return buildBusinessContextPayloadForSections(selectedSectionKeys(draft), current);
}

export function googleMasksForDraft<
  SectionKey extends string,
  Item extends GoogleBusinessProfileDraftPayloadItem<SectionKey>,
>(
  draft: GoogleBusinessProfileDraftPayloadDraft<SectionKey, Item>,
  mode: GoogleBusinessProfilePublishMode = 'google_only',
): GoogleBusinessProfileGoogleUpdateMask[] {
  const profileFields = profileFieldsForDraft(draft, mode) ?? [];
  const hoursSelection = operatingHoursSelectionForDraft(draft, mode);
  const includesServicePeriods = selectedItems(draft, mode).some(
    (item) => item.sectionKey === 'servicePeriods' && item.canPushToGoogle,
  );

  return buildGoogleUpdateMasksForSelections({
    profileFields,
    weeklyDays: hoursSelection.weeklyDays,
    overrideDates: hoursSelection.overrideDates,
    includesServicePeriods,
  });
}

export function selectedGooglePushAuditValues<
  SectionKey extends string,
  Item extends GoogleBusinessProfileDraftPayloadItem<SectionKey>,
>(draft: GoogleBusinessProfileDraftPayloadDraft<SectionKey, Item>) {
  return Object.fromEntries(
    selectedItems(draft, 'google_only').map((item) => [
      item.fieldKey,
      {
        googleValue: item.providerValue,
        nabatableValue: item.currentValue,
      },
    ]),
  );
}
