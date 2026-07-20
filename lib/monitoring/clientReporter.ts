'use client';

import { useEffect } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { stripUrlQueryAndHash } from '@/lib/security/url-redaction';

const GENERIC_SCRIPT_ERROR_PATTERN = /^script error\.?$/i;

// Session-level report budgets: repeated identical errors (tight render/effect
// loops) must not amplify into thousands of reports — a May 19 incident sent
// 2,533 events from one session before these caps existed.
const MAX_REPORTS_PER_FINGERPRINT = 3;
const MAX_REPORTS_PER_SESSION = 20;
const MAX_GENERIC_SCRIPT_ERROR_REPORTS = 1;
const MIN_REPORT_INTERVAL_MS = 2_000;

type ReporterSessionState = {
  totalSent: number;
  genericSent: number;
  lastSentAt: number;
  countsByFingerprint: Map<string, number>;
};

const sessionState: ReporterSessionState = {
  totalSent: 0,
  genericSent: 0,
  lastSentAt: 0,
  countsByFingerprint: new Map(),
};

export function resetClientErrorReporterForTests(): void {
  sessionState.totalSent = 0;
  sessionState.genericSent = 0;
  sessionState.lastSentAt = 0;
  sessionState.countsByFingerprint.clear();
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  );
}

/**
 * Reports are production-only: localhost/dev servers and preview test
 * harnesses must not post client errors (they polluted production analytics
 * with development traffic and invalid payloads in the past).
 */
export function isClientErrorReportingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV !== 'production') return false;
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv && vercelEnv !== 'production') return false;
  return !isLocalHostname(window.location.hostname);
}

export function computeClientErrorFingerprint(input: {
  type: string;
  message: string;
  stack?: string | null;
  path: string;
}): string {
  const firstStackLine =
    input.stack
      ?.split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith(input.message.slice(0, 40))) ?? '';
  const material = `${input.type}|${input.message.slice(0, 200)}|${firstStackLine.slice(0, 200)}|${input.path}`;

  // djb2 — stable, dependency-free hash for session-level dedupe keys.
  let hash = 5381;
  for (let index = 0; index < material.length; index += 1) {
    hash = ((hash << 5) + hash + material.charCodeAt(index)) | 0;
  }
  return `f${(hash >>> 0).toString(16)}`;
}

type ReportCandidate = {
  type: 'error' | 'unhandledrejection';
  message: string;
  stack: string | null;
};

/**
 * Session-level throttle/dedupe decision. Exported for tests.
 */
export function shouldSendClientErrorReport(
  candidate: ReportCandidate,
  now: number,
  state: ReporterSessionState = sessionState,
): { send: boolean; fingerprint: string } {
  const message = candidate.message.trim();
  if (!message) {
    return { send: false, fingerprint: '' };
  }

  const path =
    typeof window !== 'undefined'
      ? stripUrlQueryAndHash(window.location.pathname)
      : 'unknown';
  const fingerprint = computeClientErrorFingerprint({
    type: candidate.type,
    message,
    stack: candidate.stack,
    path,
  });

  if (state.totalSent >= MAX_REPORTS_PER_SESSION) {
    return { send: false, fingerprint };
  }
  if (now - state.lastSentAt < MIN_REPORT_INTERVAL_MS && state.totalSent > 0) {
    return { send: false, fingerprint };
  }

  const isGenericScriptError = GENERIC_SCRIPT_ERROR_PATTERN.test(message) && !candidate.stack;
  if (isGenericScriptError && state.genericSent >= MAX_GENERIC_SCRIPT_ERROR_REPORTS) {
    return { send: false, fingerprint };
  }

  const fingerprintCount = state.countsByFingerprint.get(fingerprint) ?? 0;
  if (fingerprintCount >= MAX_REPORTS_PER_FINGERPRINT) {
    return { send: false, fingerprint };
  }

  state.totalSent += 1;
  state.lastSentAt = now;
  state.countsByFingerprint.set(fingerprint, fingerprintCount + 1);
  if (isGenericScriptError) {
    state.genericSent += 1;
  }
  return { send: true, fingerprint };
}

const send = (payload: Record<string, unknown>) => {
  try {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
};

export function useClientErrorReporter() {
  const { user } = useSupabaseSession();

  useEffect(() => {
    if (!isClientErrorReportingEnabled()) {
      return;
    }

    // The `client_error_reported` analytics event is captured server-side by
    // /api/client-error only after the report is accepted and validated, so
    // analytics can never disagree with the report log again.
    const report = (candidate: ReportCandidate) => {
      const decision = shouldSendClientErrorReport(candidate, Date.now());
      if (!decision.send) return;
      const path = stripUrlQueryAndHash(window.location.pathname + window.location.search);
      send({
        type: candidate.type,
        message: candidate.message,
        stack: candidate.stack,
        path,
        userId: user?.id ?? null,
      });
    };

    const handleError = (event: ErrorEvent) => {
      report({
        type: 'error',
        message: typeof event.message === 'string' ? event.message : '',
        stack: event.error?.stack ?? null,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const message =
        typeof reason === 'string' ? reason : (reason as { message?: string })?.message;
      report({
        type: 'unhandledrejection',
        message: message ?? 'Unhandled rejection',
        stack:
          typeof reason === 'object' && reason && 'stack' in reason
            ? ((reason as { stack?: string }).stack ?? null)
            : null,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user?.id]);
}
