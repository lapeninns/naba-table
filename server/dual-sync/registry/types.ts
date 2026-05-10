/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Field registry types. Each `DualSyncFieldConfig` is the single source of
 * truth for one syncable field across both directions:
 *  - import: GBP -> Core
 *  - export: Core -> GBP
 *
 * Normalisation vs canonicalisation:
 *  - `normalize*` returns a structurally faithful value that can be shown
 *    to the operator and round-tripped through writers.
 *  - `canonicalize*` returns a value optimised for equality / hashing
 *    (case-folded, whitespace-collapsed, identifier-stable for URLs, etc.).
 *    Hashes used for state computation are taken over canonical values.
 */

import type {
  DualSyncDecisionAction,
  DualSyncGoogleUpdateMask,
  DualSyncSectionKey,
} from '../types';

export type DualSyncConflictPolicy = 'manual' | 'core_wins' | 'gbp_wins' | 'unsupported';

export type DualSyncDeletePolicy = 'manual' | 'clear_remote' | 'clear_core' | 'ignore';

export type DualSyncAuthority =
  | 'core_authoritative'
  | 'google_authoritative'
  | 'bidirectional_manual'
  | 'review_required'
  | 'import_only'
  | 'export_only'
  | 'read_only'
  | 'unsupported';

export type DualSyncRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type DualSyncGoogleWriteGroup =
  | 'location.profile'
  | 'location.regularHours'
  | 'location.specialHours'
  | 'location.moreHours'
  | 'location.categories'
  | 'location.serviceArea'
  | 'location.attributes'
  | 'location.services'
  | 'location.foodMenus';

export type DualSyncSemanticComparator =
  | 'text'
  | 'phone'
  | 'url'
  | 'hours'
  | 'list'
  | 'category'
  | 'service_area'
  | 'attribute'
  | 'service_item'
  | 'service_period'
  | 'food_menu_item'
  | 'passthrough';

export type DualSyncCanonicalizerName =
  | 'canonicalizeText'
  | 'canonicalizePhone'
  | 'canonicalizeUrl'
  | 'canonicalizeHours'
  | 'canonicalizeStringArray'
  | 'canonicalizeCategory'
  | 'canonicalizeServiceArea'
  | 'canonicalizeAttribute'
  | 'canonicalizeServiceItem'
  | 'canonicalizeServicePeriod'
  | 'canonicalizeFoodMenuItem'
  | 'passthrough';

export interface DualSyncFieldPolicy {
  readonly fieldKey: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly authority: DualSyncAuthority;
  readonly riskLevel: DualSyncRiskLevel;
  readonly importable: boolean;
  readonly exportable: boolean;
  readonly requiresManualReview: boolean;
  readonly googleWriteGroup?: DualSyncGoogleWriteGroup;
  readonly noWriteReason?: string;
  readonly semanticComparator: DualSyncSemanticComparator;
  readonly canonicalizer: DualSyncCanonicalizerName;
  readonly destructiveWritePossible: boolean;
}

export type DualSyncFieldPolicyConfig = Omit<
  DualSyncFieldPolicy,
  'fieldKey' | 'sectionKey' | 'importable' | 'exportable'
>;

export type DualSyncFieldKind =
  | 'profile'
  | 'operatingHours.weekly'
  | 'servicePeriod'
  | 'businessContext.category'
  | 'businessContext.serviceArea'
  | 'businessContext.attribute'
  | 'businessContext.serviceItem'
  | 'foodMenu.item'
  | 'core_only';

export interface DualSyncFieldConfig<TCore = unknown, TGbp = unknown> {
  /** Stable globally-unique identifier across all sections. */
  readonly fieldKey: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly kind: DualSyncFieldKind;

  /** Display label for ops UI rows. */
  readonly label: string;
  /** Optional helper text for ops UI rows. */
  readonly helpText?: string;

  /** Dotted path into the Core canonical snapshot. */
  readonly corePath: string;
  /** Dotted path into the Google canonical snapshot. */
  readonly gbpPath: string;

  readonly importable: boolean;
  readonly exportable: boolean;

  readonly normalizeCoreValue: (value: unknown) => TCore;
  readonly normalizeGbpValue: (value: unknown) => TGbp;
  readonly canonicalizeCoreValue: (value: unknown) => unknown;
  readonly canonicalizeGbpValue: (value: unknown) => unknown;

  readonly policy: DualSyncFieldPolicy;

  readonly conflictPolicy: DualSyncConflictPolicy;
  readonly deletePolicy: DualSyncDeletePolicy;

  readonly googleUpdateMask?: DualSyncGoogleUpdateMask;
  readonly requiresGoogleCapability?: string;
  readonly exportRequiresCoreValue?: boolean;
  readonly exportBlockedReason?: string;

  readonly sortOrder: number;
}

/**
 * Capability flags for one diff item. Resolved per-restaurant from the
 * registry config plus the live Core and Google values.
 */
export interface DualSyncFieldCapability {
  readonly canImport: boolean;
  readonly canExport: boolean;
  readonly canIgnore: boolean;
  readonly googleUpdateMask?: DualSyncGoogleUpdateMask;
  readonly blockedReasons: ReadonlyArray<string>;
}

export interface ResolveCapabilityInput {
  readonly config: DualSyncFieldConfig;
  readonly coreValue: unknown;
  readonly gbpValue: unknown;
}

export type DualSyncDecisionLegality = {
  readonly action: DualSyncDecisionAction;
  readonly legal: boolean;
  readonly reason?: string;
};
