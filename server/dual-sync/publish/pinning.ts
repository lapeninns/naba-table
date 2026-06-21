import type { DualSyncOperationFailure, DualSyncPublishDecision } from './types';

type PinKey = 'pinnedCoreHash' | 'pinnedGbpHash';

function hasOwn(record: object, key: PinKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isPinnedHash(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function invalidPinFailure(key: PinKey): DualSyncOperationFailure {
  return {
    code: 'INVALID_DECISION',
    message: `Publish decision must include ${key} as a string or null.`,
    retryable: false,
  };
}

export function validatePublishDecisionPins(
  decision: DualSyncPublishDecision,
): DualSyncOperationFailure | null {
  const record = decision as unknown as Record<PinKey, unknown>;
  if (!hasOwn(record, 'pinnedCoreHash') || !isPinnedHash(record.pinnedCoreHash)) {
    return invalidPinFailure('pinnedCoreHash');
  }
  if (!hasOwn(record, 'pinnedGbpHash') || !isPinnedHash(record.pinnedGbpHash)) {
    return invalidPinFailure('pinnedGbpHash');
  }
  return null;
}
