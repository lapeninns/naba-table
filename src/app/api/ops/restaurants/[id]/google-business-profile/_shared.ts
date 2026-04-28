import { NextResponse } from 'next/server';

const PUBLIC_WORKFLOW_ERROR_NAMES = new Set([
  'GBP_DRAFT_INVALID_STATE',
  'GBP_DRAFT_NO_SELECTION',
  'GBP_DRAFT_NOT_APPROVED',
  'GBP_DRAFT_STALE',
  'GBP_DIRECTION_CONFLICT',
  'GBP_GOOGLE_PUSH_DISABLED',
  'GBP_GOOGLE_PUSH_FAILED',
  'GBP_PUBLISH_JOB_CORE_CHANGED',
  'GBP_PUBLISH_JOB_INVALID_STATE',
  'GBP_PUBLISH_JOB_MISMATCH',
  'GBP_PUBLISH_JOB_NOT_FOUND',
]);

function errorName(error: unknown): string | null {
  return error instanceof Error && error.name ? error.name : null;
}

function errorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
  }

  return null;
}

export function isPublicGoogleBusinessProfileWorkflowError(error: unknown): boolean {
  const name = errorName(error);
  return Boolean(name && PUBLIC_WORKFLOW_ERROR_NAMES.has(name));
}

export function googleBusinessProfileWorkflowErrorResponse(
  error: unknown,
  options: {
    fallbackMessage: string;
    status: number;
    publicMessage?: boolean;
  },
): NextResponse {
  const message =
    options.publicMessage || isPublicGoogleBusinessProfileWorkflowError(error)
      ? (errorMessage(error) ?? options.fallbackMessage)
      : options.fallbackMessage;
  const name = errorName(error);

  return NextResponse.json(
    {
      message,
      error: message,
      ...(name && isPublicGoogleBusinessProfileWorkflowError(error) ? { code: name } : {}),
    },
    { status: options.status },
  );
}
