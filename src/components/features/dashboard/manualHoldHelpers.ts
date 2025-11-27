import { HttpError } from '@/lib/http/errors';

import type { ManualValidationResult } from '@/services/ops/bookings';

export function isManualHoldValidationError(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 409 && error.code === 'VALIDATION_FAILED';
}

export function extractManualHoldValidation(error: unknown): ManualValidationResult | null {
  if (!isManualHoldValidationError(error)) {
    return null;
  }
  const details = error.details;
  if (!details || typeof details !== 'object') {
    return null;
  }
  const record = details as Record<string, unknown>;
  const validation = record.validation;
  if (validation && typeof validation === 'object') {
    return validation as ManualValidationResult;
  }
  return null;
}
