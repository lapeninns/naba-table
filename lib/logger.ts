import { logs, SeverityNumber, type Logger as OtelLogger } from '@opentelemetry/api-logs';

import { redactUrlQuery } from '@/lib/security/url-redaction';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_REDACT_KEYS = [
  'access_token',
  'api-key',
  'api_key',
  'apikey',
  'authorization',
  'booking_recovery_token',
  'code',
  'cookie',
  'email',
  'invite_token',
  'password',
  'phone',
  'secret',
  'token',
  'token_hash',
];

const REDACTED_EMAIL = '[redacted-email]';
const REDACTED_PHONE = '[redacted-phone]';
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

const LOG_METHOD: Record<LogLevel, (message?: unknown, ...optionalParams: unknown[]) => void> = {
  debug: (message, ...optionalParams) => (console.debug ?? console.log)(message, ...optionalParams),
  info: (message, ...optionalParams) => console.log(message, ...optionalParams),
  warn: (message, ...optionalParams) => console.warn(message, ...optionalParams),
  error: (message, ...optionalParams) => console.error(message, ...optionalParams),
};

const OTEL_SEVERITY: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

export interface LoggerOptions {
  level?: LogLevel;
  redactKeys?: string[];
  now?: () => Date;
  otelLogger?: OtelLogger | null;
}

export interface StructuredLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): StructuredLogger;
}

const toLogLevel = (raw?: string | null): LogLevel => {
  const normalized = (raw ?? '').toLowerCase();
  if (
    normalized === 'debug' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error'
  ) {
    return normalized;
  }
  return 'info';
};

function redact(value: unknown): string {
  if (value === null || value === undefined) return '***redacted***';
  if (typeof value === 'string') {
    if (value.length <= 4) return '***';
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  return '***redacted***';
}

function shouldRedact(key: string, redactKeys: string[]): boolean {
  const lower = key.toLowerCase();
  return redactKeys.some((needle) => lower.includes(needle));
}

function redactLooseSecrets(value: string): string {
  return value
    .replace(
      /(\/(?:invite|bookings\/recover|bookings)\/)([A-Za-z0-9._~+/=-]{10,})(?=\/|\?|#|\s|$)/gi,
      '$1***redacted***',
    )
    .replace(
      /"(access_token|api[_-]?key|code|jwt|otp|password|refresh_token|secret|session|signature|token)"\s*:\s*"[^"]*"/gi,
      (_match, key: string) => `"${key}":"***redacted***"`,
    )
    .replace(
      /\b(access_token|api[_-]?key|code|jwt|otp|password|refresh_token|secret|session|signature|token)=([^&\s"'<>]+)/gi,
      (_match, key: string) => `${key}=***redacted***`,
    )
    .replace(
      /\b(authorization|cookie|set-cookie|x-[a-z0-9-]*api-key|api-key)\s*:\s*[^\r\n]+/gi,
      (_match, key: string) => `${key}: ***redacted***`,
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***redacted***');
}

function redactPhones(value: string): string {
  return value.replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length >= 9 ? REDACTED_PHONE : candidate;
  });
}

function sanitizeString(value: string): string {
  return redactPhones(
    redactLooseSecrets(redactUrlQuery(value)).replace(EMAIL_PATTERN, REDACTED_EMAIL),
  );
}

function serializeError(error: unknown, redactKeys: string[]): Record<string, unknown> {
  if (error instanceof Error) {
    return sanitizeMetadata(
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      redactKeys,
    )!;
  }

  return { error };
}

function sanitizeMetadata(
  meta: Record<string, unknown> | undefined,
  redactKeys: string[],
  sensitiveParent = false,
  seen = new WeakSet<object>(),
): Record<string, unknown> | undefined {
  if (!meta) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const sensitiveKey = sensitiveParent || shouldRedact(key, redactKeys);
    if (sensitiveKey) {
      sanitized[key] = redact(value);
      continue;
    }

    if (value instanceof Error) {
      sanitized[key] = serializeError(value, redactKeys);
      continue;
    }

    if (value && typeof value === 'object') {
      if (seen.has(value as object)) {
        sanitized[key] = '[circular]';
        continue;
      }
      seen.add(value as object);
      if (Array.isArray(value)) {
        sanitized[key] = value.map((entry) => {
          if (entry && typeof entry === 'object') {
            return sanitizeMetadata(entry as Record<string, unknown>, redactKeys, false, seen);
          }
          return typeof entry === 'string' ? sanitizeString(entry) : entry;
        });
        continue;
      }
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>, redactKeys, false, seen);
      continue;
    }

    if (typeof value === 'bigint') {
      sanitized[key] = value.toString();
      continue;
    }

    sanitized[key] = typeof value === 'string' ? sanitizeString(value) : value;
  }
  return sanitized;
}

function toOtelAttributes(
  payload: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'message') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      attributes[key] = value;
      continue;
    }
    if (value === null || value === undefined) continue;
    attributes[key] = JSON.stringify(value);
  }

  return attributes;
}

function emitOtelLog(
  level: LogLevel,
  payload: Record<string, unknown>,
  otelLogger: OtelLogger | null | undefined,
): void {
  if (otelLogger === null) return;

  const resolvedLogger = otelLogger ?? logs.getLogger('nabatable-server');
  if (!resolvedLogger.enabled({ severityNumber: OTEL_SEVERITY[level] })) return;

  resolvedLogger.emit({
    body: typeof payload.message === 'string' ? payload.message : 'nabatable log',
    severityNumber: OTEL_SEVERITY[level],
    severityText: level.toUpperCase(),
    attributes: toOtelAttributes(payload),
    timestamp: Date.now(),
  });
}

function createEmitter(level: LogLevel, options: LoggerOptions) {
  const minimumLevel = LEVEL_PRIORITY[options.level ?? toLogLevel(process.env.LOG_LEVEL)];
  const now = options.now ?? (() => new Date());

  return (payload: Record<string, unknown>) => {
    const payloadLevel = LEVEL_PRIORITY[level];
    if (payloadLevel < minimumLevel) {
      return;
    }

    const structured = {
      ts: now().toISOString(),
      level,
      ...payload,
    };

    try {
      LOG_METHOD[level](JSON.stringify(structured));
      emitOtelLog(level, structured, options.otelLogger);
    } catch (error) {
      LOG_METHOD.error('logger serialization failed', { error, structured });
    }
  };
}

export function createLogger(
  context: Record<string, unknown> = {},
  options: LoggerOptions = {},
): StructuredLogger {
  const baseContext = sanitizeMetadata(context, options.redactKeys ?? DEFAULT_REDACT_KEYS) ?? {};
  const emitterCache: Partial<Record<LogLevel, (payload: Record<string, unknown>) => void>> = {};

  const emit = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!emitterCache[level]) {
      emitterCache[level] = createEmitter(level, options);
    }

    const sanitizedMeta = sanitizeMetadata(meta, options.redactKeys ?? DEFAULT_REDACT_KEYS);
    const payload = {
      ...baseContext,
      message,
      ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
    };

    emitterCache[level]?.(payload);
  };

  return {
    debug: (message, meta) => emit('debug', message, meta),
    info: (message, meta) => emit('info', message, meta),
    warn: (message, meta) => emit('warn', message, meta),
    error: (message, meta) => emit('error', message, meta),
    child(additionalContext: Record<string, unknown>) {
      return createLogger({ ...baseContext, ...additionalContext }, options);
    },
  };
}

export const logger = createLogger();
