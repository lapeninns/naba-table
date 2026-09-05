import { redactLogFields } from '../../../cloudflare/shared/redaction';

/**
 * Minimal structured logger for the controller daemon. It deliberately does
 * not depend on the web app's OpenTelemetry logger so the daemon can run from
 * `tsx` without the Next.js dependency tree. Field redaction reuses the shared
 * Worker redaction rules (authorization, tokens, emails, phones, secrets).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ControllerLogger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): ControllerLogger;
}

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly at: string;
  readonly fields: Record<string, unknown>;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const PEM_PATTERN = /-----BEGIN[^-]*-----[\s\S]*?-----END[^-]*-----/gu;
const GITHUB_TOKEN_PATTERN = /\b(?:ghs|ghp|gho|ghu|github_pat)_[A-Za-z0-9_]{10,}\b/gu;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu;

function scrubSecrets(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(PEM_PATTERN, '[REDACTED PEM]')
      .replace(GITHUB_TOKEN_PATTERN, '[REDACTED]')
      .replace(JWT_PATTERN, '[REDACTED]');
  }
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (value instanceof Error) {
    return { name: value.name, message: scrubSecrets(value.message) };
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, scrubSecrets(entry)]),
    );
  }
  return value;
}

export function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  return scrubSecrets(redactLogFields(fields)) as Record<string, unknown>;
}

export interface LoggerOptions {
  readonly level?: LogLevel;
  readonly now?: () => Date;
  readonly sink?: (record: LogRecord) => void;
}

function defaultSink(record: LogRecord): void {
  const line = JSON.stringify(record);
  if (record.level === 'error' || record.level === 'warn') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export function createLogger(
  options: LoggerOptions = {},
  context: Record<string, unknown> = {},
): ControllerLogger {
  const level = options.level ?? 'info';
  const now = options.now ?? (() => new Date());
  const sink = options.sink ?? defaultSink;
  const emit = (recordLevel: LogLevel, message: string, fields?: Record<string, unknown>) => {
    if (LEVEL_PRIORITY[recordLevel] < LEVEL_PRIORITY[level]) return;
    sink({
      level: recordLevel,
      message,
      at: now().toISOString(),
      fields: sanitizeFields({ ...context, ...(fields ?? {}) }),
    });
  };
  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (extra) => createLogger(options, { ...context, ...extra }),
  };
}

export function createSilentLogger(): ControllerLogger {
  return createLogger({ sink: () => undefined });
}
