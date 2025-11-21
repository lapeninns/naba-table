type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_REDACT_KEYS = ['password', 'secret', 'token', 'key', 'authorization', 'cookie', 'email', 'phone'];

const LOG_METHOD: Record<LogLevel, (message?: unknown, ...optionalParams: unknown[]) => void> = {
  debug: console.debug ?? console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

export interface LoggerOptions {
  level?: LogLevel;
  redactKeys?: string[];
  now?: () => Date;
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
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
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

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { error };
}

function sanitizeMetadata(
  meta: Record<string, unknown> | undefined,
  redactKeys: string[],
  seen = new WeakSet<object>(),
): Record<string, unknown> | undefined {
  if (!meta) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      sanitized[key] = serializeError(value);
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
            return sanitizeMetadata(entry as Record<string, unknown>, redactKeys, seen);
          }
          return entry;
        });
        continue;
      }
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>, redactKeys, seen);
      continue;
    }

    if (shouldRedact(key, redactKeys)) {
      sanitized[key] = redact(value);
      continue;
    }

    if (typeof value === 'bigint') {
      sanitized[key] = value.toString();
      continue;
    }

    sanitized[key] = value as unknown;
  }
  return sanitized;
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
    } catch (error) {
      LOG_METHOD.error('logger serialization failed', { error, structured });
    }
  };
}

export function createLogger(context: Record<string, unknown> = {}, options: LoggerOptions = {}): StructuredLogger {
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
