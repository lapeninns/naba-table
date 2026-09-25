import { getSafeSettingsErrorMessage } from '../shared/settingsErrorCopy';

import type { DualSyncPublishResponse, RunAutoExportResponse } from '@/services/ops/dual-sync';

export type DualSyncToastIntentKind = 'error' | 'info' | 'success' | 'warning';

export interface DualSyncToastIntent {
  readonly kind: DualSyncToastIntentKind;
  readonly message: string;
}

/** Fixed copy plus a safe reason code; raw error text can echo database or provider internals. */
export function getDualSyncErrorMessage(error: unknown, fallback: string): string {
  return getSafeSettingsErrorMessage(error, fallback);
}

export function getDualSyncErrorToastIntent(error: unknown, fallback: string): DualSyncToastIntent {
  return {
    kind: 'error',
    message: getDualSyncErrorMessage(error, fallback),
  };
}

export function getDualSyncPausedToastIntent(pauseReason: string): DualSyncToastIntent {
  return {
    kind: 'error',
    message: pauseReason,
  };
}

export function getDualSyncRefreshSuccessToastIntent(): DualSyncToastIntent {
  return {
    kind: 'success',
    message: 'Pulled the latest Google profile.',
  };
}

export function getDualSyncBlockedActionToastIntent(
  message: string | null,
): DualSyncToastIntent | null {
  if (!message) return null;
  return {
    kind: 'error',
    message,
  };
}

export function getDualSyncPublishPreviewEmptyToastIntent(): DualSyncToastIntent {
  return {
    kind: 'warning',
    message: 'No selected fields are eligible to publish.',
  };
}

export function getDualSyncAutoExportToastIntent(
  result: RunAutoExportResponse,
): DualSyncToastIntent {
  const summary = result.publishResult?.summary;
  const succeeded = summary?.succeededCount ?? 0;
  const failed = summary?.failedCount ?? 0;

  if (failed > 0) {
    return {
      kind: 'error',
      message: `${succeeded} queued exports synced, ${failed} failed. See per-field errors.`,
    };
  }
  if (succeeded > 0) {
    return {
      kind: 'success',
      message: `${succeeded} queued exports synced to Google.`,
    };
  }
  if (result.skipped.length > 0) {
    return {
      kind: 'warning',
      message: `Skipped ${result.skipped.length} candidates without a baseline. Refresh first.`,
    };
  }
  return {
    kind: 'info',
    message: 'No queued exports were ready to run.',
  };
}

export function getDualSyncPublishResultToastIntent(
  result: DualSyncPublishResponse,
): DualSyncToastIntent {
  if (result.failedCount > 0) {
    return {
      kind: 'error',
      message: `${result.succeededCount} fields synced, ${result.failedCount} failed. See per-field errors below.`,
    };
  }
  return {
    kind: 'success',
    message: `${result.succeededCount} fields synced.`,
  };
}

export function getDualSyncControlToastIntent(nextPaused: boolean): DualSyncToastIntent {
  return {
    kind: 'success',
    message: nextPaused
      ? 'Dual-sync is paused for this restaurant.'
      : 'Dual-sync is active for this restaurant.',
  };
}
