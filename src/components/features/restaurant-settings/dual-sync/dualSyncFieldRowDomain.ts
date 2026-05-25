import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export interface DualSyncFieldActionAvailability {
  readonly isUnsupported: boolean;
  readonly canImport: boolean;
  readonly canExport: boolean;
}

export interface DualSyncFieldFreshnessDescriptor {
  readonly timestamp: string;
  readonly prefix: string;
  readonly neverLabel: string;
}

export interface DualSyncFieldRowModel {
  readonly actionAvailability: DualSyncFieldActionAvailability;
  readonly blockedReasons: readonly string[];
  readonly freshness: DualSyncFieldFreshnessDescriptor | null;
  readonly hasOpenCandidate: boolean;
  readonly helpText: string | null;
  readonly label: string;
  readonly policyLabels: readonly string[];
  readonly state: DualSyncFieldSummary['state'];
}

export function getDualSyncFieldPolicyLabels(field: DualSyncFieldSummary): string[] {
  const labels: string[] = [];
  switch (field.policy.authority) {
    case 'core_authoritative':
      labels.push('Core-owned');
      break;
    case 'google_authoritative':
      labels.push('Google-owned');
      break;
    case 'review_required':
      labels.push('Manual review');
      break;
    case 'import_only':
      labels.push('Import-only');
      break;
    case 'export_only':
      labels.push('Export-only');
      break;
    case 'read_only':
      labels.push('Read-only');
      break;
    case 'unsupported':
      labels.push('Unsupported by Google');
      break;
    case 'bidirectional_manual':
      break;
  }
  if (field.policy.requiresManualReview && !labels.includes('Manual review')) {
    labels.push('Manual review');
  }
  if (field.policy.riskLevel === 'high' || field.policy.riskLevel === 'critical') {
    labels.push('High-risk field');
  }
  return labels;
}

export function getDualSyncFieldActionAvailability(
  field: DualSyncFieldSummary,
): DualSyncFieldActionAvailability {
  const isUnsupported = field.conflictPolicy === 'unsupported';
  return {
    isUnsupported,
    canImport: field.capability.canImport && !isUnsupported,
    canExport: field.capability.canExport && !isUnsupported,
  };
}

export function getDualSyncFieldFreshnessDescriptor(
  field: DualSyncFieldSummary,
): DualSyncFieldFreshnessDescriptor | null {
  switch (field.state) {
    case 'in_sync':
      return field.lastInSyncAt
        ? {
            timestamp: field.lastInSyncAt,
            prefix: 'In sync',
            neverLabel: 'Never verified',
          }
        : null;
    case 'core_dirty':
    case 'gbp_dirty':
    case 'drifted':
      return buildChangeFreshness(field, 'Drifted');
    case 'conflict':
      return buildChangeFreshness(field, 'In conflict');
    case 'pending_import':
    case 'pending_export':
      return buildChangeFreshness(field, 'Pending');
    case 'import_failed':
    case 'export_failed':
      return buildChangeFreshness(field, 'Failed');
    case null:
    case 'ignored':
    case 'unsupported':
    default:
      return field.lastInSyncAt
        ? {
            timestamp: field.lastInSyncAt,
            prefix: 'Last sync',
            neverLabel: 'Never verified',
          }
        : null;
  }
}

export function buildDualSyncFieldRowModel(field: DualSyncFieldSummary): DualSyncFieldRowModel {
  return {
    actionAvailability: getDualSyncFieldActionAvailability(field),
    blockedReasons: field.capability.blockedReasons,
    freshness: getDualSyncFieldFreshnessDescriptor(field),
    hasOpenCandidate: Boolean(field.openCandidate),
    helpText: field.helpText,
    label: field.label,
    policyLabels: getDualSyncFieldPolicyLabels(field),
    state: field.state,
  };
}

function buildChangeFreshness(
  field: DualSyncFieldSummary,
  prefix: string,
): DualSyncFieldFreshnessDescriptor | null {
  const timestamp = field.lastCoreChangeAt ?? field.lastGbpChangeAt ?? field.lastInSyncAt;
  return timestamp ? { timestamp, prefix, neverLabel: 'No history' } : null;
}
