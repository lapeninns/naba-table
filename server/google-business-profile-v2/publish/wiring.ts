/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * Production wiring of `OrchestratorPorts`. Composes:
 *  - `verifyContractLock`: re-builds the live diff for the draft and compares
 *    each frozen decision's value hashes against the live diff item hashes.
 *  - `directionIntentSupported`: both directions are supported.
 *  - `applyToNabatable` / `patchGoogle`: writer ports.
 *
 * Writer-port note:
 *
 *   Import-to-Nabatable is wired for profile, weekly operating hours, service
 *   periods, and business-context rows through existing core writers.
 *   Export-to-Google is wired for the Google write paths that already exist
 *   in the legacy service layer plus V2 location patch adapters: profile
 *   title/phone/description/address, regular hours, kitchen more-hours/service
 *   periods, categories, service areas, attributes, and service items.
 */

import {
  patchRestaurantGoogleBusinessProfileLocationFields,
  syncRestaurantOperatingHoursWithGoogleBusinessProfile,
  syncRestaurantProfileWithGoogleBusinessProfile,
  syncRestaurantServicePeriodsWithGoogleBusinessProfile,
} from '@/server/google-business-profile/service';
import {
  getRestaurantBusinessContext,
  updateRestaurantBusinessContext,
  type UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';
import { getRestaurantDetails, updateRestaurantDetails } from '@/server/restaurants/details';
import {
  getOperatingHours,
  updateOperatingHours,
  type UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';
import {
  getServicePeriods,
  updateServicePeriods,
  type UpdateServicePeriod,
} from '@/server/restaurants/servicePeriods';

import { castJsonDecisions } from '../decisions/store';
import { buildSyncV2Diff } from '../diff/engine';
import { hashFrozenDecisions } from '../hashing';
import { readGoogleSnapshot } from '../snapshot/google';
import { readNabatableSnapshot } from '../snapshot/nabatable';

import type { OrchestratorPorts } from './ports';
import type {
  SyncV2AttributeValue,
  SyncV2CanonicalSnapshot,
  SyncV2CategoryValue,
  SyncV2OperatingHoursDay,
  SyncV2ServiceAreaValue,
  SyncV2ServiceItemValue,
  SyncV2ServicePeriod,
} from '../snapshot/types';
import type {
  SyncV2Decision,
  SyncV2DirectionIntent,
  SyncV2FrozenDecision,
  SyncV2PreflightNotice,
  SyncV2PublishJob,
  SyncV2SectionKey,
} from '../types';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BuildPortsInput {
  readonly client: SupabaseClient<Database>;
}

const DAY_LABELS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const DAY_BY_LABEL = new Map<string, number>(DAY_LABELS.map((label, index) => [label, index]));

type WriterClassification =
  | 'retryable'
  | 'permission'
  | 'validation'
  | 'unsupported_field'
  | 'quota';

function decisionKey(decision: Pick<SyncV2FrozenDecision, 'sectionKey' | 'fieldKey'>): string {
  return `${decision.sectionKey}::${decision.fieldKey}`;
}

function selectedSectionKeys(decisions: ReadonlyArray<SyncV2FrozenDecision>): SyncV2SectionKey[] {
  return [...new Set(decisions.map((decision) => decision.sectionKey))];
}

function classifyWriterError(error: unknown): {
  readonly classification: WriterClassification;
  readonly errors: ReadonlyArray<SyncV2PreflightNotice>;
} {
  const message = error instanceof Error ? error.message : 'V2 publish writer failed.';
  const lower = message.toLowerCase();
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : 'V2_WRITER_FAILED';

  let classification: WriterClassification = 'retryable';
  if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    classification = 'quota';
  } else if (
    status === 401 ||
    status === 403 ||
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('unauthorized') ||
    lower.includes('scope')
  ) {
    classification = 'permission';
  } else if (
    lower.includes('unsupported') ||
    lower.includes('update mask') ||
    lower.includes('field mask') ||
    code.includes('unsupported')
  ) {
    classification = 'unsupported_field';
  } else if (
    status === 400 ||
    lower.includes('invalid') ||
    lower.includes('validation') ||
    lower.includes('required')
  ) {
    classification = 'validation';
  }

  return {
    classification,
    errors: [{ code: code.toUpperCase(), message }],
  };
}

function unsupportedWriter(message: string): {
  readonly ok: false;
  readonly failure: {
    readonly classification: 'unsupported_field';
    readonly errors: ReadonlyArray<SyncV2PreflightNotice>;
  };
} {
  return {
    ok: false,
    failure: {
      classification: 'unsupported_field',
      errors: [{ code: 'V2_UNSUPPORTED_EXPORT_SELECTION', message }],
    },
  };
}

function snapshotValuesForDecisions(input: {
  readonly before: SyncV2CanonicalSnapshot;
  readonly after: SyncV2CanonicalSnapshot;
  readonly decisions: ReadonlyArray<SyncV2FrozenDecision>;
  readonly direction: SyncV2DirectionIntent;
}): { readonly oldValues: Record<string, unknown>; readonly newValues: Record<string, unknown> } {
  const diff = buildSyncV2Diff({ nabatable: input.before, google: input.after });
  const byKey = new Map(diff.items.map((item) => [`${item.sectionKey}::${item.fieldKey}`, item]));
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const decision of input.decisions) {
    const item = byKey.get(decisionKey(decision));
    if (!item) continue;
    const key = decisionKey(decision);
    if (input.direction === 'import_to_nabatable') {
      oldValues[key] = item.normalizedNabatableValue;
      newValues[key] = item.normalizedGoogleValue;
    } else {
      oldValues[key] = item.normalizedGoogleValue;
      newValues[key] = item.normalizedNabatableValue;
    }
  }

  return { oldValues, newValues };
}

function categoryKey(category: Pick<SyncV2CategoryValue, 'categoryCode' | 'displayName'>): string {
  return category.categoryCode ?? category.displayName.toLowerCase();
}

function serviceAreaKey(
  serviceArea: Pick<SyncV2ServiceAreaValue, 'areaType' | 'regionCode' | 'displayName'>,
): string {
  return [
    serviceArea.areaType,
    serviceArea.regionCode ?? '',
    serviceArea.displayName.toLowerCase(),
  ].join('|');
}

function stableServicePeriodKey(period: {
  readonly dayOfWeek: number | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly bookingOption: string;
  readonly name: string;
}): string {
  return [
    period.dayOfWeek === null ? 'any' : String(period.dayOfWeek),
    period.startTime,
    period.endTime,
    period.bookingOption,
    period.name.trim().toLowerCase(),
  ].join('|');
}

function servicePeriodReplacementKey(period: {
  readonly dayOfWeek: number | null;
  readonly bookingOption: string;
}): string {
  return [
    period.dayOfWeek === null ? 'any' : String(period.dayOfWeek),
    period.bookingOption.trim().toLowerCase(),
  ].join('|');
}

function selectedFieldSet(
  decisions: ReadonlyArray<SyncV2FrozenDecision>,
  sectionKey: SyncV2SectionKey,
): ReadonlySet<string> {
  return new Set(
    decisions
      .filter((decision) => decision.sectionKey === sectionKey)
      .map((decision) => decision.fieldKey),
  );
}

function upsertByFieldKey<T>(
  base: ReadonlyArray<T>,
  selectedKeys: ReadonlySet<string>,
  source: ReadonlyArray<T>,
  keyFor: (value: T) => string,
): T[] {
  const byKey = new Map(base.map((value) => [keyFor(value), value]));
  for (const key of selectedKeys) {
    const replacement = source.find((value) => keyFor(value) === key) ?? null;
    if (replacement) {
      byKey.set(key, replacement);
    } else {
      byKey.delete(key);
    }
  }
  return [...byKey.values()];
}

function normalizeGoogleCategoryName(categoryCode: string | null): string | null {
  if (!categoryCode) return null;
  const trimmed = categoryCode.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('categories/') ? trimmed : `categories/${trimmed}`;
}

function buildGoogleCategoryPayload(category: SyncV2CategoryValue) {
  const name = normalizeGoogleCategoryName(category.categoryCode);
  if (!name) {
    throw new Error(`Category "${category.displayName}" requires a Google category code.`);
  }
  return {
    name,
    displayName: category.displayName,
    moreHoursTypes: category.moreHoursTypes.map((type) => ({
      ...(type.hoursTypeId ? { hoursTypeId: type.hoursTypeId } : {}),
      ...(type.displayName ? { displayName: type.displayName } : {}),
      ...(type.localizedDisplayName ? { localizedDisplayName: type.localizedDisplayName } : {}),
    })),
  };
}

function buildGoogleCategoriesPatch(categories: ReadonlyArray<SyncV2CategoryValue>) {
  if (categories.length === 0) {
    throw new Error('At least one category is required before exporting categories to Google.');
  }
  const primary = categories.find((category) => category.isPrimary) ?? categories[0];
  if (!primary) {
    throw new Error('At least one category is required before exporting categories to Google.');
  }
  return {
    primaryCategory: buildGoogleCategoryPayload(primary),
    additionalCategories: categories
      .filter((category) => category !== primary)
      .map(buildGoogleCategoryPayload),
  };
}

function googleBusinessTypeForServiceAreas(serviceAreas: ReadonlyArray<SyncV2ServiceAreaValue>) {
  for (const area of serviceAreas) {
    const businessType =
      area.placeData && typeof area.placeData.businessType === 'string'
        ? area.placeData.businessType.trim()
        : '';
    if (businessType) return businessType;
  }
  return 'CUSTOMER_LOCATION_ONLY';
}

function buildGoogleServiceAreaPatch(serviceAreas: ReadonlyArray<SyncV2ServiceAreaValue>) {
  if (serviceAreas.length === 0) {
    throw new Error(
      'At least one service area is required before exporting service areas to Google.',
    );
  }
  const placeInfos = serviceAreas
    .map((area) => area.placeData)
    .filter((placeData): placeData is Record<string, unknown> =>
      Boolean(placeData && Object.keys(placeData).length > 0),
    );
  const regionCode =
    serviceAreas.find((area) => area.regionCode)?.regionCode ??
    serviceAreas
      .map((area) =>
        area.placeData && typeof area.placeData.regionCode === 'string'
          ? area.placeData.regionCode.trim()
          : null,
      )
      .find((value): value is string => Boolean(value)) ??
    undefined;

  return {
    businessType: googleBusinessTypeForServiceAreas(serviceAreas),
    ...(regionCode ? { regionCode } : {}),
    ...(placeInfos.length > 0 ? { places: { placeInfos } } : {}),
  };
}

function buildGoogleServiceItemsPatch(serviceItems: ReadonlyArray<SyncV2ServiceItemValue>) {
  return serviceItems.map((item) => {
    if (!item.payload || Object.keys(item.payload).length === 0) {
      throw new Error(`Service item "${item.itemKey}" requires a canonical Google payload.`);
    }
    return item.payload;
  });
}

function normalizeAttributeName(attribute: SyncV2AttributeValue): string {
  const raw =
    attribute.attributeName?.trim() ||
    attribute.attributeId?.trim() ||
    attribute.attributeKey.trim();
  if (!raw) {
    throw new Error(`Attribute "${attribute.attributeKey}" requires a Google attribute name.`);
  }
  const locationScoped = raw.match(/\/attributes\/([^/]+)$/);
  if (locationScoped?.[1]) {
    return `attributes/${locationScoped[1]}`;
  }
  return raw.startsWith('attributes/') ? raw : `attributes/${raw}`;
}

function buildGoogleAttribute(attribute: SyncV2AttributeValue): Record<string, unknown> {
  const name = normalizeAttributeName(attribute);
  const valueType = attribute.valueType.toUpperCase();
  if (valueType.includes('BOOL')) {
    if (typeof attribute.boolValue !== 'boolean') {
      throw new Error(`Attribute "${attribute.attributeKey}" requires a boolean value.`);
    }
    return { name, values: [{ boolValue: attribute.boolValue }] };
  }
  if (valueType.includes('URL')) {
    const uris = [
      ...(attribute.uriValue ? [attribute.uriValue] : []),
      ...attribute.uriValues,
    ].filter((value, index, all) => value && all.indexOf(value) === index);
    if (uris.length === 0) {
      throw new Error(`Attribute "${attribute.attributeKey}" requires at least one URL.`);
    }
    return { name, uriValues: uris.map((uri) => ({ uri })) };
  }
  if (valueType.includes('ENUM')) {
    const enumValues = [...attribute.enumValues, ...attribute.unsetEnumValues];
    if (enumValues.length === 0 || enumValues.some((value) => /\s/.test(value.trim()))) {
      throw new Error(
        `Attribute "${attribute.attributeKey}" requires raw Google enum value IDs before export.`,
      );
    }
    return {
      name,
      repeatedEnumValue: {
        setValues: [...attribute.enumValues],
        unsetValues: [...attribute.unsetEnumValues],
      },
    };
  }
  if (!attribute.textValue) {
    throw new Error(`Attribute "${attribute.attributeKey}" requires a text value.`);
  }
  return { name, values: [{ stringValue: attribute.textValue }] };
}

function buildGoogleStorefrontAddressPatch(input: {
  readonly nabatableAddress: string | null;
  readonly googleAddress: SyncV2CanonicalSnapshot['profile']['storefrontAddress'];
}) {
  if (!input.nabatableAddress?.trim()) {
    throw new Error('Address export requires a Nabatable address value.');
  }
  if (!input.googleAddress?.regionCode) {
    throw new Error('Address export requires an existing Google storefrontAddress region code.');
  }
  return {
    addressLines: [input.nabatableAddress.trim()],
    locality: input.googleAddress.locality ?? undefined,
    administrativeArea: input.googleAddress.administrativeArea ?? undefined,
    postalCode: input.googleAddress.postalCode ?? undefined,
    regionCode: input.googleAddress.regionCode,
    languageCode: input.googleAddress.languageCode ?? undefined,
    sublocality: input.googleAddress.sublocality ?? undefined,
    organization: input.googleAddress.organization ?? undefined,
    recipients: input.googleAddress.recipients,
  };
}

async function applyImportToNabatable(input: {
  readonly client: SupabaseClient<Database>;
  readonly publishJob: SyncV2PublishJob;
}) {
  const decisions = input.publishJob.frozenDecisions.filter(
    (decision) => decision.action === 'import_from_google',
  );
  const [nabBefore, googleBefore] = await Promise.all([
    readNabatableSnapshot({ client: input.client, restaurantId: input.publishJob.restaurantId }),
    readGoogleSnapshot({ client: input.client, restaurantId: input.publishJob.restaurantId }),
  ]);
  const affected = new Set<SyncV2SectionKey>();

  const profileFields = selectedFieldSet(decisions, 'profile');
  if (profileFields.size > 0) {
    const current = await getRestaurantDetails(input.publishJob.restaurantId, input.client);
    await updateRestaurantDetails(
      input.publishJob.restaurantId,
      {
        timezone: current.timezone,
        ...(profileFields.has('name') && googleBefore.canonical.profile.name
          ? { name: googleBefore.canonical.profile.name }
          : {}),
        ...(profileFields.has('businessDescription')
          ? { businessDescription: googleBefore.canonical.profile.businessDescription }
          : {}),
        ...(profileFields.has('contactPhone')
          ? { contactPhone: googleBefore.canonical.profile.contactPhone }
          : {}),
        ...(profileFields.has('address')
          ? { address: googleBefore.canonical.profile.address }
          : {}),
        ...(profileFields.has('googleMapUrl')
          ? { googleMapUrl: googleBefore.canonical.profile.googleMapUrl }
          : {}),
        ...(profileFields.has('googleReviewUrl')
          ? { googleReviewUrl: googleBefore.canonical.profile.googleReviewUrl }
          : {}),
      },
      input.client,
    );
    affected.add('profile');
  }

  const operatingDays = [...selectedFieldSet(decisions, 'operatingHours')]
    .map((fieldKey) => DAY_BY_LABEL.get(fieldKey))
    .filter((day): day is number => typeof day === 'number');
  if (operatingDays.length > 0) {
    const selectedDays = new Set(operatingDays);
    const current = await getOperatingHours(input.publishJob.restaurantId, input.client);
    const googleByDay = new Map(
      googleBefore.canonical.operatingHours.weekly.map((day) => [day.dayOfWeek, day]),
    );
    const payload: UpdateOperatingHoursPayload = {
      weekly: current.weekly.map((day) => {
        if (!selectedDays.has(day.dayOfWeek)) return day;
        const googleDay = googleByDay.get(day.dayOfWeek) as SyncV2OperatingHoursDay | undefined;
        if (!googleDay) return day;
        return {
          dayOfWeek: day.dayOfWeek,
          opensAt: googleDay.isClosed ? null : googleDay.opensAt,
          closesAt: googleDay.isClosed ? null : googleDay.closesAt,
          isClosed: googleDay.isClosed,
          notes: day.notes,
          reservationIntervalMinutes: day.reservationIntervalMinutes,
          reservationSlotTimes: day.reservationSlotTimes,
        };
      }),
      overrides: current.overrides.map((override) => ({ ...override })),
    };
    await updateOperatingHours(input.publishJob.restaurantId, payload, input.client);
    affected.add('operatingHours');
  }

  const servicePeriodKeys = selectedFieldSet(decisions, 'servicePeriods');
  if (servicePeriodKeys.size > 0) {
    const current = await getServicePeriods(input.publishJob.restaurantId, input.client);
    const selectedGooglePeriods = googleBefore.canonical.servicePeriods.periods.filter((period) =>
      servicePeriodKeys.has(period.stableKey),
    );
    const selectedReplacementKeys = new Set(selectedGooglePeriods.map(servicePeriodReplacementKey));
    const preserved = current.filter(
      (period) =>
        !servicePeriodKeys.has(stableServicePeriodKey(period)) &&
        !selectedReplacementKeys.has(servicePeriodReplacementKey(period)),
    );
    const payload: UpdateServicePeriod[] = [
      ...preserved,
      ...selectedGooglePeriods.map((period: SyncV2ServicePeriod) => ({
        name: period.name,
        dayOfWeek: period.dayOfWeek,
        startTime: period.startTime,
        endTime: period.endTime,
        bookingOption: period.bookingOption,
      })),
    ];
    await updateServicePeriods(input.publishJob.restaurantId, payload, input.client);
    affected.add('servicePeriods');
  }

  const contextPayload = await buildBusinessContextImportPayload({
    client: input.client,
    restaurantId: input.publishJob.restaurantId,
    google: googleBefore.canonical,
    decisions,
  });
  if (Object.keys(contextPayload).length > 0) {
    await updateRestaurantBusinessContext(
      input.publishJob.restaurantId,
      contextPayload,
      input.client,
    );
    for (const key of Object.keys(contextPayload)) {
      if (key === 'categories') affected.add('businessContext.categories');
      if (key === 'serviceAreas') affected.add('businessContext.serviceAreas');
      if (key === 'attributes') affected.add('businessContext.attributes');
      if (key === 'serviceItems') affected.add('businessContext.serviceItems');
    }
  }

  return {
    affectedSectionKeys: selectedSectionKeys(decisions).filter((sectionKey) =>
      affected.has(sectionKey),
    ),
    ...snapshotValuesForDecisions({
      before: nabBefore.canonical,
      after: googleBefore.canonical,
      decisions,
      direction: 'import_to_nabatable',
    }),
  };
}

async function buildBusinessContextImportPayload(input: {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly google: SyncV2CanonicalSnapshot;
  readonly decisions: ReadonlyArray<SyncV2FrozenDecision>;
}): Promise<UpdateRestaurantBusinessContextInput> {
  const current = await getRestaurantBusinessContext(input.restaurantId, input.client);
  const payload: UpdateRestaurantBusinessContextInput = {};

  const categoryKeys = selectedFieldSet(input.decisions, 'businessContext.categories');
  if (categoryKeys.size > 0) {
    const selected = input.google.businessContext.categories.filter((row) =>
      categoryKeys.has(categoryKey(row)),
    );
    payload.categories = [
      ...current.core.categories.filter((row) => !categoryKeys.has(categoryKey(row))),
      ...selected.map((row: SyncV2CategoryValue) => ({
        displayName: row.displayName,
        categoryCode: row.categoryCode,
        moreHoursTypes: row.moreHoursTypes.map((type) => ({ ...type })),
        isPrimary: row.isPrimary,
      })),
    ];
  }

  const serviceAreaKeys = selectedFieldSet(input.decisions, 'businessContext.serviceAreas');
  if (serviceAreaKeys.size > 0) {
    const selected = input.google.businessContext.serviceAreas.filter((row) =>
      serviceAreaKeys.has(serviceAreaKey(row)),
    );
    payload.serviceAreas = [
      ...current.core.serviceAreas.filter((row) => !serviceAreaKeys.has(serviceAreaKey(row))),
      ...selected,
    ];
  }

  const attributeKeys = selectedFieldSet(input.decisions, 'businessContext.attributes');
  if (attributeKeys.size > 0) {
    const selected = input.google.businessContext.attributes.filter((row) =>
      attributeKeys.has(row.attributeKey),
    );
    payload.attributes = [
      ...current.core.attributes.filter((row) => !attributeKeys.has(row.attributeKey)),
      ...selected.map((row: SyncV2AttributeValue) => ({
        attributeKey: row.attributeKey,
        attributeName: row.attributeName,
        attributeId: row.attributeId,
        valueType: row.valueType,
        boolValue: row.boolValue,
        textValue: row.textValue,
        uriValue: row.uriValue,
        uriValues: [...row.uriValues],
        enumValues: [...row.enumValues],
        unsetEnumValues: [...row.unsetEnumValues],
      })),
    ];
  }

  const serviceItemKeys = selectedFieldSet(input.decisions, 'businessContext.serviceItems');
  if (serviceItemKeys.size > 0) {
    const selected = input.google.businessContext.serviceItems.filter((row) =>
      serviceItemKeys.has(row.itemKey),
    );
    payload.serviceItems = [
      ...current.core.serviceItems.filter((row) => !serviceItemKeys.has(row.itemKey)),
      ...selected.map((row: SyncV2ServiceItemValue) => ({
        itemKey: row.itemKey,
        itemType: row.itemType,
        displayName: row.displayName,
        description: row.description,
        payload: row.payload,
      })),
    ];
  }

  return payload;
}

async function applyExportToGoogle(input: {
  readonly client: SupabaseClient<Database>;
  readonly publishJob: SyncV2PublishJob;
}) {
  const decisions = input.publishJob.frozenDecisions.filter(
    (decision) => decision.action === 'export_to_google',
  );

  const [nabBefore, googleBefore] = await Promise.all([
    readNabatableSnapshot({ client: input.client, restaurantId: input.publishJob.restaurantId }),
    readGoogleSnapshot({ client: input.client, restaurantId: input.publishJob.restaurantId }),
  ]);
  const affected = new Set<SyncV2SectionKey>();
  const locationPatch: Record<string, unknown> = {};
  const updateMask = new Set<string>();

  const profileFields = [...selectedFieldSet(decisions, 'profile')];
  const exportableProfileFields = profileFields.filter(
    (field): field is 'name' | 'contactPhone' => field === 'name' || field === 'contactPhone',
  );
  const unsupportedProfileFields = profileFields.filter(
    (field) =>
      field !== 'name' &&
      field !== 'businessDescription' &&
      field !== 'contactPhone' &&
      field !== 'address',
  );
  if (unsupportedProfileFields.length > 0) {
    return unsupportedWriter('Selected profile fields include Google read-only fields.');
  }
  if (exportableProfileFields.length > 0) {
    await syncRestaurantProfileWithGoogleBusinessProfile({
      restaurantId: input.publishJob.restaurantId,
      direction: 'push_to_gbp',
      fields: exportableProfileFields,
      client: input.client,
    });
    affected.add('profile');
  }
  if (profileFields.includes('address')) {
    locationPatch.storefrontAddress = buildGoogleStorefrontAddressPatch({
      nabatableAddress: nabBefore.canonical.profile.address,
      googleAddress: googleBefore.canonical.profile.storefrontAddress,
    });
    updateMask.add('storefrontAddress');
    affected.add('profile');
  }
  if (profileFields.includes('businessDescription')) {
    locationPatch.profile = {
      description: nabBefore.canonical.profile.businessDescription ?? '',
    };
    updateMask.add('profile');
    affected.add('profile');
  }

  const operatingDays = [...selectedFieldSet(decisions, 'operatingHours')]
    .map((fieldKey) => DAY_BY_LABEL.get(fieldKey))
    .filter((day): day is number => typeof day === 'number');
  if (operatingDays.length > 0) {
    await syncRestaurantOperatingHoursWithGoogleBusinessProfile({
      restaurantId: input.publishJob.restaurantId,
      direction: 'push_to_gbp',
      selection: { weeklyDays: operatingDays },
      client: input.client,
    });
    affected.add('operatingHours');
  }

  const servicePeriodKeys = selectedFieldSet(decisions, 'servicePeriods');
  if (servicePeriodKeys.size > 0) {
    const selectedNabatableDays = nabBefore.canonical.servicePeriods.periods
      .filter((period) => servicePeriodKeys.has(period.stableKey))
      .map((period) => period.dayOfWeek);
    const selectedGoogleDays = googleBefore.canonical.servicePeriods.periods
      .filter((period) => servicePeriodKeys.has(period.stableKey))
      .map((period) => period.dayOfWeek);
    const dayOfWeeks = [...new Set([...selectedNabatableDays, ...selectedGoogleDays])].filter(
      (day): day is number => day !== null,
    );
    if (dayOfWeeks.length === 0) {
      return unsupportedWriter('Selected service periods do not map to a Google writable weekday.');
    }
    await syncRestaurantServicePeriodsWithGoogleBusinessProfile({
      restaurantId: input.publishJob.restaurantId,
      direction: 'push_to_gbp',
      selection: { dayOfWeeks },
      client: input.client,
    });
    affected.add('servicePeriods');
  }

  const categoryKeys = selectedFieldSet(decisions, 'businessContext.categories');
  if (categoryKeys.size > 0) {
    const categories = upsertByFieldKey<SyncV2CategoryValue>(
      googleBefore.canonical.businessContext.categories,
      categoryKeys,
      nabBefore.canonical.businessContext.categories,
      categoryKey,
    );
    locationPatch.categories = buildGoogleCategoriesPatch(categories);
    updateMask.add('categories');
    affected.add('businessContext.categories');
  }

  const serviceAreaKeys = selectedFieldSet(decisions, 'businessContext.serviceAreas');
  if (serviceAreaKeys.size > 0) {
    const serviceAreas = upsertByFieldKey<SyncV2ServiceAreaValue>(
      googleBefore.canonical.businessContext.serviceAreas,
      serviceAreaKeys,
      nabBefore.canonical.businessContext.serviceAreas,
      serviceAreaKey,
    );
    locationPatch.serviceArea = buildGoogleServiceAreaPatch(serviceAreas);
    updateMask.add('serviceArea');
    affected.add('businessContext.serviceAreas');
  }

  const serviceItemKeys = selectedFieldSet(decisions, 'businessContext.serviceItems');
  if (serviceItemKeys.size > 0) {
    const serviceItems = upsertByFieldKey(
      googleBefore.canonical.businessContext.serviceItems,
      serviceItemKeys,
      nabBefore.canonical.businessContext.serviceItems,
      (item) => item.itemKey,
    );
    locationPatch.serviceItems = buildGoogleServiceItemsPatch(serviceItems);
    updateMask.add('serviceItems');
    affected.add('businessContext.serviceItems');
  }

  const attributeKeys = selectedFieldSet(decisions, 'businessContext.attributes');
  const attributesPatch =
    attributeKeys.size > 0
      ? {
          attributes: nabBefore.canonical.businessContext.attributes
            .filter((attribute) => attributeKeys.has(attribute.attributeKey))
            .map(buildGoogleAttribute),
          attributeMask: [
            ...new Set(
              [...attributeKeys].map((key) => {
                const attribute =
                  nabBefore.canonical.businessContext.attributes.find(
                    (row) => row.attributeKey === key,
                  ) ??
                  googleBefore.canonical.businessContext.attributes.find(
                    (row) => row.attributeKey === key,
                  );
                if (!attribute) {
                  throw new Error(`Selected attribute "${key}" no longer exists.`);
                }
                return normalizeAttributeName(attribute);
              }),
            ),
          ],
        }
      : undefined;
  if (attributeKeys.size > 0) {
    affected.add('businessContext.attributes');
  }

  if (updateMask.size > 0 || attributesPatch) {
    await patchRestaurantGoogleBusinessProfileLocationFields({
      restaurantId: input.publishJob.restaurantId,
      locationPatch,
      updateMask: [...updateMask],
      attributesPatch,
      client: input.client,
    });
  }

  return {
    ok: true as const,
    output: {
      affectedSectionKeys: selectedSectionKeys(decisions).filter((sectionKey) =>
        affected.has(sectionKey),
      ),
      googleUpdateMasks: input.publishJob.googleUpdateMasks,
      ...snapshotValuesForDecisions({
        before: nabBefore.canonical,
        after: googleBefore.canonical,
        decisions,
        direction: 'export_to_google',
      }),
    },
  };
}

export function buildOrchestratorPorts({ client }: BuildPortsInput): OrchestratorPorts {
  return {
    directionIntentSupported(intent: SyncV2DirectionIntent): boolean {
      return intent === 'import_to_nabatable' || intent === 'export_to_google';
    },
    async verifyContractLock(job: SyncV2PublishJob): Promise<ReadonlyArray<SyncV2PreflightNotice>> {
      const errors: SyncV2PreflightNotice[] = [];
      try {
        const frozenHash = hashFrozenDecisions(job.frozenDecisions);
        if (frozenHash !== job.frozenDecisionsHash) {
          errors.push({
            code: 'V2_FROZEN_DECISIONS_HASH_MISMATCH',
            message: 'Frozen decision contract no longer matches the publish job lock.',
          });
        }
        const [nab, goo] = await Promise.all([
          readNabatableSnapshot({ client, restaurantId: job.restaurantId }),
          readGoogleSnapshot({ client, restaurantId: job.restaurantId }),
        ]);
        if (nab.snapshot.hash !== job.frozenNabatableSnapshotHash) {
          errors.push({
            code: 'V2_NABATABLE_SNAPSHOT_DRIFT',
            message: 'Nabatable snapshot changed since preflight; re-review and re-preflight.',
          });
        }
        if (goo.snapshot.hash !== job.frozenGoogleSnapshotHash) {
          errors.push({
            code: 'V2_GOOGLE_SNAPSHOT_DRIFT',
            message: 'Google snapshot changed since preflight; re-review and re-preflight.',
          });
        }
        const liveDiff = buildSyncV2Diff({ nabatable: nab.canonical, google: goo.canonical });
        const liveByKey = new Map<string, (typeof liveDiff.items)[number]>(
          liveDiff.items.map((i) => [`${i.sectionKey}::${i.fieldKey}`, i] as const),
        );
        for (const decision of job.frozenDecisions) {
          const live = liveByKey.get(decisionKey(decision));
          if (!live) {
            errors.push({
              code: 'V2_DECISION_DIFF_DISAPPEARED',
              message: `Reviewed field no longer differs: ${decision.sectionKey}.${decision.fieldKey}.`,
              sectionKey: decision.sectionKey,
              fieldKey: decision.fieldKey,
            });
            continue;
          }
          if (
            live.nabatableValueHash !== decision.nabatableValueHash ||
            live.googleValueHash !== decision.googleValueHash
          ) {
            errors.push({
              code: 'V2_DECISION_VALUE_DRIFT',
              message: `Reviewed field changed since preflight: ${decision.sectionKey}.${decision.fieldKey}.`,
              sectionKey: decision.sectionKey,
              fieldKey: decision.fieldKey,
            });
          }
        }
      } catch (err) {
        errors.push({
          code: 'V2_CONTRACT_LOCK_VERIFY_FAILED',
          message: err instanceof Error ? err.message : 'Contract lock verification failed.',
        });
      }
      return errors;
    },
    async applyToNabatable(input) {
      try {
        const output = await applyImportToNabatable({ client, publishJob: input.publishJob });
        return { ok: true, output };
      } catch (error) {
        return { ok: false, failure: classifyWriterError(error) };
      }
    },
    async patchGoogle(input) {
      try {
        const result = await applyExportToGoogle({ client, publishJob: input.publishJob });
        if (!result.ok) return result;
        return result;
      } catch (error) {
        return { ok: false, failure: classifyWriterError(error) };
      }
    },
  };
}

/**
 * Test-only helper: rebuild the frozen-decisions hash for a job from the
 * frozen_decisions JSON column. Useful for parallel-validation tests.
 */
export function rebuildFrozenDecisionsHash(frozenDecisionsJson: Json): string {
  const decisions = castJsonDecisions(frozenDecisionsJson);
  return hashFrozenDecisions(
    decisions.map((d: SyncV2Decision) => ({
      sectionKey: d.sectionKey,
      fieldKey: d.fieldKey,
      action: d.action,
      nabatableValueHash: d.nabatableValueHash,
      googleValueHash: d.googleValueHash,
    })),
  );
}

export const publishWiringTestUtils = {
  buildGoogleAttribute,
};
