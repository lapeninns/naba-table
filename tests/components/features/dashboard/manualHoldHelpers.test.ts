import { describe, expect, it } from 'vitest';

import { extractManualHoldValidation, isManualHoldValidationError } from '@/components/features/dashboard/manualHoldHelpers';
import { HttpError } from '@/lib/http/errors';

import type { ManualValidationResult } from '@/services/ops/bookings';

const sampleValidation: ManualValidationResult = {
  ok: false,
  summary: {
    tableCount: 1,
    totalCapacity: 4,
    slack: -1,
    zoneId: 'zone-1',
    tableNumbers: ['T1'],
    partySize: 5,
  },
  checks: [
    {
      id: 'capacity',
      status: 'error',
      message: 'Selected tables do not meet the requested party size',
    },
  ],
};

describe('manualHoldHelpers', () => {
  it('detects manual hold validation errors with structured details', () => {
    const error = new HttpError({
      message: 'Validation failed',
      status: 409,
      code: 'VALIDATION_FAILED',
      details: { validation: sampleValidation },
    });

    expect(isManualHoldValidationError(error)).toBe(true);
    expect(extractManualHoldValidation(error)).toEqual(sampleValidation);
  });

  it('treats validation errors without details as manual hold errors but returns null validation', () => {
    const error = new HttpError({
      message: 'Validation failed',
      status: 409,
      code: 'VALIDATION_FAILED',
    });

    expect(isManualHoldValidationError(error)).toBe(true);
    expect(extractManualHoldValidation(error)).toBeNull();
  });

  it('ignores non-validation errors', () => {
    const error = new HttpError({
      message: 'Conflict',
      status: 409,
      code: 'HOLD_CONFLICT',
    });

    expect(isManualHoldValidationError(error)).toBe(false);
    expect(extractManualHoldValidation(error)).toBeNull();
  });
});
