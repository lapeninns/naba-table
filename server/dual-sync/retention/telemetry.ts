import { captureServerException } from '@/lib/posthog/server';

import { safeGbpTelemetry } from './privacy';

type SafeExceptionOptions = {
  readonly distinctId?: string;
  readonly groups?: Readonly<Record<string, string>>;
  readonly properties?: Readonly<Record<string, unknown>>;
};

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function safeIdentifier(value: string | undefined): string | undefined {
  return value && SAFE_IDENTIFIER.test(value) ? value : undefined;
}

function safeGroups(
  groups: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!groups) return undefined;
  const entries = Object.entries(groups).filter(
    ([key, value]) => SAFE_IDENTIFIER.test(key) && SAFE_IDENTIFIER.test(value),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

class GbpBoundaryError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'GbpBoundaryError';
  }
}

export function captureSafeGbpException(error: unknown, options: SafeExceptionOptions = {}): void {
  const errorCode = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
  const distinctId = safeIdentifier(options.distinctId);
  const groups = safeGroups(options.groups);
  captureServerException(new GbpBoundaryError(errorCode), {
    ...(distinctId ? { distinctId } : {}),
    ...(groups ? { groups } : {}),
    properties: safeGbpTelemetry({ ...options.properties, errorCode }),
  });
}
