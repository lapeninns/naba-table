/**
 * Minimal structured logger for backup/recovery CLIs. Writes JSON lines to stderr
 * with the same redaction discipline as lib/logger.ts and cloudflare/shared/redaction.ts
 * (no emails, phones, tokens, passwords or credential-bearing URLs).
 */

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|email|phone|recipient|password|secret|token|api[-_]?key|credential|url/iu;

/** ISO-8601 dates and 14-digit migration versions are operational metadata, not phone numbers. */
function isOperationalNumber(candidate: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(candidate) ||
    /^20\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{6}$/u.test(candidate)
  );
}

function scrubString(value: string): string {
  return value
    .replace(/(postgres(?:ql)?:\/\/)[^\s@]+@/giu, '$1[REDACTED]@')
    .replace(/Bearer\s+[^\s]+/giu, 'Bearer [REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, '[REDACTED]')
    .replace(/\+?\d[\d\s().-]{8,}\d/gu, (match) =>
      isOperationalNumber(match) ? match : '[REDACTED]',
    );
}

export function redactValue(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export type Logger = {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
};

export function createLogger(
  write: (line: string) => void = (line) => process.stderr.write(`${line}\n`),
  now: () => Date = () => new Date(),
): Logger {
  const emit = (
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>,
  ) => {
    write(
      JSON.stringify({
        ts: now().toISOString(),
        level,
        message: scrubString(message),
        ...(meta ? { meta: redactValue(meta) } : {}),
      }),
    );
  };
  return {
    info: (message, meta) => emit('info', message, meta),
    warn: (message, meta) => emit('warn', message, meta),
    error: (message, meta) => emit('error', message, meta),
  };
}
