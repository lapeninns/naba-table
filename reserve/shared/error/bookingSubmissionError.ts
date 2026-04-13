import { mapErrorToMessage } from './mapErrorToMessage';

import type { ApiError } from '@shared/api/client';

export type BookingAlternativeOption = {
  time: string;
  available: boolean;
  utilizationPercent: number | null;
};

export type BookingSubmissionUiError = {
  code: string | null;
  message: string;
  alternatives: BookingAlternativeOption[];
  retryable: boolean;
  retryAfter: number | null;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function parseAlternatives(value: unknown): BookingAlternativeOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const time = readString(entry.time);
    if (!time) {
      return [];
    }

    return [
      {
        time,
        available: readBoolean(entry.available) ?? true,
        utilizationPercent: readNumber(entry.utilizationPercent),
      },
    ];
  });
}

export function extractBookingSubmissionError(
  error: unknown,
  fallback = 'Unable to process booking',
): BookingSubmissionUiError {
  const apiError = isRecord(error) ? (error as ApiError & UnknownRecord) : null;
  const body = isRecord(apiError?.body) ? (apiError.body as UnknownRecord) : null;
  const details = isRecord(apiError?.details) ? (apiError.details as UnknownRecord) : null;

  const directAlternatives = parseAlternatives(apiError?.alternatives);
  const bodyAlternatives = parseAlternatives(body?.alternatives);
  const detailAlternatives = parseAlternatives(details?.alternatives);

  return {
    code:
      readString(apiError?.code) ??
      readString(apiError?.errorCode) ??
      readString(body?.code) ??
      readString(body?.errorCode),
    message: mapErrorToMessage(error, fallback),
    alternatives:
      directAlternatives.length > 0
        ? directAlternatives
        : bodyAlternatives.length > 0
          ? bodyAlternatives
          : detailAlternatives,
    retryable:
      readBoolean(apiError?.retryable) ??
      readBoolean(body?.retryable) ??
      readBoolean(details?.retryable) ??
      false,
    retryAfter:
      readNumber(apiError?.retryAfter) ??
      readNumber(body?.retryAfter) ??
      readNumber(details?.retryAfter),
  };
}
