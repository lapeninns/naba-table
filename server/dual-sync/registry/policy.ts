/**
 * Production policy defaults for dual-sync registry fields.
 *
 * The registry already owns each field's import/export capability,
 * canonicalizers, Google mask, and blocked-write copy. This helper turns
 * those implicit rules into an explicit policy contract that planners,
 * APIs, and UI can consume without duplicating section-specific logic.
 */

import type {
  DualSyncAuthority,
  DualSyncFieldConfig,
  DualSyncFieldPolicy,
  DualSyncGoogleWriteGroup,
  DualSyncCanonicalizerName,
  DualSyncRiskLevel,
  DualSyncSemanticComparator,
} from './types';
import type { DualSyncGoogleUpdateMask } from '../types';

export type DualSyncFieldConfigInput<TCore = unknown, TGbp = unknown> = Omit<
  DualSyncFieldConfig<TCore, TGbp>,
  'policy'
> & {
  readonly policy?: Partial<
    Omit<DualSyncFieldPolicy, 'fieldKey' | 'sectionKey' | 'importable' | 'exportable'>
  >;
};

function authorityForConfig(config: DualSyncFieldConfigInput): DualSyncAuthority {
  if (config.conflictPolicy === 'unsupported') return 'unsupported';
  if (config.importable && config.exportable) return 'bidirectional_manual';
  if (config.importable && !config.exportable) {
    if (config.conflictPolicy === 'gbp_wins') return 'google_authoritative';
    return 'import_only';
  }
  if (!config.importable && config.exportable) {
    if (config.conflictPolicy === 'core_wins') return 'core_authoritative';
    return 'export_only';
  }
  return 'read_only';
}

function riskLevelForConfig(config: DualSyncFieldConfigInput): DualSyncRiskLevel {
  if (config.sectionKey === 'core_only' || !config.exportable) return 'low';
  if (config.fieldKey === 'profile.name' || config.fieldKey === 'profile.address') {
    return 'critical';
  }
  switch (config.sectionKey) {
    case 'foodMenus':
    case 'operatingHours':
    case 'servicePeriods':
    case 'businessContext.attributes':
      return 'high';
    case 'businessContext.categories':
      return 'critical';
    case 'businessContext.serviceAreas':
    case 'businessContext.serviceItems':
    case 'profile':
      return 'medium';
    default:
      return 'medium';
  }
}

function writeGroupForMask(
  mask: DualSyncGoogleUpdateMask | undefined,
): DualSyncGoogleWriteGroup | undefined {
  switch (mask) {
    case 'title':
    case 'profile':
    case 'phoneNumbers':
    case 'storefrontAddress':
      return 'location.profile';
    case 'regularHours':
      return 'location.regularHours';
    case 'specialHours':
      return 'location.specialHours';
    case 'moreHours':
      return 'location.moreHours';
    case 'categories':
      return 'location.categories';
    case 'serviceArea':
      return 'location.serviceArea';
    case 'attributes':
      return 'location.attributes';
    case 'serviceItems':
      return 'location.services';
    case 'menus':
      return 'location.foodMenus';
    default:
      return undefined;
  }
}

function comparatorForConfig(config: DualSyncFieldConfigInput): DualSyncSemanticComparator {
  switch (config.kind) {
    case 'profile':
      if (config.fieldKey.toLowerCase().includes('phone')) return 'phone';
      if (config.fieldKey.toLowerCase().includes('url')) return 'url';
      return 'text';
    case 'operatingHours.weekly':
      return 'hours';
    case 'servicePeriod':
      return 'service_period';
    case 'businessContext.category':
      return 'category';
    case 'businessContext.serviceArea':
      return 'service_area';
    case 'businessContext.attribute':
      return 'attribute';
    case 'businessContext.serviceItem':
      return 'service_item';
    case 'foodMenu.item':
      return 'food_menu_item';
    case 'core_only':
      return 'passthrough';
    default:
      return 'passthrough';
  }
}

function canonicalizerForConfig(config: DualSyncFieldConfigInput): DualSyncCanonicalizerName {
  switch (config.kind) {
    case 'profile':
      if (config.fieldKey.toLowerCase().includes('phone')) return 'canonicalizePhone';
      if (config.fieldKey.toLowerCase().includes('url')) return 'canonicalizeUrl';
      return 'canonicalizeText';
    case 'operatingHours.weekly':
      return 'canonicalizeHours';
    case 'servicePeriod':
      return 'canonicalizeServicePeriod';
    case 'businessContext.category':
      return 'canonicalizeCategory';
    case 'businessContext.serviceArea':
      return 'canonicalizeServiceArea';
    case 'businessContext.attribute':
      return 'canonicalizeAttribute';
    case 'businessContext.serviceItem':
      return 'canonicalizeServiceItem';
    case 'foodMenu.item':
      return 'canonicalizeFoodMenuItem';
    case 'core_only':
      return 'passthrough';
    default:
      return 'passthrough';
  }
}

function destructiveWritePossible(config: DualSyncFieldConfigInput): boolean {
  if (!config.exportable) return false;
  if (config.googleUpdateMask === 'menus') return true;
  if (
    config.googleUpdateMask === 'regularHours' ||
    config.googleUpdateMask === 'moreHours' ||
    config.googleUpdateMask === 'categories' ||
    config.googleUpdateMask === 'serviceArea' ||
    config.googleUpdateMask === 'attributes' ||
    config.googleUpdateMask === 'serviceItems'
  ) {
    return true;
  }
  return config.deletePolicy === 'manual' || config.deletePolicy === 'clear_remote';
}

export function buildFieldPolicy(config: DualSyncFieldConfigInput): DualSyncFieldPolicy {
  const googleWriteGroup = writeGroupForMask(config.googleUpdateMask);
  const riskLevel = riskLevelForConfig(config);
  const override = config.policy;
  return {
    fieldKey: config.fieldKey,
    sectionKey: config.sectionKey,
    authority: override?.authority ?? authorityForConfig(config),
    riskLevel: override?.riskLevel ?? riskLevel,
    importable: config.importable,
    exportable: config.exportable,
    requiresManualReview:
      override?.requiresManualReview ??
      (config.exportable && (riskLevel === 'high' || riskLevel === 'critical')),
    ...((override?.googleWriteGroup ?? googleWriteGroup)
      ? { googleWriteGroup: override?.googleWriteGroup ?? googleWriteGroup }
      : {}),
    ...(!config.exportable
      ? {
          noWriteReason:
            override?.noWriteReason ??
            config.exportBlockedReason ??
            'This field cannot be exported to Google.',
        }
      : override?.noWriteReason
        ? { noWriteReason: override.noWriteReason }
        : {}),
    semanticComparator: override?.semanticComparator ?? comparatorForConfig(config),
    canonicalizer: override?.canonicalizer ?? canonicalizerForConfig(config),
    destructiveWritePossible:
      override?.destructiveWritePossible ?? destructiveWritePossible(config),
  };
}

export function withFieldPolicy<TCore = unknown, TGbp = unknown>(
  config: DualSyncFieldConfigInput<TCore, TGbp>,
): DualSyncFieldConfig<TCore, TGbp> {
  return {
    ...config,
    policy: buildFieldPolicy(config),
  };
}
