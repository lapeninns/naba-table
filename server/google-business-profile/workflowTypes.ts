import { type CoreSyncDirection } from './core-sync';
import {
  type GoogleBusinessProfileFieldDecision as BaseGoogleBusinessProfileFieldDecision,
  type GoogleBusinessProfileFieldDecisionInput as BaseGoogleBusinessProfileFieldDecisionInput,
} from './workflowFieldDecisions';
import { type GoogleBusinessProfileGoogleUpdateMask } from './workflowGoogleUpdateMasks';
import {
  type GoogleBusinessProfilePublishDirectionIntent,
  type GoogleBusinessProfilePublishMode,
} from './workflowPublishDirection';
import { type GoogleBusinessProfilePublishPreflightNotice as BaseGoogleBusinessProfilePublishPreflightNotice } from './workflowPublishPreflight';
import { type GoogleBusinessProfileGoogleErrorClassification } from './workflowPushErrors';
import { type DraftRow, type PublishEventRow, type PublishJobRow } from './workflowRepository';

import type { Json } from '@/types/supabase';

export type GoogleBusinessProfileAuditFlow =
  | 'google_to_nabatable_apply'
  | 'nabatable_to_google_sync';

export type GoogleBusinessProfileDraftSectionKey =
  | 'profile'
  | 'operatingHours'
  | 'servicePeriods'
  | 'businessContext.categories'
  | 'businessContext.serviceAreas'
  | 'businessContext.attributes'
  | 'businessContext.serviceItems';

export type GoogleBusinessProfileFieldDecision =
  BaseGoogleBusinessProfileFieldDecision<GoogleBusinessProfileDraftSectionKey>;

export type GoogleBusinessProfileFieldDecisionInput =
  BaseGoogleBusinessProfileFieldDecisionInput<GoogleBusinessProfileDraftSectionKey>;

export type GoogleBusinessProfilePublishPreflightNotice =
  BaseGoogleBusinessProfilePublishPreflightNotice<GoogleBusinessProfileDraftSectionKey>;

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
