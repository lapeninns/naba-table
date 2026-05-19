import { createHash } from 'node:crypto';

import {
  getRestaurantBusinessContext,
  updateRestaurantBusinessContext,
  type RestaurantBusinessContextSnapshot,
  type UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';
import { getRestaurantDetails, updateRestaurantDetails } from '@/server/restaurants/details';
import { getOperatingHours, updateOperatingHours } from '@/server/restaurants/operatingHours';
import { getServicePeriods, updateServicePeriods } from '@/server/restaurants/servicePeriods';
import { getServiceSupabaseClient } from '@/server/supabase';

import { readGoogleBusinessProfileBusinessInfo } from './business-info';
import {
  buildPullOperatingHoursPayload,
  buildPullProfilePatch,
  buildPullServicePeriodsPayload,
  buildServicePeriodsVerificationSummary,
  type CoreSyncDirection,
  type ProfileVerificationField,
} from './core-sync';
import {
  getGoogleBusinessProfileConnectionState,
  syncGoogleBusinessProfileBusinessInformation,
  syncRestaurantOperatingHoursWithGoogleBusinessProfile,
  syncRestaurantProfileWithGoogleBusinessProfile,
  syncRestaurantServicePeriodsWithGoogleBusinessProfile,
} from './service';

import type { GoogleBusinessProfileBusinessInfo } from './business-info';
import type { UpdateRestaurantDetailsInput } from '@/server/restaurants/details';
import type { UpdateOperatingHoursPayload } from '@/server/restaurants/operatingHours';
import type { UpdateServicePeriod } from '@/server/restaurants/servicePeriods';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type ExternalProfileRow = Database['public']['Tables']['restaurant_external_profiles']['Row'];
type DraftRow = Database['public']['Tables']['restaurant_external_profile_drafts']['Row'];
type PublishEventRow =
  Database['public']['Tables']['restaurant_external_profile_publish_events']['Row'];
type PublishJobRow =
  Database['public']['Tables']['restaurant_external_profile_publish_jobs']['Row'];

const PROVIDER = 'google_business_profile';
const EDITABLE_DRAFT_STATUSES = ['review_ready', 'approved', 'failed', 'partially_published'];
const PUBLISHABLE_DRAFT_STATUSES = ['approved', 'failed', 'partially_published'];
const READ_ONLY_REVIEW_DRAFT_STATUSES = ['published', 'publishing', 'archived'];
const APPROVAL_REQUIRED_DRAFT_STATUS = 'review_ready';
const GOOGLE_PUSH_SECTIONS = ['profile', 'operatingHours', 'servicePeriods'];
const GOOGLE_RETRYABLE_JOB_STATUSES = ['google_failed', 'partially_published'];

export type GoogleBusinessProfilePublishMode =
  | 'nabatable_only'
  | 'nabatable_and_google'
  | 'google_only';

export type GoogleBusinessProfilePublishDirectionIntent =
  | 'google_to_nabatable'
  | 'google_to_nabatable_with_google_sync'
  | 'nabatable_to_google';

export type GoogleBusinessProfileSyncDecisionAction =
  | 'import_from_google'
  | 'export_to_google'
  | 'ignore';

export type GoogleBusinessProfileFieldDecision = {
  sectionKey: GoogleBusinessProfileDraftSectionKey;
  fieldKey: string;
  action: GoogleBusinessProfileSyncDecisionAction;
  decidedByUserId: string;
  decidedAt: string;
  reviewedNabatableValueHash: string;
  reviewedGoogleValueHash: string;
};

export type GoogleBusinessProfileFieldDecisionInput = {
  sectionKey: GoogleBusinessProfileDraftSectionKey;
  fieldKey: string;
  action: GoogleBusinessProfileSyncDecisionAction;
  reviewedNabatableValueHash: string;
  reviewedGoogleValueHash: string;
};

export type GoogleBusinessProfileAuditFlow =
  | 'google_to_nabatable_apply'
  | 'nabatable_to_google_sync';

export type GoogleBusinessProfileGoogleUpdateMask =
  | 'title'
  | 'phoneNumbers'
  | 'regularHours'
  | 'specialHours'
  | 'moreHours';

export type GoogleBusinessProfileGoogleErrorClassification =
  | 'retryable'
  | 'permission'
  | 'validation'
  | 'unsupported_field'
  | 'quota';

export type GoogleBusinessProfilePublishPreflightNotice = {
  code: string;
  message: string;
  fieldKey?: string;
  sectionKey?: GoogleBusinessProfileDraftSectionKey;
  googleUpdateMask?: GoogleBusinessProfileGoogleUpdateMask;
};

export type GoogleBusinessProfileDraftSectionKey =
  | 'profile'
  | 'operatingHours'
  | 'servicePeriods'
  | 'businessContext.categories'
  | 'businessContext.serviceAreas'
  | 'businessContext.attributes'
  | 'businessContext.serviceItems';

export type GoogleBusinessProfileDraftItem = {
  fieldKey: string;
  label: string;
  sectionKey: GoogleBusinessProfileDraftSectionKey;
  currentValue: Json;
  providerValue: Json;
  proposedValue: Json;
  direction: CoreSyncDirection;
  status: 'ready' | 'unchanged' | 'unsupported' | 'warning';
  selected: boolean;
  normalizedNabatableValue: Json;
  normalizedGoogleValue: Json;
  nabatableValueHash: string;
  googleValueHash: string;
  capabilities: {
    canImportFromGoogle: boolean;
    canExportToGoogle: boolean;
    canIgnore: boolean;
  };
  blockedReasons: string[];
  canPublishToNabatable: boolean;
  canPushToGoogle: boolean;
  warnings: string[];
};

export type GoogleBusinessProfileDraftSection = {
  sectionKey: GoogleBusinessProfileDraftSectionKey;
  label: string;
  status: 'ready' | 'unchanged' | 'stale' | 'blocked';
  summary: string;
  items: GoogleBusinessProfileDraftItem[];
  canPublishToNabatable: boolean;
  canPushToGoogle: boolean;
  blockedReasons: string[];
};

export type GoogleBusinessProfileWorkflowDraft = {
  id: string;
  status: DraftRow['status'];
  fetchedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  staleSections: string[];
  conflictMetadata: Json;
  selectedApprovals: Record<string, boolean>;
  decisions: GoogleBusinessProfileFieldDecision[];
  sourceSnapshotRefs: Json;
  coreSnapshotHashes: Record<string, string>;
  sectionDiffs: GoogleBusinessProfileDraftSection[];
  createdAt: string;
  updatedAt: string;
};

export type GoogleBusinessProfileActivePublishJob = {
  id: string;
  draftId: string;
  idempotencyKey: string;
  mode: GoogleBusinessProfilePublishMode;
  directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  status: PublishJobRow['status'];
  selectedApprovals: Record<string, boolean>;
  decisions: GoogleBusinessProfileFieldDecision[];
  nabatableSections: string[];
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
  postNabatableCoreHashes: Record<string, string>;
  errorClassification: GoogleBusinessProfileGoogleErrorClassification | null;
  errors: Json;
  nabatableEventId: string | null;
  googleEventId: string | null;
  canRetryGooglePush: boolean;
  retryBlockedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoogleBusinessProfileWorkflowAuditEvent = {
  id: string;
  draftId: string | null;
  direction: PublishEventRow['direction'];
  flow: GoogleBusinessProfileAuditFlow;
  directionLabel: string;
  affectedSections: string[];
  googleUpdateMasks: Json;
  result: PublishEventRow['result'];
  errors: Json;
  createdAt: string;
};

export type GoogleBusinessProfileWorkflowResponse = {
  latestDraft: GoogleBusinessProfileWorkflowDraft | null;
  sectionSummaries: Array<{
    sectionKey: GoogleBusinessProfileDraftSectionKey;
    label: string;
    status: GoogleBusinessProfileDraftSection['status'];
    selectedCount: number;
    itemCount: number;
  }>;
  publishableSections: GoogleBusinessProfileDraftSectionKey[];
  blockedReasons: string[];
  auditEvents: GoogleBusinessProfileWorkflowAuditEvent[];
  activePublishJob: GoogleBusinessProfileActivePublishJob | null;
};

export type GoogleBusinessProfilePublishPreflight = {
  publishJobId: string;
  publishPlanId: string;
  idempotencyKey: string;
  mode: GoogleBusinessProfilePublishMode;
  directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  selectedApprovals: Record<string, boolean>;
  decisions: GoogleBusinessProfileFieldDecision[];
  nabatableUpdates: GoogleBusinessProfileDraftItem[];
  googleUpdates: GoogleBusinessProfileDraftItem[];
  pullOnlyItems: GoogleBusinessProfileDraftItem[];
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
  warnings: GoogleBusinessProfilePublishPreflightNotice[];
  errors: GoogleBusinessProfilePublishPreflightNotice[];
  canPublish: boolean;
  canPushToGoogle: boolean;
  activePublishJob: GoogleBusinessProfileActivePublishJob;
};

export type PublishGoogleBusinessProfileDraftResult = GoogleBusinessProfileWorkflowResponse & {
  result: 'published' | 'partially_published';
  nabatableEventId: string | null;
  googleEventId: string | null;
};

export type RetryGoogleBusinessProfilePushResult = GoogleBusinessProfileWorkflowResponse & {
  googleEventId: string | null;
};

type CoreSnapshots = {
  profile: Awaited<ReturnType<typeof getRestaurantDetails>>;
  operatingHours: Awaited<ReturnType<typeof getOperatingHours>>;
  servicePeriods: Awaited<ReturnType<typeof getServicePeriods>>;
  businessContext: RestaurantBusinessContextSnapshot;
};

function getClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

function nowIso(): string {
  return new Date().toISOString();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function toJson(value: unknown): Json {
  return value as Json;
}

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

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  const details = typeof record.details === 'string' ? record.details.toLowerCase() : '';

  return (
    code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint') ||
    details.includes('duplicate key') ||
    details.includes('unique constraint')
  );
}

function formatDraftStatus(status: string): string {
  return status.replaceAll('_', ' ');
}

function createDraftStateError(status: string, action: 'edit' | 'publish'): Error {
  const verb = action === 'edit' ? 'changed' : 'applied';
  const guidance = 'Check for changes again before continuing.';
  const error = new Error(
    `Google Business Profile review is ${formatDraftStatus(status)} and cannot be ${verb}. ${guidance}`,
  );
  error.name = 'GBP_DRAFT_INVALID_STATE';
  return error;
}

function assertDraftEditable(status: string): void {
  if (!EDITABLE_DRAFT_STATUSES.includes(status)) {
    throw createDraftStateError(status, 'edit');
  }
}

function assertDraftPublishable(status: string): void {
  if (status === APPROVAL_REQUIRED_DRAFT_STATUS) {
    throw createWorkflowNamedError(
      'GBP_DRAFT_NOT_APPROVED',
      'Review and approve the selected Google profile changes before applying them.',
    );
  }
  if (!PUBLISHABLE_DRAFT_STATUSES.includes(status)) {
    throw createDraftStateError(status, 'publish');
  }
}

function toObjectRecord(value: Json | null): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
    ),
  );
}

function toStringRecord(value: Json | null): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

const FIELD_DECISIONS_METADATA_KEY = '__fieldDecisions';

function isGoogleProfileSyncDecisionAction(
  value: unknown,
): value is GoogleBusinessProfileSyncDecisionAction {
  return value === 'import_from_google' || value === 'export_to_google' || value === 'ignore';
}

function normalizeFieldDecision(value: unknown): GoogleBusinessProfileFieldDecision | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.sectionKey !== 'string' ||
    typeof record.fieldKey !== 'string' ||
    !isGoogleProfileSyncDecisionAction(record.action) ||
    typeof record.reviewedNabatableValueHash !== 'string' ||
    typeof record.reviewedGoogleValueHash !== 'string'
  ) {
    return null;
  }

  return {
    sectionKey: record.sectionKey as GoogleBusinessProfileDraftSectionKey,
    fieldKey: record.fieldKey,
    action: record.action,
    decidedByUserId:
      typeof record.decidedByUserId === 'string' ? record.decidedByUserId : 'unknown',
    decidedAt: typeof record.decidedAt === 'string' ? record.decidedAt : nowIso(),
    reviewedNabatableValueHash: record.reviewedNabatableValueHash,
    reviewedGoogleValueHash: record.reviewedGoogleValueHash,
  };
}

function normalizeFieldDecisions(value: unknown): GoogleBusinessProfileFieldDecision[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byFieldKey = new Map<string, GoogleBusinessProfileFieldDecision>();
  for (const entry of value) {
    const decision = normalizeFieldDecision(entry);
    if (decision) {
      byFieldKey.set(decision.fieldKey, decision);
    }
  }
  return [...byFieldKey.values()];
}

function extractFieldDecisions(value: Json | null): GoogleBusinessProfileFieldDecision[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return normalizeFieldDecisions((value as Record<string, unknown>)[FIELD_DECISIONS_METADATA_KEY]);
}

function selectedApprovalsWithDecisions(
  selectedApprovals: Record<string, boolean>,
  decisions: GoogleBusinessProfileFieldDecision[],
): Json {
  return toJson({
    ...selectedApprovals,
    ...(decisions.length > 0 ? { [FIELD_DECISIONS_METADATA_KEY]: decisions } : {}),
  });
}

function normalizeGoogleMasks(
  value: string[] | null | undefined,
): GoogleBusinessProfileGoogleUpdateMask[] {
  const allowed = new Set<GoogleBusinessProfileGoogleUpdateMask>([
    'title',
    'phoneNumbers',
    'regularHours',
    'specialHours',
    'moreHours',
  ]);

  return [...new Set(value ?? [])].filter((mask): mask is GoogleBusinessProfileGoogleUpdateMask =>
    allowed.has(mask as GoogleBusinessProfileGoogleUpdateMask),
  );
}

function directionIntentForPublishMode(
  mode: GoogleBusinessProfilePublishMode,
): GoogleBusinessProfilePublishDirectionIntent {
  switch (mode) {
    case 'nabatable_and_google':
      return 'google_to_nabatable_with_google_sync';
    case 'google_only':
      return 'nabatable_to_google';
    case 'nabatable_only':
    default:
      return 'google_to_nabatable';
  }
}

function publishModeForDirectionIntent(
  directionIntent: GoogleBusinessProfilePublishDirectionIntent,
): GoogleBusinessProfilePublishMode {
  switch (directionIntent) {
    case 'google_to_nabatable_with_google_sync':
      return 'nabatable_and_google';
    case 'nabatable_to_google':
      return 'google_only';
    case 'google_to_nabatable':
    default:
      return 'nabatable_only';
  }
}

function pushToGoogleForDirectionIntent(
  directionIntent: GoogleBusinessProfilePublishDirectionIntent,
): boolean {
  return directionIntent !== 'google_to_nabatable';
}

function normalizePublishDirectionIntent(input: {
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
}): GoogleBusinessProfilePublishDirectionIntent {
  const legacyIntent =
    input.pushToGoogle === undefined
      ? undefined
      : input.pushToGoogle
        ? 'google_to_nabatable_with_google_sync'
        : 'google_to_nabatable';

  if (input.directionIntent && legacyIntent && input.directionIntent !== legacyIntent) {
    throw createWorkflowNamedError(
      'GBP_DIRECTION_CONFLICT',
      'Publish direction conflicts with the legacy Google push flag.',
    );
  }

  return input.directionIntent ?? legacyIntent ?? 'google_to_nabatable';
}

function assertApprovalWorkflowDirectionSupported(
  directionIntent: GoogleBusinessProfilePublishDirectionIntent,
) {
  if (
    directionIntent === 'google_to_nabatable' ||
    directionIntent === 'google_to_nabatable_with_google_sync' ||
    directionIntent === 'nabatable_to_google'
  ) {
    return;
  }

  throw createWorkflowNamedError(
    'GBP_DIRECTION_CONFLICT',
    'Unsupported Google Business Profile publish direction.',
  );
}

function assertApprovalWorkflowOneWay(
  directionIntent: GoogleBusinessProfilePublishDirectionIntent,
) {
  assertApprovalWorkflowDirectionSupported(directionIntent);
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isEqualValue(left: unknown, right: unknown): boolean {
  return stableStringify(left ?? null) === stableStringify(right ?? null);
}

type DraftItemInput = Omit<
  GoogleBusinessProfileDraftItem,
  | 'status'
  | 'selected'
  | 'normalizedNabatableValue'
  | 'normalizedGoogleValue'
  | 'nabatableValueHash'
  | 'googleValueHash'
  | 'capabilities'
  | 'blockedReasons'
> & {
  comparisonCurrentValue?: unknown;
  comparisonProposedValue?: unknown;
  defaultSelected?: boolean;
};

async function findExternalProfile(
  restaurantId: string,
  client: DbClient,
): Promise<ExternalProfileRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profiles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function readCoreSnapshots(restaurantId: string, client: DbClient): Promise<CoreSnapshots> {
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

function buildCoreSnapshotHashes(
  core: CoreSnapshots,
): Record<GoogleBusinessProfileDraftSectionKey, string> {
  return {
    profile: hashJson({
      name: core.profile.name,
      contactPhone: core.profile.contactPhone,
      address: core.profile.address,
      googleMapUrl: core.profile.googleMapUrl,
      googleReviewUrl: core.profile.googleReviewUrl,
    }),
    operatingHours: hashJson({
      weekly: core.operatingHours.weekly,
      overrides: core.operatingHours.overrides,
    }),
    servicePeriods: hashJson(core.servicePeriods),
    'businessContext.categories': hashJson(core.businessContext.core.categories),
    'businessContext.serviceAreas': hashJson(core.businessContext.core.serviceAreas),
    'businessContext.attributes': hashJson(core.businessContext.core.attributes),
    'businessContext.serviceItems': hashJson(core.businessContext.core.serviceItems),
  };
}

function makeItem(input: DraftItemInput): GoogleBusinessProfileDraftItem {
  const { comparisonCurrentValue, comparisonProposedValue, defaultSelected, ...item } = input;
  const normalizedNabatableValue =
    comparisonCurrentValue === undefined ? item.currentValue : comparisonCurrentValue;
  const normalizedGoogleValue =
    comparisonProposedValue === undefined ? item.providerValue : comparisonProposedValue;
  const changed = !isEqualValue(normalizedNabatableValue, normalizedGoogleValue);
  const blockedReasons = [
    ...(!item.canPublishToNabatable
      ? [`${item.label} cannot be imported from Google automatically.`]
      : []),
    ...(!item.canPushToGoogle ? [`${item.label} cannot be exported to Google automatically.`] : []),
  ];

  return {
    ...item,
    status: changed ? 'ready' : 'unchanged',
    selected: changed && (defaultSelected ?? item.canPublishToNabatable),
    normalizedNabatableValue: toJson(normalizedNabatableValue),
    normalizedGoogleValue: toJson(normalizedGoogleValue),
    nabatableValueHash: hashJson(normalizedNabatableValue),
    googleValueHash: hashJson(normalizedGoogleValue),
    capabilities: {
      canImportFromGoogle: item.canPublishToNabatable,
      canExportToGoogle: item.canPushToGoogle,
      canIgnore: true,
    },
    blockedReasons,
  };
}

function primaryPhone(businessInfo: GoogleBusinessProfileBusinessInfo): string | null {
  return (
    businessInfo.phoneNumbers.find((row) => row.isPrimary)?.phoneNumber ??
    businessInfo.phoneNumbers[0]?.phoneNumber ??
    null
  );
}

function primaryAddress(businessInfo: GoogleBusinessProfileBusinessInfo): string | null {
  return (
    businessInfo.addresses.find((row) => row.isPrimary)?.formattedAddress ??
    businessInfo.addresses[0]?.formattedAddress ??
    null
  );
}

function primaryLink(
  businessInfo: GoogleBusinessProfileBusinessInfo,
  linkType: string,
): string | null {
  return (
    businessInfo.links.find((row) => row.linkType === linkType && row.isPrimary)?.url ??
    businessInfo.links.find((row) => row.linkType === linkType)?.url ??
    null
  );
}

function buildProfileSection(
  core: CoreSnapshots,
  businessInfo: GoogleBusinessProfileBusinessInfo,
  externalLocationTitle: string | null,
): GoogleBusinessProfileDraftSection {
  const providerName = normalizeText(externalLocationTitle ?? businessInfo.details?.businessName);
  const providerPhone = primaryPhone(businessInfo);
  const providerAddress = primaryAddress(businessInfo);
  const providerGoogleMapUrl = primaryLink(businessInfo, 'google_map');
  const providerGoogleReviewUrl = primaryLink(businessInfo, 'google_review');
  const items: GoogleBusinessProfileDraftItem[] = [
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.name',
      label: 'Business name',
      currentValue: core.profile.name,
      providerValue: providerName,
      proposedValue: providerName ?? core.profile.name,
      direction: 'pull_from_gbp',
      canPublishToNabatable: Boolean(providerName),
      canPushToGoogle: Boolean(core.profile.name?.trim()),
      warnings: [],
    }),
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.contactPhone',
      label: 'Primary phone',
      currentValue: core.profile.contactPhone,
      providerValue: providerPhone,
      proposedValue: providerPhone,
      direction: 'pull_from_gbp',
      canPublishToNabatable: true,
      canPushToGoogle: Boolean(core.profile.contactPhone?.trim()),
      defaultSelected: Boolean(providerPhone),
      warnings: [],
    }),
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.address',
      label: 'Address',
      currentValue: core.profile.address,
      providerValue: providerAddress,
      proposedValue: providerAddress,
      direction: 'pull_from_gbp',
      canPublishToNabatable: true,
      canPushToGoogle: false,
      defaultSelected: Boolean(providerAddress),
      warnings: ['Address updates to Google are not available here yet.'],
    }),
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.googleMapUrl',
      label: 'Google Maps URL',
      currentValue: core.profile.googleMapUrl,
      providerValue: providerGoogleMapUrl,
      proposedValue: providerGoogleMapUrl,
      direction: 'pull_from_gbp',
      canPublishToNabatable: true,
      canPushToGoogle: false,
      defaultSelected: Boolean(providerGoogleMapUrl),
      warnings: ['Google links can be copied into Nabatable but are not sent back to Google.'],
    }),
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.googleReviewUrl',
      label: 'Google review URL',
      currentValue: core.profile.googleReviewUrl,
      providerValue: providerGoogleReviewUrl,
      proposedValue: providerGoogleReviewUrl,
      direction: 'pull_from_gbp',
      canPublishToNabatable: true,
      canPushToGoogle: false,
      defaultSelected: Boolean(providerGoogleReviewUrl),
      warnings: ['Google links can be copied into Nabatable but are not sent back to Google.'],
    }),
  ];

  return summarizeSection('profile', 'Profile, contact and links', items);
}

function formatHoursValue(value: {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}) {
  return value.isClosed ? 'Closed' : `${value.opensAt ?? 'Not set'}-${value.closesAt ?? 'Not set'}`;
}

function buildOperatingHoursSection(
  core: CoreSnapshots,
  businessInfo: GoogleBusinessProfileBusinessInfo,
): GoogleBusinessProfileDraftSection {
  const normalized = businessInfo.coreNormalization.operatingHours;
  const providerWeekly = new Map(normalized.weekly.map((row) => [row.dayOfWeek, row]));
  const providerOverrides = new Map(normalized.overrides.map((row) => [row.effectiveDate, row]));
  const overrideDates = [
    ...new Set([
      ...core.operatingHours.overrides.map((row) => row.effectiveDate),
      ...normalized.overrides.map((row) => row.effectiveDate),
    ]),
  ].sort();

  const items: GoogleBusinessProfileDraftItem[] = [
    ...core.operatingHours.weekly.map((row) => {
      const provider = providerWeekly.get(row.dayOfWeek);
      return makeItem({
        sectionKey: 'operatingHours',
        fieldKey: `operatingHours.weekly.${row.dayOfWeek}`,
        label: `Weekly day ${row.dayOfWeek}`,
        currentValue: formatHoursValue(row),
        providerValue: provider ? formatHoursValue(provider) : null,
        proposedValue: provider ? formatHoursValue(provider) : formatHoursValue(row),
        comparisonProposedValue: provider ? formatHoursValue(provider) : null,
        direction: 'pull_from_gbp',
        canPublishToNabatable: Boolean(provider),
        canPushToGoogle: true,
        warnings: normalized.warnings,
      });
    }),
    ...overrideDates.map((effectiveDate) => {
      const current = core.operatingHours.overrides.find(
        (row) => row.effectiveDate === effectiveDate,
      );
      const provider = providerOverrides.get(effectiveDate);
      return makeItem({
        sectionKey: 'operatingHours',
        fieldKey: `operatingHours.override.${effectiveDate}`,
        label: `Special hours ${effectiveDate}`,
        currentValue: current ? formatHoursValue(current) : null,
        providerValue: provider ? formatHoursValue(provider) : null,
        proposedValue: provider
          ? formatHoursValue(provider)
          : current
            ? formatHoursValue(current)
            : null,
        comparisonProposedValue: provider ? formatHoursValue(provider) : null,
        direction: 'pull_from_gbp',
        canPublishToNabatable: Boolean(provider || current),
        canPushToGoogle: true,
        defaultSelected: Boolean(provider),
        warnings: normalized.warnings,
      });
    }),
  ];

  return summarizeSection('operatingHours', 'Operating hours and special hours', items);
}

function buildServicePeriodsSection(
  core: CoreSnapshots,
  businessInfo: GoogleBusinessProfileBusinessInfo,
  canPushToGoogle: boolean,
): GoogleBusinessProfileDraftSection {
  const normalized = businessInfo.coreNormalization.servicePeriods;
  const syncableServicePeriodOptions = new Set(['lunch', 'dinner']);
  const servicePeriodKey = (period: {
    dayOfWeek: number | null;
    bookingOption: string;
  }): string | null => {
    if (period.dayOfWeek === null) {
      return null;
    }
    const option = period.bookingOption.trim().toLowerCase();
    if (!syncableServicePeriodOptions.has(option)) {
      return null;
    }
    return `${period.dayOfWeek}:${option}`;
  };
  const formatServicePeriodValue = (period: { name: string; startTime: string; endTime: string }) =>
    `${period.name} ${period.startTime}-${period.endTime}`;
  const coreByDay = new Map(
    core.servicePeriods
      .map((row) => [servicePeriodKey(row), row] as const)
      .filter((entry): entry is [string, (typeof core.servicePeriods)[number]] =>
        Boolean(entry[0]),
      ),
  );
  const providerByDay = new Map(
    normalized.periods
      .map((row) => [servicePeriodKey(row), row] as const)
      .filter((entry): entry is [string, (typeof normalized.periods)[number]] => Boolean(entry[0])),
  );

  const servicePeriodKeys = [...new Set([...coreByDay.keys(), ...providerByDay.keys()])].sort(
    (left, right) => {
      const [leftDay, leftOption] = left.split(':');
      const [rightDay, rightOption] = right.split(':');
      const dayOrder = Number(leftDay) - Number(rightDay);
      return dayOrder === 0 ? leftOption.localeCompare(rightOption) : dayOrder;
    },
  );

  const items = servicePeriodKeys.map((key) => {
    const current = coreByDay.get(key);
    const provider = providerByDay.get(key);
    const [dayPart, option] = key.split(':');
    const providerValue = provider ? formatServicePeriodValue(provider) : null;
    const currentValue = current ? formatServicePeriodValue(current) : null;
    return makeItem({
      sectionKey: 'servicePeriods',
      fieldKey: `servicePeriods.${dayPart}.${option}`,
      label: `${option} day ${dayPart}`,
      currentValue,
      providerValue,
      proposedValue: providerValue ?? currentValue,
      comparisonProposedValue: providerValue,
      direction: 'pull_from_gbp',
      canPublishToNabatable: true,
      canPushToGoogle,
      defaultSelected: Boolean(provider),
      warnings: normalized.warnings,
    });
  });

  const section = summarizeSection('servicePeriods', 'Service periods', items);
  if (!canPushToGoogle) {
    section.blockedReasons.push(
      'Google service-period updates are not available for this location.',
    );
  }
  return section;
}

function buildBusinessContextSection<T>(
  sectionKey: GoogleBusinessProfileDraftSectionKey,
  label: string,
  coreRows: T[],
  providerRows: T[],
  canPushToGoogle: boolean,
  options: {
    canPublishToNabatable?: boolean;
    warnings?: string[];
  } = {},
): GoogleBusinessProfileDraftSection {
  const canPublishToNabatable =
    options.canPublishToNabatable ?? (providerRows.length > 0 || coreRows.length > 0);
  const item = makeItem({
    sectionKey,
    fieldKey: sectionKey,
    label,
    currentValue: toJson(coreRows),
    providerValue: toJson(providerRows),
    proposedValue: toJson(providerRows),
    comparisonCurrentValue: normalizeBusinessContextRowsForComparison(sectionKey, coreRows),
    comparisonProposedValue: normalizeBusinessContextRowsForComparison(sectionKey, providerRows),
    direction: 'pull_from_gbp',
    canPublishToNabatable,
    canPushToGoogle,
    defaultSelected: providerRows.length > 0,
    warnings: options.warnings ?? [],
  });

  return summarizeSection(sectionKey, label, [item]);
}

function normalizeBusinessContextRowsForComparison<T>(
  sectionKey: GoogleBusinessProfileDraftSectionKey,
  rows: T[],
): Json {
  const normalizedRows = rows
    .map((row) => normalizeBusinessContextRowForComparison(sectionKey, row))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));

  return toJson(normalizedRows);
}

function normalizeBusinessContextRowForComparison(
  sectionKey: GoogleBusinessProfileDraftSectionKey,
  row: unknown,
): Record<string, unknown> | unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row;
  }

  const omittedKeys = new Set(['id', 'source', 'managedBy', 'updatedAt']);
  if (sectionKey === 'businessContext.categories') {
    omittedKeys.add('isPrimary');
  }

  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>).filter(
      ([key, value]) => !omittedKeys.has(key) && value !== undefined,
    ),
  );
}

function normalizeProviderValueForStaleCheck(
  sectionKey: GoogleBusinessProfileDraftSectionKey,
  value: unknown,
): unknown {
  if (!sectionKey.startsWith('businessContext.') || !Array.isArray(value)) {
    return value;
  }

  return normalizeBusinessContextRowsForComparison(sectionKey, value);
}

function providerValueChangedForStaleCheck(
  item: GoogleBusinessProfileDraftItem,
  refreshedItem: GoogleBusinessProfileDraftItem,
): boolean {
  return !isEqualValue(
    normalizeProviderValueForStaleCheck(item.sectionKey, item.providerValue),
    normalizeProviderValueForStaleCheck(refreshedItem.sectionKey, refreshedItem.providerValue),
  );
}

function summarizeSection(
  sectionKey: GoogleBusinessProfileDraftSectionKey,
  label: string,
  items: GoogleBusinessProfileDraftItem[],
): GoogleBusinessProfileDraftSection {
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

function ensureDraftItemV2(item: GoogleBusinessProfileDraftItem): GoogleBusinessProfileDraftItem {
  const record = item as GoogleBusinessProfileDraftItem & Partial<GoogleBusinessProfileDraftItem>;
  const normalizedNabatableValue = record.normalizedNabatableValue ?? item.currentValue;
  const normalizedGoogleValue = record.normalizedGoogleValue ?? item.providerValue;

  return {
    ...item,
    normalizedNabatableValue: toJson(normalizedNabatableValue),
    normalizedGoogleValue: toJson(normalizedGoogleValue),
    nabatableValueHash: record.nabatableValueHash ?? hashJson(normalizedNabatableValue),
    googleValueHash: record.googleValueHash ?? hashJson(normalizedGoogleValue),
    capabilities: record.capabilities ?? {
      canImportFromGoogle: item.canPublishToNabatable,
      canExportToGoogle: item.canPushToGoogle,
      canIgnore: true,
    },
    blockedReasons: record.blockedReasons ?? [
      ...(!item.canPublishToNabatable
        ? [`${item.label} cannot be imported from Google automatically.`]
        : []),
      ...(!item.canPushToGoogle
        ? [`${item.label} cannot be exported to Google automatically.`]
        : []),
    ],
  };
}

function decisionMap(decisions: GoogleBusinessProfileFieldDecision[] = []) {
  return new Map(decisions.map((decision) => [decision.fieldKey, decision]));
}

function selectedApprovalsFromDecisions(
  decisions: GoogleBusinessProfileFieldDecision[],
): Record<string, boolean> {
  return Object.fromEntries(
    decisions.map((decision) => [
      decision.fieldKey,
      decision.action === 'import_from_google' || decision.action === 'export_to_google',
    ]),
  );
}

function applySelectedApprovals(
  sections: GoogleBusinessProfileDraftSection[],
  selectedApprovals: Record<string, boolean>,
  staleSections: string[],
  decisions: GoogleBusinessProfileFieldDecision[] = [],
): GoogleBusinessProfileDraftSection[] {
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
      blockedReasons: isStale
        ? [
            'Restaurant details changed after this review was created. Check for changes again before applying this section.',
          ]
        : section.blockedReasons,
    };
  });
}

function mapDraft(
  row: DraftRow,
  selectedApprovalsOverride?: Record<string, boolean>,
  decisionsOverride?: GoogleBusinessProfileFieldDecision[],
): GoogleBusinessProfileWorkflowDraft {
  const selectedApprovals = selectedApprovalsOverride ?? toObjectRecord(row.selected_approvals);
  const decisions = decisionsOverride ?? extractFieldDecisions(row.selected_approvals);
  const rawSections = Array.isArray(row.section_diffs)
    ? (row.section_diffs as unknown as GoogleBusinessProfileDraftSection[])
    : [];

  return {
    id: row.id,
    status: row.status,
    fetchedAt: row.fetched_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    staleSections: row.stale_sections ?? [],
    conflictMetadata: row.conflict_metadata,
    selectedApprovals,
    decisions,
    sourceSnapshotRefs: row.source_snapshot_refs,
    coreSnapshotHashes:
      row.core_snapshot_hashes &&
      typeof row.core_snapshot_hashes === 'object' &&
      !Array.isArray(row.core_snapshot_hashes)
        ? (row.core_snapshot_hashes as Record<string, string>)
        : {},
    sectionDiffs: applySelectedApprovals(
      rawSections,
      selectedApprovals,
      row.stale_sections ?? [],
      decisions,
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function summarizeReconciledSection(
  section: GoogleBusinessProfileDraftSection,
): GoogleBusinessProfileDraftSection {
  return summarizeSection(section.sectionKey, section.label, section.items);
}

function reconcileDraftWithCurrentSections(
  draft: GoogleBusinessProfileWorkflowDraft,
  currentSections: GoogleBusinessProfileDraftSection[],
): GoogleBusinessProfileWorkflowDraft {
  const currentSectionsByKey = new Map<
    GoogleBusinessProfileDraftSectionKey,
    GoogleBusinessProfileDraftSection
  >(currentSections.map((section) => [section.sectionKey, section]));
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
      blockedReasons: [
        'Restaurant details changed after this review was created. Check for changes again before applying this section.',
      ],
    };
  });

  const currentSectionKeys = new Set(currentSectionsByKey.keys());
  const remainingStaleSections = draft.staleSections.filter((sectionKey) => {
    const typedSectionKey = sectionKey as GoogleBusinessProfileDraftSectionKey;
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
  };
}

function suppressActionsForReadOnlyReview(
  draft: GoogleBusinessProfileWorkflowDraft,
): GoogleBusinessProfileWorkflowDraft {
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
  };
}

function mapEvent(row: PublishEventRow): GoogleBusinessProfileWorkflowAuditEvent {
  const flow =
    row.direction === 'push_from_nabatable_to_google'
      ? 'nabatable_to_google_sync'
      : 'google_to_nabatable_apply';
  return {
    id: row.id,
    draftId: row.draft_id,
    direction: row.direction,
    flow,
    directionLabel:
      flow === 'nabatable_to_google_sync' ? 'Legacy Google write' : 'Google -> Nabatable apply',
    affectedSections: row.affected_sections ?? [],
    googleUpdateMasks: row.google_update_masks,
    result: row.result,
    errors: row.errors,
    createdAt: row.created_at,
  };
}

function mapPublishJob(row: PublishJobRow): GoogleBusinessProfileActivePublishJob {
  const googleUpdateMasks = normalizeGoogleMasks(row.google_update_masks);
  const mode = row.mode as GoogleBusinessProfilePublishMode;
  const canRetryGooglePush =
    mode !== 'nabatable_only' &&
    googleUpdateMasks.length > 0 &&
    GOOGLE_RETRYABLE_JOB_STATUSES.includes(row.status);

  return {
    id: row.id,
    draftId: row.draft_id,
    idempotencyKey: row.idempotency_key,
    mode,
    directionIntent: directionIntentForPublishMode(mode),
    status: row.status,
    selectedApprovals: toObjectRecord(row.selected_approvals),
    decisions: extractFieldDecisions(row.selected_approvals),
    nabatableSections: row.nabatable_sections ?? [],
    googleUpdateMasks,
    postNabatableCoreHashes: toStringRecord(row.post_nabatable_core_hashes),
    errorClassification:
      row.error_classification as GoogleBusinessProfileGoogleErrorClassification | null,
    errors: row.errors,
    nabatableEventId: row.nabatable_publish_event_id,
    googleEventId: row.google_publish_event_id,
    canRetryGooglePush,
    retryBlockedReason: canRetryGooglePush
      ? null
      : mode === 'nabatable_only'
        ? 'This update applied Google changes to Nabatable only.'
        : googleUpdateMasks.length === 0
          ? 'No supported Google fields were selected for this update.'
          : 'Google retry is available only for failed or partial Google updates.',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWorkflowResponse(
  latestDraft: GoogleBusinessProfileWorkflowDraft | null,
  events: PublishEventRow[],
  activePublishJob: PublishJobRow | null,
): GoogleBusinessProfileWorkflowResponse {
  const sectionSummaries =
    latestDraft?.sectionDiffs.map((section) => ({
      sectionKey: section.sectionKey,
      label: section.label,
      status: section.status,
      selectedCount: section.items.filter((item) => item.selected).length,
      itemCount: section.items.length,
    })) ?? [];

  return {
    latestDraft,
    sectionSummaries,
    publishableSections:
      latestDraft?.sectionDiffs
        .filter((section) => section.canPublishToNabatable)
        .map((section) => section.sectionKey) ?? [],
    blockedReasons: [
      ...(latestDraft?.staleSections.length
        ? ['Some profile sections changed since review. Check for changes again before applying.']
        : []),
      ...(latestDraft?.sectionDiffs.flatMap((section) => section.blockedReasons) ?? []),
    ],
    auditEvents: events.map(mapEvent),
    activePublishJob: activePublishJob ? mapPublishJob(activePublishJob) : null,
  };
}

async function readLatestDraft(restaurantId: string, client: DbClient): Promise<DraftRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_drafts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', PROVIDER)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function readDraftById(
  restaurantId: string,
  draftId: string,
  client: DbClient,
): Promise<DraftRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('restaurant_id', restaurantId)
    .eq('provider', PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function readEvents(restaurantId: string, client: DbClient): Promise<PublishEventRow[]> {
  const { data, error } = await client
    .from('restaurant_external_profile_publish_events')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', PROVIDER)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function readLatestPublishJob(
  restaurantId: string,
  client: DbClient,
): Promise<PublishJobRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_publish_jobs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', PROVIDER)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function readPublishJobById(params: {
  restaurantId: string;
  draftId: string;
  publishJobId: string;
  client: DbClient;
}): Promise<PublishJobRow | null> {
  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .select('*')
    .eq('id', params.publishJobId)
    .eq('restaurant_id', params.restaurantId)
    .eq('draft_id', params.draftId)
    .eq('provider', PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getGoogleBusinessProfileWorkflow(
  restaurantId: string,
  client?: DbClient,
): Promise<GoogleBusinessProfileWorkflowResponse> {
  const resolvedClient = getClient(client);
  const [draft, events, activePublishJob] = await Promise.all([
    readLatestDraft(restaurantId, resolvedClient),
    readEvents(restaurantId, resolvedClient),
    readLatestPublishJob(restaurantId, resolvedClient),
  ]);
  let latestDraft = draft ? mapDraft(draft) : null;

  if (latestDraft) {
    const [externalProfile, core, businessInfo] = await Promise.all([
      findExternalProfile(restaurantId, resolvedClient),
      readCoreSnapshots(restaurantId, resolvedClient),
      readGoogleBusinessProfileBusinessInfo(restaurantId, resolvedClient),
    ]);
    const currentSections = buildDraftSections({
      core,
      businessInfo,
      externalLocationTitle: externalProfile?.external_location_title ?? null,
      canPushServicePeriods: resolveCanPushServicePeriods({
        core,
        businessInfo,
        lastPulledAt: externalProfile?.last_pull_at ?? null,
        lastPushedAt: externalProfile?.last_push_at ?? null,
      }),
    });
    latestDraft = READ_ONLY_REVIEW_DRAFT_STATUSES.includes(latestDraft.status)
      ? suppressActionsForReadOnlyReview(latestDraft)
      : reconcileDraftWithCurrentSections(latestDraft, currentSections);
  }

  return buildWorkflowResponse(latestDraft, events, activePublishJob);
}

function buildDraftSections(input: {
  core: CoreSnapshots;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  externalLocationTitle: string | null;
  canPushServicePeriods: boolean;
}): GoogleBusinessProfileDraftSection[] {
  return [
    buildProfileSection(input.core, input.businessInfo, input.externalLocationTitle),
    buildOperatingHoursSection(input.core, input.businessInfo),
    buildServicePeriodsSection(input.core, input.businessInfo, input.canPushServicePeriods),
    buildBusinessContextSection(
      'businessContext.categories',
      'Categories',
      input.core.businessContext.core.categories,
      input.core.businessContext.providerSnapshot.categories,
      false,
    ),
    buildBusinessContextSection(
      'businessContext.serviceAreas',
      'Service areas',
      input.core.businessContext.core.serviceAreas,
      input.core.businessContext.providerSnapshot.serviceAreas,
      false,
    ),
    buildBusinessContextSection(
      'businessContext.attributes',
      'Attributes',
      input.core.businessContext.core.attributes,
      input.core.businessContext.providerSnapshot.attributes,
      false,
    ),
    buildBusinessContextSection(
      'businessContext.serviceItems',
      'Service items',
      input.core.businessContext.core.serviceItems,
      input.core.businessContext.providerSnapshot.serviceItems,
      false,
    ),
  ];
}

function resolveCanPushServicePeriods(input: {
  core: CoreSnapshots;
  businessInfo: GoogleBusinessProfileBusinessInfo;
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

export async function createGoogleBusinessProfileWorkflowDraft(params: {
  restaurantId: string;
  actorUserId: string;
  client?: DbClient;
}): Promise<GoogleBusinessProfileWorkflowResponse> {
  const client = getClient(params.client);
  const refreshedConnection = await syncGoogleBusinessProfileBusinessInformation(
    params.restaurantId,
    client,
  );
  const [externalProfile, core] = await Promise.all([
    findExternalProfile(params.restaurantId, client),
    readCoreSnapshots(params.restaurantId, client),
  ]);

  const canPushServicePeriods = resolveCanPushServicePeriods({
    core,
    businessInfo: refreshedConnection.businessInfo,
    lastPulledAt: refreshedConnection.lastPullAt,
    lastPushedAt: refreshedConnection.lastPushAt,
  });

  const sections = buildDraftSections({
    core,
    businessInfo: refreshedConnection.businessInfo,
    externalLocationTitle: refreshedConnection.externalLocationTitle,
    canPushServicePeriods,
  });
  const selectedApprovals = Object.fromEntries(
    sections.flatMap((section) => section.items.map((item) => [item.fieldKey, false])),
  );
  const fetchedAt = nowIso();

  const { error: archiveError } = await client
    .from('restaurant_external_profile_drafts')
    .update({ status: 'archived' })
    .eq('restaurant_id', params.restaurantId)
    .eq('provider', PROVIDER)
    .in('status', ['review_ready', 'approved', 'stale', 'failed', 'partially_published']);
  if (archiveError) {
    throw archiveError;
  }

  const { data, error } = await client
    .from('restaurant_external_profile_drafts')
    .insert({
      restaurant_id: params.restaurantId,
      external_profile_id: externalProfile?.id ?? null,
      provider: PROVIDER,
      status: 'review_ready',
      source_snapshot_refs: toJson({
        externalProfileId: externalProfile?.id ?? null,
        externalLocationName: refreshedConnection.externalLocationName,
        lastPullAt: refreshedConnection.lastPullAt,
        lastPushAt: refreshedConnection.lastPushAt,
      }),
      section_diffs: toJson(sections),
      selected_approvals: toJson(selectedApprovals),
      core_snapshot_hashes: toJson(buildCoreSnapshotHashes(core)),
      stale_sections: [],
      conflict_metadata: {},
      created_by_user_id: params.actorUserId,
      fetched_at: fetchedAt,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const [events, activePublishJob] = await Promise.all([
    readEvents(params.restaurantId, client),
    readLatestPublishJob(params.restaurantId, client),
  ]);
  return buildWorkflowResponse(mapDraft(data), events, activePublishJob);
}

function draftItemLookup(draft: GoogleBusinessProfileWorkflowDraft) {
  return new Map<string, GoogleBusinessProfileDraftItem>(
    draft.sectionDiffs.flatMap((section) =>
      section.items.map((item) => [`${section.sectionKey}:${item.fieldKey}`, item] as const),
    ),
  );
}

function validateAndStampFieldDecisions(params: {
  draft: GoogleBusinessProfileWorkflowDraft;
  decisions: GoogleBusinessProfileFieldDecisionInput[];
  actorUserId: string;
}): GoogleBusinessProfileFieldDecision[] {
  const itemsByKey = draftItemLookup(params.draft);
  const decidedAt = nowIso();
  const result: GoogleBusinessProfileFieldDecision[] = [];
  const seen = new Set<string>();

  for (const decision of params.decisions) {
    const decisionKey = `${decision.sectionKey}:${decision.fieldKey}`;
    if (seen.has(decisionKey)) {
      continue;
    }
    seen.add(decisionKey);

    const item = itemsByKey.get(decisionKey);
    if (!item || item.status === 'unchanged') {
      throw createWorkflowNamedError(
        'GBP_DECISION_INVALID',
        `Decision field is no longer reviewable: ${decision.fieldKey}.`,
      );
    }
    if (decision.reviewedNabatableValueHash !== item.nabatableValueHash) {
      throw createWorkflowNamedError(
        'GBP_DECISION_INVALID',
        `${item.label} changed in Nabatable since it was reviewed.`,
      );
    }
    if (decision.reviewedGoogleValueHash !== item.googleValueHash) {
      throw createWorkflowNamedError(
        'GBP_DECISION_INVALID',
        `${item.label} changed in Google since it was reviewed.`,
      );
    }
    if (decision.action === 'import_from_google' && !item.capabilities.canImportFromGoogle) {
      throw createWorkflowNamedError(
        'GBP_DECISION_INVALID',
        `${item.label} cannot be imported from Google.`,
      );
    }
    if (decision.action === 'export_to_google' && !item.capabilities.canExportToGoogle) {
      throw createWorkflowNamedError(
        'GBP_DECISION_INVALID',
        `${item.label} cannot be exported to Google.`,
      );
    }
    if (decision.action === 'ignore' && !item.capabilities.canIgnore) {
      throw createWorkflowNamedError('GBP_DECISION_INVALID', `${item.label} cannot be ignored.`);
    }

    result.push({
      ...decision,
      decidedByUserId: params.actorUserId,
      decidedAt,
    });
  }

  return result;
}

export async function updateGoogleBusinessProfileWorkflowDraft(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  selectedApprovals?: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  status?: 'review_ready' | 'approved';
  client?: DbClient;
}): Promise<GoogleBusinessProfileWorkflowResponse> {
  const client = getClient(params.client);
  const currentDraft = await readDraftById(params.restaurantId, params.draftId, client);
  if (!currentDraft) {
    throw new Error('Google Business Profile review was not found.');
  }
  assertDraftEditable(currentDraft.status);
  const mappedDraft = mapDraft(currentDraft);
  const decisions =
    params.decisions !== undefined
      ? validateAndStampFieldDecisions({
          draft: mappedDraft,
          decisions: params.decisions,
          actorUserId: params.actorUserId,
        })
      : extractFieldDecisions(currentDraft.selected_approvals);
  const selectedApprovals =
    params.decisions !== undefined
      ? selectedApprovalsFromDecisions(decisions)
      : params.selectedApprovals;

  const patch: Database['public']['Tables']['restaurant_external_profile_drafts']['Update'] = {};
  if (selectedApprovals) {
    patch.selected_approvals = selectedApprovalsWithDecisions(selectedApprovals, decisions);
  }
  if (params.status) {
    patch.status = params.status;
    if (params.status === 'approved') {
      patch.approved_by_user_id = params.actorUserId;
      patch.approved_at = nowIso();
    }
  }

  const { data, error } = await client
    .from('restaurant_external_profile_drafts')
    .update(patch)
    .eq('id', params.draftId)
    .eq('restaurant_id', params.restaurantId)
    .eq('provider', PROVIDER)
    .in('status', EDITABLE_DRAFT_STATUSES)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw createDraftStateError(currentDraft.status, 'edit');
  }

  const [events, activePublishJob] = await Promise.all([
    readEvents(params.restaurantId, client),
    readLatestPublishJob(params.restaurantId, client),
  ]);
  return buildWorkflowResponse(mapDraft(data), events, activePublishJob);
}

function decisionActionForItem(
  draft: GoogleBusinessProfileWorkflowDraft,
  item: GoogleBusinessProfileDraftItem,
): GoogleBusinessProfileSyncDecisionAction | null {
  return draft.decisions?.find((decision) => decision.fieldKey === item.fieldKey)?.action ?? null;
}

function selectedDraftItems(draft: GoogleBusinessProfileWorkflowDraft) {
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

function selectedItems(
  draft: GoogleBusinessProfileWorkflowDraft,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): GoogleBusinessProfileDraftItem[] {
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

function selectedSectionKeys(
  draft: GoogleBusinessProfileWorkflowDraft,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): GoogleBusinessProfileDraftSectionKey[] {
  return [...new Set(selectedItems(draft, mode).map((item) => item.sectionKey))];
}

function detectStaleSections(
  draft: GoogleBusinessProfileWorkflowDraft,
  currentHashes: Record<string, string>,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): GoogleBusinessProfileDraftSectionKey[] {
  return selectedSectionKeys(draft, mode).filter(
    (sectionKey) => draft.coreSnapshotHashes[sectionKey] !== currentHashes[sectionKey],
  );
}

async function insertPublishEvent(params: {
  restaurantId: string;
  draftId: string;
  externalProfileId: string | null;
  direction: 'pull_from_gbp_to_nabatable' | 'push_from_nabatable_to_google';
  sections: GoogleBusinessProfileDraftSectionKey[];
  oldValues: unknown;
  newValues: unknown;
  googleUpdateMasks?: unknown;
  actorUserId: string;
  client: DbClient;
}): Promise<PublishEventRow> {
  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_events')
    .insert({
      restaurant_id: params.restaurantId,
      draft_id: params.draftId,
      external_profile_id: params.externalProfileId,
      provider: PROVIDER,
      direction: params.direction,
      affected_sections: params.sections,
      old_values: toJson(params.oldValues),
      new_values: toJson(params.newValues),
      google_update_masks: toJson(params.googleUpdateMasks ?? []),
      result: 'pending',
      errors: [],
      actor_user_id: params.actorUserId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updatePublishEvent(
  eventId: string,
  result: 'success' | 'failed' | 'partial' | 'skipped',
  errors: unknown[],
  client: DbClient,
): Promise<void> {
  const { error } = await client
    .from('restaurant_external_profile_publish_events')
    .update({ result, errors: toJson(errors) })
    .eq('id', eventId);

  if (error) {
    throw error;
  }
}

function getSelectedFieldSuffixes(
  draft: GoogleBusinessProfileWorkflowDraft,
  sectionKey: GoogleBusinessProfileDraftSectionKey,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
): string[] {
  return selectedItems(draft, mode)
    .filter((item) => item.sectionKey === sectionKey)
    .map((item) => item.fieldKey);
}

function profileFieldsForDraft(
  draft: GoogleBusinessProfileWorkflowDraft,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
) {
  const fields = getSelectedFieldSuffixes(draft, 'profile', mode)
    .map((fieldKey) => fieldKey.replace('profile.', ''))
    .filter(
      (field): field is 'name' | 'contactPhone' | 'address' | 'googleMapUrl' | 'googleReviewUrl' =>
        ['name', 'contactPhone', 'address', 'googleMapUrl', 'googleReviewUrl'].includes(field),
    );
  return fields.length > 0 ? fields : undefined;
}

type ProfileProjectionCleanupTarget = {
  table: 'restaurant_addresses' | 'restaurant_phone_numbers' | 'restaurant_links';
  filters: Record<string, string | boolean>;
  anyOf?: Record<string, string | boolean>;
};

function profileProjectionCleanupTargets(
  fields: ProfileVerificationField[] | undefined,
): ProfileProjectionCleanupTarget[] {
  const selected = new Set(fields ?? []);
  const targets: ProfileProjectionCleanupTarget[] = [];

  if (selected.has('contactPhone')) {
    targets.push({
      table: 'restaurant_phone_numbers',
      filters: {
        source: 'nabatable',
        managed_by: 'nabatable',
      },
      anyOf: {
        phone_kind: 'primary',
        is_primary: true,
      },
    });
  }

  if (selected.has('address')) {
    targets.push({
      table: 'restaurant_addresses',
      filters: {
        source: 'nabatable',
        managed_by: 'nabatable',
      },
      anyOf: {
        address_type: 'storefront',
        is_primary: true,
      },
    });
  }

  if (selected.has('googleMapUrl')) {
    targets.push({
      table: 'restaurant_links',
      filters: {
        source: 'nabatable',
        managed_by: 'nabatable',
        link_type: 'google_map',
        link_status: 'current',
      },
    });
  }

  if (selected.has('googleReviewUrl')) {
    targets.push({
      table: 'restaurant_links',
      filters: {
        source: 'nabatable',
        managed_by: 'nabatable',
        link_type: 'google_review',
        link_status: 'current',
      },
    });
  }

  return targets;
}

function serializeOrFilters(filters: Record<string, string | boolean>): string {
  return Object.entries(filters)
    .map(([key, value]) => `${key}.eq.${String(value)}`)
    .join(',');
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

function operatingHoursSelectionForDraft(
  draft: GoogleBusinessProfileWorkflowDraft,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
) {
  const keys = getSelectedFieldSuffixes(draft, 'operatingHours', mode);
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

function servicePeriodsSelectionForDraft(
  draft: GoogleBusinessProfileWorkflowDraft,
  mode: GoogleBusinessProfilePublishMode = 'nabatable_only',
) {
  const dayOfWeeks = [
    ...new Set(
      getSelectedFieldSuffixes(draft, 'servicePeriods', mode)
        .map((key) => key.match(/^servicePeriods\.(\d|all)\./)?.[1])
        .filter((value): value is string => Boolean(value && value !== 'all'))
        .map((value) => Number.parseInt(value, 10)),
    ),
  ];

  return dayOfWeeks.length > 0 ? { dayOfWeeks } : undefined;
}

function businessContextPayloadForDraft(
  draft: GoogleBusinessProfileWorkflowDraft,
  current: RestaurantBusinessContextSnapshot,
): UpdateRestaurantBusinessContextInput {
  const sections = new Set(selectedSectionKeys(draft));
  const cloneProviderRowsForCore = <TRow extends { id: string }>(rows: TRow[]) =>
    rows.map(({ id: _providerSnapshotId, ...row }) => row);
  const cloneProviderCategoriesForCore = (
    rows: RestaurantBusinessContextSnapshot['providerSnapshot']['categories'],
  ) =>
    cloneProviderRowsForCore(rows).map((row) => ({
      ...row,
      isPrimary: false,
    }));

  return {
    ...(sections.has('businessContext.categories')
      ? { categories: cloneProviderCategoriesForCore(current.providerSnapshot.categories) }
      : {}),
    ...(sections.has('businessContext.serviceAreas')
      ? { serviceAreas: cloneProviderRowsForCore(current.providerSnapshot.serviceAreas) }
      : {}),
    ...(sections.has('businessContext.attributes')
      ? { attributes: cloneProviderRowsForCore(current.providerSnapshot.attributes) }
      : {}),
    ...(sections.has('businessContext.serviceItems')
      ? { serviceItems: cloneProviderRowsForCore(current.providerSnapshot.serviceItems) }
      : {}),
  };
}

function googleMasksForDraft(
  draft: GoogleBusinessProfileWorkflowDraft,
  mode: GoogleBusinessProfilePublishMode = 'google_only',
): GoogleBusinessProfileGoogleUpdateMask[] {
  const masks = new Set<GoogleBusinessProfileGoogleUpdateMask>();
  const profileFields = profileFieldsForDraft(draft, mode) ?? [];
  if (profileFields.includes('name')) {
    masks.add('title');
  }
  if (profileFields.includes('contactPhone')) {
    masks.add('phoneNumbers');
  }
  const hoursSelection = operatingHoursSelectionForDraft(draft, mode);
  if (hoursSelection.weeklyDays && hoursSelection.weeklyDays.length > 0) {
    masks.add('regularHours');
  }
  if (hoursSelection.overrideDates && hoursSelection.overrideDates.length > 0) {
    masks.add('specialHours');
  }
  if (
    selectedItems(draft, mode).some(
      (item) => item.sectionKey === 'servicePeriods' && item.canPushToGoogle,
    )
  ) {
    masks.add('moreHours');
  }
  return [...masks];
}

type PublishPreflightContext = {
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

function createWorkflowNamedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function assertGooglePushEnabled(externalProfile: Pick<ExternalProfileRow, 'push_enabled'> | null) {
  if (externalProfile?.push_enabled) {
    return;
  }

  throw createWorkflowNamedError(
    'GBP_GOOGLE_PUSH_DISABLED',
    'Google writes are disabled for this linked Google Business Profile location.',
  );
}

async function markDraftStaleAndThrow(params: {
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

async function detectProviderStaleItems(params: {
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

function buildPublishJobIdempotencyKey(input: {
  restaurantId: string;
  draftId: string;
  mode: GoogleBusinessProfilePublishMode;
  selectedApprovals: Record<string, boolean>;
  decisions: GoogleBusinessProfileFieldDecision[];
  currentHashes: Record<string, string>;
}): string {
  return `gbp-publish:${input.restaurantId}:${input.draftId}:${hashJson({
    mode: input.mode,
    selectedApprovals: input.selectedApprovals,
    decisions: input.decisions.map((decision) => ({
      sectionKey: decision.sectionKey,
      fieldKey: decision.fieldKey,
      action: decision.action,
      reviewedNabatableValueHash: decision.reviewedNabatableValueHash,
      reviewedGoogleValueHash: decision.reviewedGoogleValueHash,
    })),
    currentHashes: input.currentHashes,
  })}`;
}

function publishModeForDecisions(
  decisions: GoogleBusinessProfileFieldDecision[],
): GoogleBusinessProfilePublishMode | null {
  const imports = decisions.some((decision) => decision.action === 'import_from_google');
  const exports = decisions.some((decision) => decision.action === 'export_to_google');
  if (imports && exports) {
    return 'nabatable_and_google';
  }
  if (exports) {
    return 'google_only';
  }
  if (imports) {
    return 'nabatable_only';
  }
  return null;
}

function buildPreflightWarnings(input: {
  mode: GoogleBusinessProfilePublishMode;
  selectedDraftItems: GoogleBusinessProfileDraftItem[];
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
}): GoogleBusinessProfilePublishPreflightNotice[] {
  const warnings: GoogleBusinessProfilePublishPreflightNotice[] = [];

  if (input.mode === 'nabatable_only') {
    return warnings;
  }

  for (const item of input.selectedDraftItems) {
    if (!item.canPushToGoogle) {
      warnings.push({
        code: item.status === 'unsupported' ? 'unsupported_field' : 'google_read_only',
        message:
          input.mode === 'google_only'
            ? `${item.label} cannot be sent to Google from here yet and will be skipped.`
            : `${item.label} will update Nabatable only and will not be sent to Google.`,
        fieldKey: item.fieldKey,
        sectionKey: item.sectionKey,
      });
    }
  }

  if (input.googleUpdateMasks.length === 0) {
    warnings.push({
      code: 'no_google_masks',
      message:
        input.mode === 'google_only'
          ? 'No selected fields can be sent to Google.'
          : 'No selected fields can be sent to Google. This will update Nabatable only.',
    });
  }

  return warnings;
}

async function buildPublishPreflightContext(params: {
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
        })
      : extractFieldDecisions(latestDraft.selected_approvals);
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
  const warnings = buildPreflightWarnings({
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

async function upsertPublishJobFromPreflight(params: {
  restaurantId: string;
  actorUserId: string;
  context: PublishPreflightContext;
  client: DbClient;
}): Promise<PublishJobRow> {
  const { data: existingJob, error: existingError } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .select('*')
    .eq('idempotency_key', params.context.idempotencyKey)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }
  if (existingJob) {
    return existingJob;
  }

  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .insert({
      restaurant_id: params.restaurantId,
      draft_id: params.context.draft.id,
      external_profile_id: params.context.externalProfile?.id ?? null,
      provider: PROVIDER,
      idempotency_key: params.context.idempotencyKey,
      mode: params.context.mode,
      status: 'preflight_ready',
      selected_approvals: selectedApprovalsWithDecisions(
        params.context.selectedApprovals,
        params.context.decisions,
      ),
      nabatable_sections: params.context.sections,
      preflight_nabatable_updates: toJson(params.context.nabatableUpdates),
      preflight_pull_only_items: toJson(params.context.pullOnlyItems),
      google_update_masks: params.context.googleUpdateMasks,
      preflight_warnings: toJson(params.context.warnings),
      preflight_errors: toJson(params.context.errors),
      created_by_user_id: params.actorUserId,
      preflighted_at: nowIso(),
    })
    .select('*')
    .single();

  if (error) {
    if (isUniqueConstraintError(error)) {
      const { data: racedJob, error: racedReadError } = await params.client
        .from('restaurant_external_profile_publish_jobs')
        .select('*')
        .eq('idempotency_key', params.context.idempotencyKey)
        .maybeSingle();

      if (racedReadError) {
        throw racedReadError;
      }
      if (racedJob) {
        return racedJob;
      }
    }

    throw error;
  }

  return data;
}

async function claimPublishJobForPublishing(params: {
  jobId: string;
  actorUserId: string;
  context: PublishPreflightContext;
  client: DbClient;
}): Promise<PublishJobRow> {
  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .update({
      status: 'publishing',
      published_by_user_id: params.actorUserId,
      selected_approvals: selectedApprovalsWithDecisions(
        params.context.selectedApprovals,
        params.context.decisions,
      ),
      nabatable_sections: params.context.sections,
      preflight_nabatable_updates: toJson(params.context.nabatableUpdates),
      preflight_pull_only_items: toJson(params.context.pullOnlyItems),
      google_update_masks: params.context.googleUpdateMasks,
      preflight_warnings: toJson(params.context.warnings),
      preflight_errors: toJson(params.context.errors),
    })
    .eq('id', params.jobId)
    .eq('status', 'preflight_ready')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_INVALID_STATE',
      'Update is already being applied or is no longer ready to publish.',
    );
  }

  return data;
}

async function claimPublishJobForGoogleRetry(params: {
  jobId: string;
  actorUserId: string;
  client: DbClient;
}): Promise<PublishJobRow> {
  const retriedAt = nowIso();
  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .update({
      status: 'publishing',
      google_retry_by_user_id: params.actorUserId,
      retried_at: retriedAt,
    })
    .eq('id', params.jobId)
    .in('status', GOOGLE_RETRYABLE_JOB_STATUSES)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_INVALID_STATE',
      'Google retry is already being applied or is no longer retryable.',
    );
  }

  return data;
}

function buildPreflightResponse(
  context: PublishPreflightContext,
  job: PublishJobRow,
): GoogleBusinessProfilePublishPreflight {
  return {
    publishJobId: job.id,
    publishPlanId: job.id,
    idempotencyKey: job.idempotency_key,
    mode: context.mode,
    directionIntent: context.directionIntent,
    selectedApprovals: context.selectedApprovals,
    decisions: context.decisions,
    nabatableUpdates: context.nabatableUpdates,
    googleUpdates: context.googleUpdates,
    pullOnlyItems: context.pullOnlyItems,
    googleUpdateMasks: context.googleUpdateMasks,
    warnings: context.warnings,
    errors: context.errors,
    canPublish:
      context.errors.length === 0 &&
      (context.mode === 'google_only'
        ? context.googleUpdateMasks.length > 0
        : context.nabatableUpdates.length > 0),
    canPushToGoogle: context.mode !== 'nabatable_only' && context.googleUpdateMasks.length > 0,
    activePublishJob: mapPublishJob(job),
  };
}

export async function preflightGoogleBusinessProfileWorkflowDraft(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  selectedApprovals: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
  client?: DbClient;
}): Promise<GoogleBusinessProfilePublishPreflight> {
  const client = getClient(params.client);
  const context = await buildPublishPreflightContext({
    restaurantId: params.restaurantId,
    draftId: params.draftId,
    selectedApprovals: params.selectedApprovals,
    decisions: params.decisions,
    actorUserId: params.actorUserId,
    directionIntent: params.directionIntent,
    pushToGoogle: params.pushToGoogle,
    client,
  });
  const job = await upsertPublishJobFromPreflight({
    restaurantId: params.restaurantId,
    actorUserId: params.actorUserId,
    context,
    client,
  });

  return buildPreflightResponse(context, job);
}

function sanitizeGoogleErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/([?&](?:access_token|refresh_token|token|key|secret)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b(access_token|refresh_token|token|key|secret)=\S+/gi, '$1=[redacted]')
    .replace(
      /("(?:access_token|refresh_token|token|key|secret)"\s*:\s*")[^"]+"/gi,
      '$1[redacted]"',
    );
}

function classifyGoogleBusinessProfilePushError(error: unknown): {
  classification: GoogleBusinessProfileGoogleErrorClassification;
  message: string;
} {
  const rawMessage = describeWorkflowError(error, 'Unable to push supported fields to Google.');
  const message = sanitizeGoogleErrorMessage(rawMessage);
  const lower = message.toLowerCase();
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : '';

  if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    return { classification: 'quota', message };
  }
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('unauthorized') ||
    lower.includes('scope')
  ) {
    return { classification: 'permission', message };
  }
  if (
    lower.includes('unsupported') ||
    lower.includes('update mask') ||
    lower.includes('field mask') ||
    code.includes('unsupported')
  ) {
    return { classification: 'unsupported_field', message };
  }
  if (
    status === 400 ||
    lower.includes('invalid') ||
    lower.includes('validation') ||
    lower.includes('bad request')
  ) {
    return { classification: 'validation', message };
  }

  return { classification: 'retryable', message };
}

async function publishDraftToNabatable(params: {
  restaurantId: string;
  draft: GoogleBusinessProfileWorkflowDraft;
  currentCore: CoreSnapshots;
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
        externalProvider: PROVIDER,
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

type PublishRollbackResult = {
  status: 'restored' | 'failed';
  errors: string[];
};

function restoreProfilePayload(profile: CoreSnapshots['profile']): UpdateRestaurantDetailsInput {
  return {
    name: profile.name,
    slug: profile.slug,
    timezone: profile.timezone,
    capacity: profile.capacity,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    address: profile.address,
    managerDailySummaryEnabled: profile.managerDailySummaryEnabled,
    managerNotificationPhone: profile.managerNotificationPhone,
    googleMapUrl: profile.googleMapUrl,
    googleReviewUrl: profile.googleReviewUrl,
    bookingPolicy: profile.bookingPolicy,
    logoUrl: profile.logoUrl,
  };
}

function restoreOperatingHoursPayload(
  operatingHours: CoreSnapshots['operatingHours'],
): UpdateOperatingHoursPayload {
  return {
    weekly: operatingHours.weekly.map((entry) => ({ ...entry })),
    overrides: operatingHours.overrides.map((entry) => ({ ...entry })),
  };
}

function restoreServicePeriodsPayload(
  servicePeriods: CoreSnapshots['servicePeriods'],
): UpdateServicePeriod[] {
  return servicePeriods.map((period) => ({
    id: period.id,
    name: period.name,
    dayOfWeek: period.dayOfWeek,
    startTime: period.startTime,
    endTime: period.endTime,
    bookingOption: period.bookingOption,
  }));
}

function restoreBusinessContextPayload(
  businessContext: CoreSnapshots['businessContext'],
  sections: Set<GoogleBusinessProfileDraftSectionKey>,
): UpdateRestaurantBusinessContextInput {
  return {
    ...(sections.has('businessContext.categories')
      ? { categories: businessContext.core.categories }
      : {}),
    ...(sections.has('businessContext.serviceAreas')
      ? { serviceAreas: businessContext.core.serviceAreas }
      : {}),
    ...(sections.has('businessContext.attributes')
      ? { attributes: businessContext.core.attributes }
      : {}),
    ...(sections.has('businessContext.serviceItems')
      ? { serviceItems: businessContext.core.serviceItems }
      : {}),
  };
}

async function restoreCoreSnapshotAfterFailedPublish(params: {
  restaurantId: string;
  draft: GoogleBusinessProfileWorkflowDraft;
  snapshot: CoreSnapshots;
  client: DbClient;
}): Promise<PublishRollbackResult> {
  const sections = new Set(selectedSectionKeys(params.draft));
  const errors: string[] = [];

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

function buildFailedPublishErrors(input: {
  publishError: unknown;
  rollback: PublishRollbackResult;
}) {
  return [
    {
      message: describeWorkflowError(input.publishError, 'Unable to publish selected draft items.'),
      rollback: input.rollback,
    },
  ];
}

function selectedGooglePushAuditValues(draft: GoogleBusinessProfileWorkflowDraft) {
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

async function pushDraftToGoogle(params: {
  restaurantId: string;
  draft: GoogleBusinessProfileWorkflowDraft;
  externalProfile: ExternalProfileRow | null;
  actorUserId: string;
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
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

  try {
    if (googleSections.includes('profile')) {
      const fields = (profileFieldsForDraft(params.draft, 'google_only') ?? []).filter((field) =>
        ['name', 'contactPhone'].includes(field),
      ) as Array<'name' | 'contactPhone'>;
      if (fields.length > 0) {
        await syncRestaurantProfileWithGoogleBusinessProfile({
          restaurantId: params.restaurantId,
          direction: 'push_to_gbp',
          fields,
          client: params.client,
        });
      }
    }
    if (googleSections.includes('operatingHours')) {
      await syncRestaurantOperatingHoursWithGoogleBusinessProfile({
        restaurantId: params.restaurantId,
        direction: 'push_to_gbp',
        selection: operatingHoursSelectionForDraft(params.draft, 'google_only'),
        client: params.client,
      });
    }
    if (googleSections.includes('servicePeriods')) {
      await syncRestaurantServicePeriodsWithGoogleBusinessProfile({
        restaurantId: params.restaurantId,
        direction: 'push_to_gbp',
        selection: servicePeriodsSelectionForDraft(params.draft, 'google_only'),
        client: params.client,
      });
    }
    await updatePublishEvent(googleEvent.id, 'success', [], params.client);
    return googleEvent.id;
  } catch (error) {
    const classified = classifyGoogleBusinessProfilePushError(error);
    await updatePublishEvent(googleEvent.id, 'failed', [classified], params.client);
    throw Object.assign(new Error(classified.message), {
      name: 'GBP_GOOGLE_PUSH_FAILED',
      classification: classified.classification,
      googleEventId: googleEvent.id,
    });
  }
}

export async function publishGoogleBusinessProfileWorkflowDraft(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
  publishJobId?: string;
  publishPlanId?: string;
  idempotencyKey?: string;
  selectedApprovals?: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  client?: DbClient;
}): Promise<PublishGoogleBusinessProfileDraftResult> {
  const client = getClient(params.client);
  let job: PublishJobRow | null = null;
  const publishJobId = params.publishPlanId ?? params.publishJobId;
  if (publishJobId) {
    job = await readPublishJobById({
      restaurantId: params.restaurantId,
      draftId: params.draftId,
      publishJobId,
      client,
    });
    if (!job) {
      throw createWorkflowNamedError('GBP_PUBLISH_JOB_NOT_FOUND', 'Update was not found.');
    }
    if (params.idempotencyKey && job.idempotency_key !== params.idempotencyKey) {
      throw createWorkflowNamedError(
        'GBP_PUBLISH_JOB_MISMATCH',
        'Update confirmation no longer matches the final check.',
      );
    }
    if (params.directionIntent || params.pushToGoogle !== undefined) {
      const requestedIntent = normalizePublishDirectionIntent({
        directionIntent: params.directionIntent,
        pushToGoogle: params.pushToGoogle,
      });
      const jobIntent = directionIntentForPublishMode(job.mode as GoogleBusinessProfilePublishMode);
      if (requestedIntent !== jobIntent) {
        throw createWorkflowNamedError(
          'GBP_DIRECTION_CONFLICT',
          'Update path does not match the final check.',
        );
      }
    }
  }

  const selectedApprovals =
    params.selectedApprovals ?? (job ? toObjectRecord(job.selected_approvals) : {});
  const jobDecisions = job ? extractFieldDecisions(job.selected_approvals) : [];
  const directionIntent = job
    ? directionIntentForPublishMode(job.mode as GoogleBusinessProfilePublishMode)
    : normalizePublishDirectionIntent({
        directionIntent: params.directionIntent,
        pushToGoogle: params.pushToGoogle,
      });
  const context = await buildPublishPreflightContext({
    restaurantId: params.restaurantId,
    draftId: params.draftId,
    selectedApprovals,
    decisions: jobDecisions.length > 0 ? jobDecisions : params.decisions,
    actorUserId: params.actorUserId,
    directionIntent,
    client,
  });

  if (!job) {
    job = await upsertPublishJobFromPreflight({
      restaurantId: params.restaurantId,
      actorUserId: params.actorUserId,
      context,
      client,
    });
  }
  if (job.idempotency_key !== context.idempotencyKey) {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_MISMATCH',
      'Update no longer matches the current final check.',
    );
  }
  if (job.status === 'published') {
    const response = await getGoogleBusinessProfileWorkflow(params.restaurantId, client);
    return {
      ...response,
      result: 'published',
      nabatableEventId: job.nabatable_publish_event_id,
      googleEventId: job.google_publish_event_id,
    };
  }
  if (job.status === 'partially_published' || job.status === 'google_failed') {
    const response = await getGoogleBusinessProfileWorkflow(params.restaurantId, client);
    return {
      ...response,
      result: 'partially_published',
      nabatableEventId: job.nabatable_publish_event_id,
      googleEventId: job.google_publish_event_id,
    };
  }
  if (job.status !== 'preflight_ready') {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_INVALID_STATE',
      `Update is ${formatDraftStatus(job.status)} and cannot be applied.`,
    );
  }

  const draftPublishingPatch: Database['public']['Tables']['restaurant_external_profile_drafts']['Update'] =
    {
      status: 'publishing',
      selected_approvals: selectedApprovalsWithDecisions(
        context.selectedApprovals,
        context.decisions,
      ),
    };
  // Preserve the Step 1 approval timestamp/actor when present; only stamp them
  // here if recovery flows reach publish without an explicit approval row (e.g.
  // legacy drafts that predate the strict two-step contract).
  if (!context.draftRow.approved_at) {
    draftPublishingPatch.approved_at = nowIso();
  }
  if (!context.draftRow.approved_by_user_id) {
    draftPublishingPatch.approved_by_user_id = params.actorUserId;
  }
  job = await claimPublishJobForPublishing({
    jobId: job.id,
    actorUserId: params.actorUserId,
    context,
    client,
  });

  const { error: draftUpdateError } = await client
    .from('restaurant_external_profile_drafts')
    .update(draftPublishingPatch)
    .eq('id', context.draft.id)
    .eq('restaurant_id', params.restaurantId)
    .eq('provider', PROVIDER);
  if (draftUpdateError) {
    throw draftUpdateError;
  }

  let nabatableEventId: string | null = null;
  let postNabatableHashes: Record<GoogleBusinessProfileDraftSectionKey, string>;
  if (context.mode === 'google_only') {
    postNabatableHashes = context.currentHashes;
    const { error: jobNabatableError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        post_nabatable_core_hashes: toJson(postNabatableHashes),
      })
      .eq('id', job.id);
    if (jobNabatableError) {
      throw jobNabatableError;
    }
  } else {
    try {
      nabatableEventId = await publishDraftToNabatable({
        restaurantId: params.restaurantId,
        draft: context.draft,
        currentCore: context.currentCore,
        externalProfile: context.externalProfile,
        actorUserId: params.actorUserId,
        publishJobId: job.id,
        client,
      });
      postNabatableHashes = buildCoreSnapshotHashes(
        await readCoreSnapshots(params.restaurantId, client),
      );
      const { error: jobNabatableError } = await client
        .from('restaurant_external_profile_publish_jobs')
        .update({
          nabatable_publish_event_id: nabatableEventId,
          nabatable_published_at: nowIso(),
          post_nabatable_core_hashes: toJson(postNabatableHashes),
        })
        .eq('id', job.id);
      if (jobNabatableError) {
        throw jobNabatableError;
      }
    } catch (error) {
      const rollback = await restoreCoreSnapshotAfterFailedPublish({
        restaurantId: params.restaurantId,
        draft: context.draft,
        snapshot: context.currentCore,
        client,
      });
      const failedPublishErrors = buildFailedPublishErrors({
        publishError: error,
        rollback,
      });

      await Promise.all([
        client
          .from('restaurant_external_profile_drafts')
          .update({
            status: 'failed',
            conflict_metadata: toJson({
              failedAt: nowIso(),
              rollback,
            }),
          })
          .eq('id', context.draft.id),
        client
          .from('restaurant_external_profile_publish_jobs')
          .update({
            status: 'failed',
            errors: toJson(failedPublishErrors),
            failed_at: nowIso(),
            nabatable_publish_event_id: nabatableEventId,
          })
          .eq('id', job.id),
      ]);
      throw error;
    }
  }

  let googleEventId: string | null = null;
  let finalStatus: 'published' | 'partially_published' = 'published';
  if (context.mode !== 'nabatable_only' && context.googleUpdateMasks.length > 0) {
    try {
      googleEventId = await pushDraftToGoogle({
        restaurantId: params.restaurantId,
        draft: context.draft,
        externalProfile: context.externalProfile,
        actorUserId: params.actorUserId,
        googleUpdateMasks: context.googleUpdateMasks,
        client,
      });
    } catch (error) {
      finalStatus = 'partially_published';
      googleEventId =
        error && typeof error === 'object' && 'googleEventId' in error
          ? String((error as { googleEventId?: unknown }).googleEventId)
          : null;
      const classified =
        error && typeof error === 'object' && 'classification' in error
          ? {
              classification: (
                error as {
                  classification?: GoogleBusinessProfileGoogleErrorClassification;
                }
              ).classification,
              message: describeWorkflowError(error, 'Unable to push supported fields to Google.'),
            }
          : classifyGoogleBusinessProfilePushError(error);
      const { error: googleFailureUpdateError } = await client
        .from('restaurant_external_profile_publish_jobs')
        .update({
          status: 'google_failed',
          google_publish_event_id: googleEventId,
          error_classification: classified.classification ?? 'retryable',
          errors: toJson([classified]),
          failed_at: nowIso(),
        })
        .eq('id', job.id);
      if (googleFailureUpdateError) {
        throw googleFailureUpdateError;
      }
      if (context.mode === 'google_only') {
        const { error: draftGoogleFailureError } = await client
          .from('restaurant_external_profile_drafts')
          .update({
            status: 'failed',
            conflict_metadata: toJson({
              failedAt: nowIso(),
              googlePush: classified,
            }),
          })
          .eq('id', context.draft.id);
        if (draftGoogleFailureError) {
          throw draftGoogleFailureError;
        }
        throw error;
      }
    }
  }

  const publishedAt = nowIso();
  const { error: draftPublishedError } = await client
    .from('restaurant_external_profile_drafts')
    .update({
      status: finalStatus,
      published_by_user_id: params.actorUserId,
      published_at: publishedAt,
    })
    .eq('id', context.draft.id);
  if (draftPublishedError) {
    throw draftPublishedError;
  }

  if (finalStatus === 'published') {
    const { error: jobPublishedError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        status: 'published',
        google_publish_event_id: googleEventId,
        google_pushed_at: googleEventId ? publishedAt : null,
        error_classification: null,
        errors: [],
      })
      .eq('id', job.id);
    if (jobPublishedError) {
      throw jobPublishedError;
    }
  }

  const response = await getGoogleBusinessProfileWorkflow(params.restaurantId, client);
  return {
    ...response,
    result: finalStatus,
    nabatableEventId,
    googleEventId,
  };
}

export async function retryGoogleBusinessProfileWorkflowGooglePush(params: {
  restaurantId: string;
  draftId: string;
  publishJobId: string;
  actorUserId: string;
  client?: DbClient;
}): Promise<RetryGoogleBusinessProfilePushResult> {
  const client = getClient(params.client);
  let job = await readPublishJobById({
    restaurantId: params.restaurantId,
    draftId: params.draftId,
    publishJobId: params.publishJobId,
    client,
  });
  if (!job) {
    throw createWorkflowNamedError('GBP_PUBLISH_JOB_NOT_FOUND', 'Update was not found.');
  }
  const googleUpdateMasks = normalizeGoogleMasks(job.google_update_masks);
  if (
    (job.mode !== 'nabatable_and_google' && job.mode !== 'google_only') ||
    googleUpdateMasks.length === 0 ||
    !GOOGLE_RETRYABLE_JOB_STATUSES.includes(job.status)
  ) {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_INVALID_STATE',
      'Google retry is only available for failed or partial Google updates.',
    );
  }

  const draftRow = await readDraftById(params.restaurantId, params.draftId, client);
  if (!draftRow) {
    throw new Error('Google Business Profile review was not found.');
  }
  const selectedApprovals = toObjectRecord(job.selected_approvals);
  const draft = mapDraft(
    draftRow,
    selectedApprovals,
    extractFieldDecisions(job.selected_approvals),
  );
  const currentHashes: Record<string, string> = buildCoreSnapshotHashes(
    await readCoreSnapshots(params.restaurantId, client),
  );
  const storedHashes = toStringRecord(job.post_nabatable_core_hashes);
  const changedSections = (job.nabatable_sections ?? []).filter(
    (section) => storedHashes[section] !== currentHashes[section],
  );

  if (changedSections.length > 0) {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_CORE_CHANGED',
      `Cannot retry Google because Nabatable details changed after the update: ${changedSections.join(', ')}.`,
    );
  }

  const externalProfile = await findExternalProfile(params.restaurantId, client);
  assertGooglePushEnabled(externalProfile);
  job = await claimPublishJobForGoogleRetry({
    jobId: job.id,
    actorUserId: params.actorUserId,
    client,
  });

  try {
    const googleEventId = await pushDraftToGoogle({
      restaurantId: params.restaurantId,
      draft,
      externalProfile,
      actorUserId: params.actorUserId,
      googleUpdateMasks,
      client,
    });
    const pushedAt = nowIso();
    const { error: jobUpdateError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        status: 'published',
        google_publish_event_id: googleEventId,
        google_pushed_at: pushedAt,
        google_retry_by_user_id: params.actorUserId,
        retried_at: pushedAt,
        error_classification: null,
        errors: [],
      })
      .eq('id', job.id);
    if (jobUpdateError) {
      throw jobUpdateError;
    }
    const { error: draftUpdateError } = await client
      .from('restaurant_external_profile_drafts')
      .update({
        status: 'published',
        published_by_user_id: params.actorUserId,
        published_at: pushedAt,
      })
      .eq('id', draft.id);
    if (draftUpdateError) {
      throw draftUpdateError;
    }
    return {
      ...(await getGoogleBusinessProfileWorkflow(params.restaurantId, client)),
      googleEventId,
    };
  } catch (error) {
    const classified =
      error && typeof error === 'object' && 'classification' in error
        ? {
            classification: (
              error as {
                classification?: GoogleBusinessProfileGoogleErrorClassification;
              }
            ).classification,
            message: describeWorkflowError(error, 'Unable to push supported fields to Google.'),
          }
        : classifyGoogleBusinessProfilePushError(error);
    const googleEventId =
      error && typeof error === 'object' && 'googleEventId' in error
        ? String((error as { googleEventId?: unknown }).googleEventId)
        : job.google_publish_event_id;
    const { error: retryFailureUpdateError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        status: 'google_failed',
        google_publish_event_id: googleEventId,
        google_retry_by_user_id: params.actorUserId,
        retried_at: nowIso(),
        error_classification: classified.classification ?? 'retryable',
        errors: toJson([classified]),
      })
      .eq('id', job.id);
    if (retryFailureUpdateError) {
      throw retryFailureUpdateError;
    }
    throw error;
  }
}

export const googleBusinessProfileWorkflowTestUtils = {
  assertDraftEditable,
  assertDraftPublishable,
  assertGooglePushEnabled,
  assertApprovalWorkflowDirectionSupported,
  assertApprovalWorkflowOneWay,
  buildOperatingHoursSection,
  buildServicePeriodsSection,
  buildBusinessContextSection,
  buildFailedPublishErrors,
  businessContextPayloadForDraft,
  classifyGoogleBusinessProfilePushError,
  directionIntentForPublishMode,
  googleMasksForDraft,
  isUniqueConstraintError,
  normalizePublishDirectionIntent,
  profileProjectionCleanupTargets,
  providerValueChangedForStaleCheck,
  publishModeForDirectionIntent,
  pushToGoogleForDirectionIntent,
  claimPublishJobForGoogleRetry,
  claimPublishJobForPublishing,
  reconcileDraftWithCurrentSections,
  suppressActionsForReadOnlyReview,
  restoreCoreSnapshotAfterFailedPublish,
};
