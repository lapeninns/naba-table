import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

import { ExactConsentUnsupportedPlanError } from './adapter';
import { ExactConsentError, ExactConsentExecutionError, type ExactConsentErrorCode } from './types';

export type ExactConsentPublicError = {
  readonly code: string;
  readonly message: string;
  readonly status: number;
};

function exactMessage(code: ExactConsentErrorCode): string {
  switch (code) {
    case 'GBP_PREVIEW_EXPIRED':
      return 'The exact write preview has expired.';
    case 'GBP_PREVIEW_MISMATCH':
      return 'The exact write preview no longer matches the current plan.';
    case 'GBP_ACKNOWLEDGEMENT_REQUIRED':
      return 'The exact write preview must be acknowledged.';
    case 'GBP_RISK_ACKNOWLEDGEMENT_REQUIRED':
      return 'All required write risks must be acknowledged.';
    case 'GBP_UNKNOWN_UPDATE_MASK':
      return 'Google returned an update path that cannot be written safely.';
    case 'GBP_UPDATE_MASK_CONFLICT':
      return 'Google changed an overlapping field before confirmation.';
    case 'GBP_ATTRIBUTES_COMPARISON_REQUIRED':
      return 'A fresh Google attribute comparison is required.';
    case 'GBP_QUEUE_STALE':
      return 'The queued write no longer matches the current plan.';
    case 'GBP_CONNECTION_INELIGIBLE':
      return 'The Google connection is not eligible for writes.';
    case 'GBP_SYNC_PAUSED':
      return 'Google synchronization is paused.';
    case 'GBP_RUNTIME_FLAG_DISABLED':
      return 'A required Google write safety flag is disabled.';
    case 'GBP_ROLLOUT_INELIGIBLE':
      return 'This restaurant is not eligible for Google writes.';
    case 'GBP_READINESS_UNPROVEN':
      return 'Google write readiness is not proven.';
  }
}

export function exactConsentPublicError(
  failure: unknown,
  phase: 'preview' | 'publish',
): ExactConsentPublicError {
  if (failure instanceof ExactConsentError) {
    return { code: failure.code, message: exactMessage(failure.code), status: failure.status };
  }
  if (failure instanceof ExactConsentExecutionError) {
    return { code: failure.code, message: failure.message, status: failure.status };
  }
  if (failure instanceof ExactConsentUnsupportedPlanError) {
    return {
      code: failure.code,
      message: 'This field group is not available for exact Google writes.',
      status: failure.status,
    };
  }
  if (failure instanceof GoogleBusinessProfileError) {
    if (failure.code === 'GBP_REAUTH_REQUIRED' || failure.kind === 'reauth') {
      return {
        code: 'GBP_REAUTH_REQUIRED',
        message: 'Reconnect Google Business Profile before continuing.',
        status: 409,
      };
    }
    if (failure.kind === 'access_lost') {
      return {
        code: 'GBP_ACCESS_LOST',
        message: 'Google Business Profile access is no longer available.',
        status: 409,
      };
    }
    if (failure.code === 'GBP_WRITE_PERMIT_REPLAYED') {
      return {
        code: 'GBP_GRANT_REPLAYED',
        message: 'This Google write approval has already been used.',
        status: 409,
      };
    }
    if (failure.code.includes('PERMIT')) {
      return {
        code: 'GBP_GRANT_INVALID',
        message: 'The Google write approval is invalid or stale.',
        status: 409,
      };
    }
    return {
      code: phase === 'preview' ? 'GBP_PROVIDER_READ_FAILED' : 'GBP_PROVIDER_REJECTED',
      message:
        phase === 'preview'
          ? 'Google listing state could not be refreshed for preview.'
          : 'Google rejected the listing write.',
      status: 502,
    };
  }
  return {
    code: phase === 'preview' ? 'GBP_PREVIEW_FAILED' : 'GBP_PUBLISH_FAILED',
    message:
      phase === 'preview'
        ? 'The exact Google write preview could not be built.'
        : 'The exact Google write could not be completed.',
    status: 500,
  };
}
