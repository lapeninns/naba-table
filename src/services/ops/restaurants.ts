import { fetchJson } from '@/lib/http/fetchJson';
import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type {
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';
import type { OpsRestaurantOption, OpsServiceError } from '@/types/ops';
import type { OccasionKey } from '@reserve/shared/occasions';

export const OPS_RESTAURANTS_BASE = '/api/ops/restaurants';

type RestaurantsListResponse = {
  items: Array<{
    id: string;
    name: string | null;
    slug: string | null;
    isActive?: boolean;
    timezone: string | null;
    capacity: number | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    businessDescription: string | null;
    managerDailySummaryEnabled: boolean;
    managerWhatsappEnabled: boolean;
    managerName: string | null;
    managerNotificationPhone: string | null;
    googleMapUrl: string | null;
    googleReviewUrl: string | null;
    bookingPolicy: string | null;
    createdAt: string;
    updatedAt: string;
    role: RestaurantRole;
  }>;
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
};

type RestaurantResponse = {
  restaurant: {
    id: string;
    name: string | null;
    slug: string | null;
    isActive?: boolean;
    timezone: string | null;
    capacity: number | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    businessDescription: string | null;
    managerDailySummaryEnabled: boolean;
    managerWhatsappEnabled: boolean;
    managerName: string | null;
    managerNotificationPhone: string | null;
    googleMapUrl: string | null;
    googleReviewUrl: string | null;
    bookingPolicy: string | null;
    logoUrl: string | null;
    emailSendReminder24h: boolean;
    emailSendReminderShort: boolean;
    emailSendReviewRequest: boolean;
    reservationIntervalMinutes: number | null;
    reservationDefaultDurationMinutes: number | null;
    reservationLastSeatingBufferMinutes: number | null;
    reservationLifecycleGraceMinutes: number | null;
    sundayRoastEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    role: RestaurantRole;
  };
};

type ServicePeriodsResponse = {
  restaurantId: string;
  periods: ServicePeriodRow[];
};

type TurnBandsResponse = {
  restaurantId: string;
  bands: TurnBandsPayload;
  defaults: TurnBandsPayload;
};

type EmailTemplatesResponse = {
  restaurantId: string;
  canEdit: boolean;
  groups: RestaurantEmailTemplateGroup[];
};

type EmailTemplateResponse = {
  restaurantId: string;
  canEdit: boolean;
  template: RestaurantEmailTemplate;
};

type EmailTemplatePreviewResponse = {
  restaurantId: string;
  preview: RestaurantEmailTemplatePreview;
};

export type SendTestEmailTemplateResponse = {
  ok: true;
  restaurantId: string;
  provider: 'resend' | 'mock';
  messageId: string;
  preview: RestaurantEmailTemplatePreview;
};

export type GoogleBusinessProfileAvailableLocation = {
  accountName: string;
  accountId: string;
  accountDisplayName: string | null;
  locationName: string;
  locationId: string;
  title: string | null;
  addressText: string | null;
  placeId: string | null;
};

export type GoogleBusinessProfileBusinessInfo = {
  details: {
    businessName: string | null;
    description: string | null;
    languageCode: string | null;
    openingDate: string | null;
    businessStatus: string | null;
    isServiceAreaBusiness: boolean;
    canReopen: boolean | null;
    source: string;
    managedBy: string;
    lastSyncedAt: string | null;
    verification?: {
      businessName: GoogleBusinessProfileFieldVerification | null;
      description: GoogleBusinessProfileFieldVerification | null;
      languageCode: GoogleBusinessProfileFieldVerification | null;
      openingDate: GoogleBusinessProfileFieldVerification | null;
      businessStatus: GoogleBusinessProfileFieldVerification | null;
      isServiceAreaBusiness: GoogleBusinessProfileFieldVerification | null;
      canReopen: GoogleBusinessProfileFieldVerification | null;
    };
  } | null;
  addresses: Array<{
    id: string;
    addressType: string;
    formattedAddress: string | null;
    addressLines: string[];
    locality: string | null;
    administrativeArea: string | null;
    postalCode: string | null;
    regionCode: string | null;
    countryCode: string | null;
    languageCode: string | null;
    sublocality: string | null;
    organization: string | null;
    sortingCode: string | null;
    recipients: string[];
    latlng: {
      latitude?: number;
      longitude?: number;
    } | null;
    latitude: number | null;
    longitude: number | null;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  phoneNumbers: Array<{
    id: string;
    phoneKind: string;
    phoneNumber: string;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  links: Array<{
    id: string;
    linkType: string;
    linkStatus: string;
    label: string | null;
    url: string;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  categories: Array<{
    id: string;
    displayName: string;
    categoryCode: string | null;
    moreHoursTypes: Array<{
      hoursTypeId: string | null;
      displayName: string | null;
      localizedDisplayName: string | null;
    }>;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  serviceAreas: Array<{
    id: string;
    displayName: string;
    areaType: string;
    regionCode: string | null;
    googlePlaceId: string | null;
    googlePlaceResourceName: string | null;
    placeData: Record<string, unknown> | null;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  hours: Array<{
    id: string;
    hoursType: string;
    periodLabel: string | null;
    periodCode: string | null;
    openDay: number | null;
    closeDay: number | null;
    startDate: string | null;
    endDate: string | null;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  attributes: Array<{
    id: string;
    attributeGroup: string | null;
    attributeKey: string;
    attributeName: string | null;
    attributeId: string | null;
    displayName: string | null;
    displayText: string | null;
    displayTextStandalone: string | null;
    displayTextNegative: string | null;
    valueType: string;
    boolValue: boolean | null;
    textValue: string | null;
    uriValue: string | null;
    uriValues: string[];
    enumValues: string[];
    unsetEnumValues: string[];
    rawValue: Record<string, unknown> | null;
    rawEnumValues: Record<string, unknown> | null;
    displayValue: Record<string, unknown> | null;
    valueMetadata: Array<{
      value: boolean | string | null;
      displayName: string | null;
    }>;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  serviceItems: Array<{
    id: string;
    itemKey: string;
    itemType: string | null;
    displayName: string | null;
    description: string | null;
    payload: Record<string, unknown> | null;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  coreNormalization: GoogleBusinessProfileCoreNormalization;
};

export type GoogleBusinessProfileFieldVerification = {
  provider: string;
  syncStatus: string;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  lastSyncedAt: string | null;
  lastCheckedAt: string | null;
};

export type GoogleBusinessProfileCoreMatchStatus =
  | 'matched'
  | 'drifted'
  | 'partial'
  | 'unavailable';

export type GoogleBusinessProfileCoreNormalization = {
  operatingHours: {
    source: 'kitchen' | 'public' | 'unavailable';
    matchStatus: GoogleBusinessProfileCoreMatchStatus;
    summary: string;
    warnings: string[];
    weekly: Array<{
      dayOfWeek: number;
      opensAt: string | null;
      closesAt: string | null;
      isClosed: boolean;
      matchesCore: boolean | null;
    }>;
    overrides: Array<{
      effectiveDate: string;
      opensAt: string | null;
      closesAt: string | null;
      isClosed: boolean;
      matchesCore: boolean | null;
    }>;
  };
  servicePeriods: {
    source: 'more_hours' | 'unavailable';
    matchStatus: GoogleBusinessProfileCoreMatchStatus;
    summary: string;
    warnings: string[];
    periods: Array<{
      bookingOption: 'lunch' | 'dinner';
      name: string;
      dayOfWeek: number | null;
      startTime: string;
      endTime: string;
      matchesCore: boolean | null;
    }>;
  };
  bookingHours: {
    matchStatus: 'partial' | 'unavailable';
    summary: string;
    warnings: string[];
    missingInputs: string[];
  };
};

export type GoogleBusinessProfileConnection = {
  isConfigured: boolean;
  provider: 'google_business_profile';
  status: 'pending_auth' | 'authorized' | 'linked' | 'unlinked' | 'reauth_required' | 'sync_error';
  pushEnabled: boolean;
  connectedGoogleEmail: string | null;
  connectedGoogleName: string | null;
  externalAccountId: string | null;
  externalAccountName: string | null;
  externalLocationId: string | null;
  externalLocationName: string | null;
  externalLocationTitle: string | null;
  externalPlaceId: string | null;
  providerTimezone?: string | null;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastError: string | null;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
  businessInfo: GoogleBusinessProfileBusinessInfo;
};

export type GoogleBusinessProfileAuthorizationStart = {
  authorizationUrl: string;
};

export type GoogleBusinessProfileDraftSectionKey =
  | 'profile'
  | 'operatingHours'
  | 'servicePeriods'
  | 'businessContext.categories'
  | 'businessContext.serviceAreas'
  | 'businessContext.attributes'
  | 'businessContext.serviceItems';

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

export type GoogleBusinessProfileDraftItem = {
  fieldKey: string;
  label: string;
  sectionKey: GoogleBusinessProfileDraftSectionKey;
  currentValue: unknown;
  providerValue: unknown;
  proposedValue: unknown;
  direction: CoreSyncDirection;
  status: 'ready' | 'unchanged' | 'unsupported' | 'warning';
  selected: boolean;
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
  status: string;
  fetchedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  staleSections: string[];
  conflictMetadata: unknown;
  selectedApprovals: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecision[];
  sourceSnapshotRefs: unknown;
  coreSnapshotHashes: Record<string, string>;
  sectionDiffs: GoogleBusinessProfileDraftSection[];
  createdAt: string;
  updatedAt: string;
};

export type GoogleBusinessProfileWorkflowAuditEvent = {
  id: string;
  draftId: string | null;
  direction: string;
  flow: GoogleBusinessProfileAuditFlow;
  directionLabel: string;
  affectedSections: string[];
  googleUpdateMasks: unknown;
  result: string;
  errors: unknown;
  createdAt: string;
};

export type GoogleBusinessProfilePublishMode =
  | 'nabatable_only'
  | 'nabatable_and_google'
  | 'google_only';

export type GoogleBusinessProfilePublishDirectionIntent =
  | 'google_to_nabatable'
  | 'google_to_nabatable_with_google_sync'
  | 'nabatable_to_google';

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

export type GoogleBusinessProfileActivePublishJob = {
  id: string;
  draftId: string;
  idempotencyKey: string;
  mode: GoogleBusinessProfilePublishMode;
  directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  status: string;
  selectedApprovals: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecision[];
  nabatableSections: string[];
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
  postNabatableCoreHashes: Record<string, string>;
  errorClassification: GoogleBusinessProfileGoogleErrorClassification | null;
  errors: unknown;
  nabatableEventId: string | null;
  googleEventId: string | null;
  canRetryGooglePush: boolean;
  retryBlockedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoogleBusinessProfileWorkflow = {
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

/**
 * Two-step approval workflow stage derived from the latest draft + active
 * publish job. Used by the WorkflowCard stepper to gate UI affordances.
 */
export type GoogleBusinessProfileWorkflowStage =
  | 'no_draft'
  | 'review'
  | 'approved'
  | 'preflighted'
  | 'publishing'
  | 'published'
  | 'partial_failure';

export function deriveGoogleBusinessProfileWorkflowStage(
  workflow: GoogleBusinessProfileWorkflow | null | undefined,
): GoogleBusinessProfileWorkflowStage {
  const draft = workflow?.latestDraft;
  if (!draft) return 'no_draft';
  const job = workflow?.activePublishJob;
  if (
    job &&
    job.draftId === draft.id &&
    (job.status === 'google_failed' ||
      job.status === 'partially_published' ||
      draft.status === 'partially_published')
  ) {
    return 'partial_failure';
  }
  if (draft.status === 'published') return 'published';
  if (draft.status === 'publishing') return 'publishing';
  if (draft.status === 'failed' || draft.status === 'partially_published') return 'partial_failure';
  if (draft.status === 'approved') {
    if (job && job.draftId === draft.id && job.status === 'preflight_ready') {
      return 'preflighted';
    }
    return 'approved';
  }
  return 'review';
}

export type GoogleBusinessProfileDraftPatchPayload = {
  selectedApprovals?: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  status?: 'review_ready' | 'approved';
};

export type GoogleBusinessProfileDraftPublishPayload =
  GoogleBusinessProfileProtectedActionPayload & {
    publishJobId?: string;
    publishPlanId?: string;
    idempotencyKey: string;
    selectedApprovals?: Record<string, boolean>;
    decisions?: GoogleBusinessProfileFieldDecisionInput[];
    directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
    pushToGoogle?: boolean;
  };

export type GoogleBusinessProfileDraftPublishPreflightPayload = {
  selectedApprovals: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
};

export type GoogleBusinessProfileDraftPublishPreflight = {
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

export type RestaurantBusinessContextMoreHoursType = {
  hoursTypeId: string | null;
  displayName: string | null;
  localizedDisplayName: string | null;
};

export type RestaurantBusinessContextAttributeValueMetadata = {
  value: boolean | string | null;
  displayName: string | null;
};

export type RestaurantBusinessContextBusinessDetails = {
  id: string;
  openingDate: string | null;
  businessStatus: string | null;
  isServiceAreaBusiness: boolean;
  source: string;
  managedBy: string;
  updatedAt: string | null;
};

export type RestaurantBusinessContextLink = {
  id: string;
  linkType: string;
  linkStatus: string;
  label: string | null;
  url: string;
  isPrimary: boolean;
  source: string;
  managedBy: string;
  updatedAt: string | null;
};

export type RestaurantBusinessContextCategory = {
  id: string;
  displayName: string;
  categoryCode: string | null;
  moreHoursTypes: RestaurantBusinessContextMoreHoursType[];
  isPrimary: boolean;
  source: string;
  managedBy: string;
  updatedAt: string | null;
};

export type RestaurantBusinessContextServiceArea = {
  id: string;
  displayName: string;
  areaType: string;
  regionCode: string | null;
  googlePlaceId: string | null;
  googlePlaceResourceName: string | null;
  placeData: Record<string, unknown> | null;
  source: string;
  managedBy: string;
  updatedAt: string | null;
};

export type RestaurantBusinessContextAttribute = {
  id: string;
  attributeGroup: string | null;
  attributeKey: string;
  attributeName: string | null;
  attributeId: string | null;
  displayName: string | null;
  displayText: string | null;
  displayTextStandalone: string | null;
  displayTextNegative: string | null;
  valueType: string;
  boolValue: boolean | null;
  textValue: string | null;
  uriValue: string | null;
  uriValues: string[];
  enumValues: string[];
  unsetEnumValues: string[];
  rawValue: Record<string, unknown> | null;
  rawEnumValues: Record<string, unknown> | null;
  displayValue: Record<string, unknown> | null;
  valueMetadata: RestaurantBusinessContextAttributeValueMetadata[];
  source: string;
  managedBy: string;
  updatedAt: string | null;
};

export type RestaurantBusinessContextServiceItem = {
  id: string;
  itemKey: string;
  itemType: string | null;
  displayName: string | null;
  description: string | null;
  payload: Record<string, unknown> | null;
  source: string;
  managedBy: string;
  updatedAt: string | null;
};

export type RestaurantBusinessContextFamily = {
  businessDetails?: RestaurantBusinessContextBusinessDetails | null;
  links?: RestaurantBusinessContextLink[];
  categories: RestaurantBusinessContextCategory[];
  serviceAreas: RestaurantBusinessContextServiceArea[];
  attributes: RestaurantBusinessContextAttribute[];
  serviceItems: RestaurantBusinessContextServiceItem[];
};

export type RestaurantBusinessContextSnapshot = {
  core: RestaurantBusinessContextFamily;
  providerSnapshot: RestaurantBusinessContextFamily;
};

export type UpdateRestaurantBusinessContextInput = Partial<{
  businessDetails: {
    openingDate?: string | null;
    businessStatus?: string | null;
    isServiceAreaBusiness?: boolean;
  };
  links: Array<{
    id?: string;
    linkType: string;
    linkStatus?: string | null;
    label?: string | null;
    url: string;
    isPrimary?: boolean;
  }>;
  categories: Array<{
    id?: string;
    displayName: string;
    categoryCode?: string | null;
    moreHoursTypes?: RestaurantBusinessContextMoreHoursType[];
    isPrimary?: boolean;
  }>;
  serviceAreas: Array<{
    id?: string;
    displayName: string;
    areaType?: string;
    regionCode?: string | null;
    googlePlaceId?: string | null;
    googlePlaceResourceName?: string | null;
    placeData?: Record<string, unknown> | null;
  }>;
  attributes: Array<{
    id?: string;
    attributeGroup?: string | null;
    attributeKey: string;
    attributeName?: string | null;
    attributeId?: string | null;
    displayName?: string | null;
    displayText?: string | null;
    displayTextStandalone?: string | null;
    displayTextNegative?: string | null;
    valueType: string;
    boolValue?: boolean | null;
    textValue?: string | null;
    uriValue?: string | null;
    uriValues?: string[];
    enumValues?: string[];
    unsetEnumValues?: string[];
    rawValue?: Record<string, unknown> | null;
    rawEnumValues?: Record<string, unknown> | null;
    displayValue?: Record<string, unknown> | null;
    valueMetadata?: RestaurantBusinessContextAttributeValueMetadata[];
  }>;
  serviceItems: Array<{
    id?: string;
    itemKey: string;
    itemType?: string | null;
    displayName?: string | null;
    description?: string | null;
    payload?: Record<string, unknown> | null;
  }>;
}>;

export type LinkGoogleBusinessProfileLocationInput = {
  accountName: string;
  accountId: string;
  locationName: string;
  locationId: string;
};

export type RestaurantProfile = {
  id: string;
  name: string;
  slug: string | null;
  isActive?: boolean;
  timezone: string | null;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  businessDescription: string | null;
  managerDailySummaryEnabled: boolean;
  managerWhatsappEnabled: boolean;
  managerName: string | null;
  managerNotificationPhone: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
  emailSendReminder24h: boolean;
  emailSendReminderShort: boolean;
  emailSendReviewRequest: boolean;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
  sundayRoastEnabled: boolean;
  updatedAt?: string | null;
};

export type OperatingHoursRow = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
  reservationIntervalMinutes?: number | null;
  reservationSlotTimes?: string[] | null;
};

export type OperatingHoursOverride = {
  id?: string;
  effectiveDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
  reservationIntervalMinutes?: number | null;
  reservationSlotTimes?: string[] | null;
};

export type OperatingHoursSnapshot = {
  updatedAt?: string | null;
  weekly: OperatingHoursRow[];
  overrides: OperatingHoursOverride[];
};

export type ServicePeriodRow = {
  id?: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: OccasionKey;
  updatedAt?: string | null;
};

export type CoreSyncDirection = 'pull_from_gbp' | 'push_to_gbp';

export type GoogleBusinessProfileProtectedActionPayload = {
  password: string;
};

export type GoogleBusinessProfileProfileField =
  | 'name'
  | 'contactPhone'
  | 'address'
  | 'googleMapUrl'
  | 'googleReviewUrl';

export type GoogleBusinessProfileProfileSyncPayload =
  GoogleBusinessProfileProtectedActionPayload & {
    direction?: CoreSyncDirection;
    fields?: GoogleBusinessProfileProfileField[];
  };

export type GoogleBusinessProfileOperatingHoursSelection = {
  weeklyDays?: number[];
  overrideDates?: string[];
};

export type GoogleBusinessProfileOperatingHoursSyncPayload =
  GoogleBusinessProfileProtectedActionPayload & {
    direction?: CoreSyncDirection;
    selection?: GoogleBusinessProfileOperatingHoursSelection;
  };

export type GoogleBusinessProfileServicePeriodsSelection = {
  dayOfWeeks?: number[];
};

export type GoogleBusinessProfileServicePeriodsSyncPayload =
  GoogleBusinessProfileProtectedActionPayload & {
    direction?: CoreSyncDirection;
    selection?: GoogleBusinessProfileServicePeriodsSelection;
  };

export type TurnBandInput = {
  maxPartySize: number;
  durationMinutes: number;
};

export type TurnBandsPayload = Record<string, TurnBandInput[]>;

export type TurnBandsSnapshot = {
  restaurantId: string;
  bands: TurnBandsPayload;
  defaults: TurnBandsPayload;
};

export type RestaurantEmailTemplate = {
  key: RestaurantBookingEmailTemplateKey;
  title: string;
  description: string;
  groupKey: string;
  supportsCtaLabel: boolean;
  availableVariables: string[];
  recommendedVariables: string[];
  authoringHints: string[];
  status: 'default' | 'custom';
  activeVariantCount: number;
  variants: RestaurantEmailTemplateVariant[];
  defaultVariants: RestaurantEmailTemplateVariant[];
};

export type RestaurantEmailTemplateGroup = {
  key: string;
  title: string;
  description: string;
  templates: RestaurantEmailTemplate[];
};

export type RestaurantEmailTemplatesSnapshot = {
  restaurantId: string;
  canEdit: boolean;
  groups: RestaurantEmailTemplateGroup[];
};

export type RestaurantEmailTemplatePreview = {
  templateKey: RestaurantBookingEmailTemplateKey;
  selectedVariantId: string;
  selectedVariantName: string;
  preheader: string;
  headline: string;
  intro: string;
  cue: string;
  ask: string;
  ctaLabel: string;
  ctaUrl: string;
  subject: string;
  html: string;
  text: string;
};

export type PreviewEmailTemplateInput = {
  preferredVariantId?: string;
  variants?: RestaurantEmailTemplateVariant[];
};

export type SendTestEmailTemplateInput = PreviewEmailTemplateInput & {
  toEmail: string;
};

export interface RestaurantService {
  listRestaurants(): Promise<Array<OpsRestaurantOption & { role: RestaurantRole }>>;
  getProfile(restaurantId: string): Promise<RestaurantProfile>;
  getBusinessContext(restaurantId: string): Promise<RestaurantBusinessContextSnapshot>;
  updateProfile(
    restaurantId: string,
    profile: Partial<RestaurantProfile>,
  ): Promise<RestaurantProfile>;
  updateBusinessContext(
    restaurantId: string,
    payload: UpdateRestaurantBusinessContextInput,
  ): Promise<RestaurantBusinessContextSnapshot>;
  syncProfileWithGoogleBusinessProfile(
    restaurantId: string,
    payload: GoogleBusinessProfileProfileSyncPayload,
  ): Promise<RestaurantProfile>;
  getOperatingHours(restaurantId: string): Promise<OperatingHoursSnapshot>;
  updateOperatingHours(
    restaurantId: string,
    snapshot: OperatingHoursSnapshot,
  ): Promise<OperatingHoursSnapshot>;
  syncOperatingHoursWithGoogleBusinessProfile(
    restaurantId: string,
    payload: GoogleBusinessProfileOperatingHoursSyncPayload,
  ): Promise<OperatingHoursSnapshot>;
  getServicePeriods(restaurantId: string): Promise<ServicePeriodRow[]>;
  updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]): Promise<ServicePeriodRow[]>;
  syncServicePeriodsWithGoogleBusinessProfile(
    restaurantId: string,
    payload: GoogleBusinessProfileServicePeriodsSyncPayload,
  ): Promise<ServicePeriodRow[]>;
  getTurnBands(restaurantId: string): Promise<TurnBandsSnapshot>;
  updateTurnBands(restaurantId: string, payload: TurnBandsPayload): Promise<TurnBandsSnapshot>;
  getEmailTemplates(restaurantId: string): Promise<RestaurantEmailTemplatesSnapshot>;
  updateEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: { variants: RestaurantEmailTemplateVariant[] },
  ): Promise<RestaurantEmailTemplate>;
  resetEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
  ): Promise<RestaurantEmailTemplate>;
  previewEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload?: PreviewEmailTemplateInput,
  ): Promise<RestaurantEmailTemplatePreview>;
  sendTestEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: SendTestEmailTemplateInput,
  ): Promise<SendTestEmailTemplateResponse>;
  getGoogleBusinessProfileConnection(
    restaurantId: string,
  ): Promise<GoogleBusinessProfileConnection>;
  getGoogleBusinessProfileAvailableLocations(
    restaurantId: string,
  ): Promise<GoogleBusinessProfileAvailableLocation[]>;
  startGoogleBusinessProfileAuthorization(
    restaurantId: string,
  ): Promise<GoogleBusinessProfileAuthorizationStart>;
  getGoogleBusinessProfileWorkflow(restaurantId: string): Promise<GoogleBusinessProfileWorkflow>;
  createGoogleBusinessProfileDraft(restaurantId: string): Promise<GoogleBusinessProfileWorkflow>;
  updateGoogleBusinessProfileDraft(
    restaurantId: string,
    draftId: string,
    payload: GoogleBusinessProfileDraftPatchPayload,
  ): Promise<GoogleBusinessProfileWorkflow>;
  preflightGoogleBusinessProfileDraftPublish(
    restaurantId: string,
    draftId: string,
    payload: GoogleBusinessProfileDraftPublishPreflightPayload,
  ): Promise<GoogleBusinessProfileDraftPublishPreflight>;
  publishGoogleBusinessProfileDraft(
    restaurantId: string,
    draftId: string,
    payload: GoogleBusinessProfileDraftPublishPayload,
  ): Promise<GoogleBusinessProfileWorkflow>;
  retryGoogleBusinessProfileDraftGooglePush(
    restaurantId: string,
    draftId: string,
    publishJobId: string,
    payload: GoogleBusinessProfileProtectedActionPayload,
  ): Promise<GoogleBusinessProfileWorkflow>;
  linkGoogleBusinessProfileLocation(
    restaurantId: string,
    payload: LinkGoogleBusinessProfileLocationInput,
  ): Promise<GoogleBusinessProfileConnection>;
  syncGoogleBusinessProfileBusinessInfo(
    restaurantId: string,
    payload: GoogleBusinessProfileProtectedActionPayload,
  ): Promise<GoogleBusinessProfileConnection>;
  disconnectGoogleBusinessProfileConnection(
    restaurantId: string,
    payload: GoogleBusinessProfileProtectedActionPayload,
  ): Promise<GoogleBusinessProfileConnection>;
}

export class NotImplementedRestaurantService implements RestaurantService {
  private error(message: string): never {
    throw new Error(`[ops][restaurantService] ${message}`);
  }

  listRestaurants(): Promise<Array<OpsRestaurantOption & { role: RestaurantRole }>> {
    this.error('listRestaurants not implemented');
  }

  getProfile(): Promise<RestaurantProfile> {
    this.error('getProfile not implemented');
  }

  getBusinessContext(): Promise<RestaurantBusinessContextSnapshot> {
    this.error('getBusinessContext not implemented');
  }

  updateProfile(): Promise<RestaurantProfile> {
    this.error('updateProfile not implemented');
  }

  updateBusinessContext(): Promise<RestaurantBusinessContextSnapshot> {
    this.error('updateBusinessContext not implemented');
  }

  syncProfileWithGoogleBusinessProfile(
    _restaurantId: string,
    _payload: GoogleBusinessProfileProfileSyncPayload,
  ): Promise<RestaurantProfile> {
    this.error('syncProfileWithGoogleBusinessProfile not implemented');
  }

  getOperatingHours(): Promise<OperatingHoursSnapshot> {
    this.error('getOperatingHours not implemented');
  }

  updateOperatingHours(): Promise<OperatingHoursSnapshot> {
    this.error('updateOperatingHours not implemented');
  }

  syncOperatingHoursWithGoogleBusinessProfile(
    _restaurantId: string,
    _payload: GoogleBusinessProfileOperatingHoursSyncPayload,
  ): Promise<OperatingHoursSnapshot> {
    this.error('syncOperatingHoursWithGoogleBusinessProfile not implemented');
  }

  getServicePeriods(): Promise<ServicePeriodRow[]> {
    this.error('getServicePeriods not implemented');
  }

  updateServicePeriods(): Promise<ServicePeriodRow[]> {
    this.error('updateServicePeriods not implemented');
  }

  syncServicePeriodsWithGoogleBusinessProfile(
    _restaurantId: string,
    _payload: GoogleBusinessProfileServicePeriodsSyncPayload,
  ): Promise<ServicePeriodRow[]> {
    this.error('syncServicePeriodsWithGoogleBusinessProfile not implemented');
  }

  getTurnBands(): Promise<TurnBandsSnapshot> {
    this.error('getTurnBands not implemented');
  }

  updateTurnBands(): Promise<TurnBandsSnapshot> {
    this.error('updateTurnBands not implemented');
  }

  getEmailTemplates(): Promise<RestaurantEmailTemplatesSnapshot> {
    this.error('getEmailTemplates not implemented');
  }

  updateEmailTemplate(): Promise<RestaurantEmailTemplate> {
    this.error('updateEmailTemplate not implemented');
  }

  resetEmailTemplate(): Promise<RestaurantEmailTemplate> {
    this.error('resetEmailTemplate not implemented');
  }

  previewEmailTemplate(): Promise<RestaurantEmailTemplatePreview> {
    this.error('previewEmailTemplate not implemented');
  }

  sendTestEmailTemplate(): Promise<SendTestEmailTemplateResponse> {
    this.error('sendTestEmailTemplate not implemented');
  }

  getGoogleBusinessProfileConnection(): Promise<GoogleBusinessProfileConnection> {
    this.error('getGoogleBusinessProfileConnection not implemented');
  }

  getGoogleBusinessProfileAvailableLocations(): Promise<GoogleBusinessProfileAvailableLocation[]> {
    this.error('getGoogleBusinessProfileAvailableLocations not implemented');
  }

  startGoogleBusinessProfileAuthorization(): Promise<GoogleBusinessProfileAuthorizationStart> {
    this.error('startGoogleBusinessProfileAuthorization not implemented');
  }

  getGoogleBusinessProfileWorkflow(): Promise<GoogleBusinessProfileWorkflow> {
    this.error('getGoogleBusinessProfileWorkflow not implemented');
  }

  createGoogleBusinessProfileDraft(): Promise<GoogleBusinessProfileWorkflow> {
    this.error('createGoogleBusinessProfileDraft not implemented');
  }

  updateGoogleBusinessProfileDraft(): Promise<GoogleBusinessProfileWorkflow> {
    this.error('updateGoogleBusinessProfileDraft not implemented');
  }

  preflightGoogleBusinessProfileDraftPublish(): Promise<GoogleBusinessProfileDraftPublishPreflight> {
    this.error('preflightGoogleBusinessProfileDraftPublish not implemented');
  }

  publishGoogleBusinessProfileDraft(): Promise<GoogleBusinessProfileWorkflow> {
    this.error('publishGoogleBusinessProfileDraft not implemented');
  }

  retryGoogleBusinessProfileDraftGooglePush(): Promise<GoogleBusinessProfileWorkflow> {
    this.error('retryGoogleBusinessProfileDraftGooglePush not implemented');
  }

  linkGoogleBusinessProfileLocation(): Promise<GoogleBusinessProfileConnection> {
    this.error('linkGoogleBusinessProfileLocation not implemented');
  }

  syncGoogleBusinessProfileBusinessInfo(
    _restaurantId: string,
    _payload: GoogleBusinessProfileProtectedActionPayload,
  ): Promise<GoogleBusinessProfileConnection> {
    this.error('syncGoogleBusinessProfileBusinessInfo not implemented');
  }

  disconnectGoogleBusinessProfileConnection(): Promise<GoogleBusinessProfileConnection> {
    this.error('disconnectGoogleBusinessProfileConnection not implemented');
  }
}

export type RestaurantServiceFactory = () => RestaurantService;

export function createRestaurantService(factory?: RestaurantServiceFactory): RestaurantService {
  try {
    return factory ? factory() : createBrowserRestaurantService();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[ops][restaurantService] failed to instantiate', error.message);
    }
    return new NotImplementedRestaurantService();
  }
}

export type RestaurantServiceError = OpsServiceError | Error;

function mapRestaurant(dto: RestaurantResponse['restaurant']): RestaurantProfile {
  return {
    id: dto.id,
    name: dto.name ?? 'Restaurant',
    slug: dto.slug ?? null,
    isActive: dto.isActive ?? true,
    timezone: dto.timezone ?? 'UTC',
    capacity: dto.capacity ?? null,
    contactEmail: dto.contactEmail ?? null,
    contactPhone: dto.contactPhone ?? null,
    address: dto.address ?? null,
    businessDescription: dto.businessDescription ?? null,
    managerDailySummaryEnabled: dto.managerDailySummaryEnabled ?? false,
    managerWhatsappEnabled: dto.managerWhatsappEnabled ?? false,
    managerName: dto.managerName ?? null,
    managerNotificationPhone: dto.managerNotificationPhone ?? null,
    googleMapUrl: dto.googleMapUrl ?? null,
    googleReviewUrl: dto.googleReviewUrl ?? null,
    bookingPolicy: dto.bookingPolicy ?? null,
    logoUrl: dto.logoUrl ?? null,
    emailSendReminder24h: dto.emailSendReminder24h ?? true,
    emailSendReminderShort: dto.emailSendReminderShort ?? true,
    emailSendReviewRequest: dto.emailSendReviewRequest ?? true,
    reservationIntervalMinutes:
      dto.reservationIntervalMinutes ?? DEFAULT_RESERVATION_INTERVAL_MINUTES,
    reservationDefaultDurationMinutes: dto.reservationDefaultDurationMinutes ?? 90,
    reservationLastSeatingBufferMinutes: dto.reservationLastSeatingBufferMinutes ?? 15,
    reservationLifecycleGraceMinutes:
      dto.reservationLifecycleGraceMinutes ?? DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
    sundayRoastEnabled: dto.sundayRoastEnabled ?? false,
    updatedAt: dto.updatedAt ?? null,
  };
}

export function createBrowserRestaurantService(): RestaurantService {
  return {
    async listRestaurants() {
      const response = await fetchJson<RestaurantsListResponse>(
        `${OPS_RESTAURANTS_BASE}?page=1&pageSize=50`,
      );
      return response.items.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name ?? 'Restaurant',
        slug: restaurant.slug ?? null,
        isActive: restaurant.isActive ?? true,
        timezone: restaurant.timezone ?? 'UTC',
        address: restaurant.address ?? null,
        role: restaurant.role,
      }));
    },

    async getProfile(restaurantId: string) {
      const { restaurant } = await fetchJson<RestaurantResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}`,
      );
      return mapRestaurant(restaurant);
    },

    async getBusinessContext(restaurantId: string) {
      return fetchJson<RestaurantBusinessContextSnapshot>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/business-context`,
      );
    },

    async updateProfile(restaurantId: string, profile: Partial<RestaurantProfile>) {
      const { restaurant } = await fetchJson<RestaurantResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        },
      );
      return mapRestaurant(restaurant);
    },

    async updateBusinessContext(
      restaurantId: string,
      payload: UpdateRestaurantBusinessContextInput,
    ) {
      return fetchJson<RestaurantBusinessContextSnapshot>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/business-context`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },

    async syncProfileWithGoogleBusinessProfile(
      restaurantId: string,
      payload: GoogleBusinessProfileProfileSyncPayload,
    ) {
      await fetchJson<Record<string, unknown>>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const { restaurant } = await fetchJson<RestaurantResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}`,
      );
      return mapRestaurant(restaurant);
    },

    async getOperatingHours(restaurantId: string) {
      return fetchJson<OperatingHoursSnapshot>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/hours`);
    },

    async updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot) {
      return fetchJson<OperatingHoursSnapshot>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
    },

    async syncOperatingHoursWithGoogleBusinessProfile(
      restaurantId: string,
      payload: GoogleBusinessProfileOperatingHoursSyncPayload,
    ) {
      return fetchJson<OperatingHoursSnapshot>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async getServicePeriods(restaurantId: string) {
      const response = await fetchJson<ServicePeriodsResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/service-periods`,
      );
      return response.periods;
    },

    async syncServicePeriodsWithGoogleBusinessProfile(
      restaurantId: string,
      payload: GoogleBusinessProfileServicePeriodsSyncPayload,
    ) {
      const response = await fetchJson<ServicePeriodsResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/service-periods`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      return response.periods;
    },

    async updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]) {
      const response = await fetchJson<ServicePeriodsResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/service-periods`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rows),
        },
      );
      return response.periods;
    },

    async getTurnBands(restaurantId: string) {
      return fetchJson<TurnBandsResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/turn-bands`);
    },

    async updateTurnBands(restaurantId: string, payload: TurnBandsPayload) {
      return fetchJson<TurnBandsResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/turn-bands`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async getEmailTemplates(restaurantId: string) {
      return fetchJson<EmailTemplatesResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates`,
      );
    },

    async updateEmailTemplate(
      restaurantId: string,
      templateKey: RestaurantBookingEmailTemplateKey,
      payload: { variants: RestaurantEmailTemplateVariant[] },
    ) {
      const response = await fetchJson<EmailTemplateResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates/${templateKey}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      return response.template;
    },

    async resetEmailTemplate(restaurantId: string, templateKey: RestaurantBookingEmailTemplateKey) {
      const response = await fetchJson<EmailTemplateResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates/${templateKey}`,
        {
          method: 'DELETE',
        },
      );
      return response.template;
    },

    async previewEmailTemplate(
      restaurantId: string,
      templateKey: RestaurantBookingEmailTemplateKey,
      payload: PreviewEmailTemplateInput = {},
    ) {
      const response = await fetchJson<EmailTemplatePreviewResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates/${templateKey}/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      return response.preview;
    },

    async sendTestEmailTemplate(
      restaurantId: string,
      templateKey: RestaurantBookingEmailTemplateKey,
      payload: SendTestEmailTemplateInput,
    ) {
      return fetchJson<SendTestEmailTemplateResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates/${templateKey}/test-send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },

    async getGoogleBusinessProfileConnection(restaurantId: string) {
      return fetchJson<GoogleBusinessProfileConnection>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile`,
      );
    },

    async getGoogleBusinessProfileAvailableLocations(restaurantId: string) {
      const response = await fetchJson<{ locations: GoogleBusinessProfileAvailableLocation[] }>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business/locations`,
      );
      return response.locations;
    },

    async startGoogleBusinessProfileAuthorization(restaurantId: string) {
      return fetchJson<GoogleBusinessProfileAuthorizationStart>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/connect`,
        {
          method: 'POST',
        },
      );
    },

    async getGoogleBusinessProfileWorkflow(restaurantId: string) {
      return fetchJson<GoogleBusinessProfileWorkflow>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/workflow`,
      );
    },

    async createGoogleBusinessProfileDraft(restaurantId: string) {
      return fetchJson<GoogleBusinessProfileWorkflow>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/drafts`,
        {
          method: 'POST',
        },
      );
    },

    async updateGoogleBusinessProfileDraft(
      restaurantId: string,
      draftId: string,
      payload: GoogleBusinessProfileDraftPatchPayload,
    ) {
      return fetchJson<GoogleBusinessProfileWorkflow>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/drafts/${draftId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },

    async preflightGoogleBusinessProfileDraftPublish(
      restaurantId: string,
      draftId: string,
      payload: GoogleBusinessProfileDraftPublishPreflightPayload,
    ) {
      return fetchJson<GoogleBusinessProfileDraftPublishPreflight>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/drafts/${draftId}/publish/preflight`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },

    async publishGoogleBusinessProfileDraft(
      restaurantId: string,
      draftId: string,
      payload: GoogleBusinessProfileDraftPublishPayload,
    ) {
      return fetchJson<GoogleBusinessProfileWorkflow>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/drafts/${draftId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },

    async retryGoogleBusinessProfileDraftGooglePush(
      restaurantId: string,
      draftId: string,
      publishJobId: string,
      payload: GoogleBusinessProfileProtectedActionPayload,
    ) {
      return fetchJson<GoogleBusinessProfileWorkflow>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/drafts/${draftId}/publish-jobs/${publishJobId}/retry-google-push`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },

    async linkGoogleBusinessProfileLocation(
      restaurantId: string,
      payload: LinkGoogleBusinessProfileLocationInput,
    ) {
      return fetchJson<GoogleBusinessProfileConnection>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },

    async disconnectGoogleBusinessProfileConnection(
      restaurantId: string,
      payload: GoogleBusinessProfileProtectedActionPayload,
    ) {
      return fetchJson<GoogleBusinessProfileConnection>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },

    async syncGoogleBusinessProfileBusinessInfo(
      restaurantId: string,
      payload: GoogleBusinessProfileProtectedActionPayload,
    ) {
      return fetchJson<GoogleBusinessProfileConnection>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },
  } satisfies RestaurantService;
}
