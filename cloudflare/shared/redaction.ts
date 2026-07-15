export type LogFields = Readonly<Record<string, unknown>>;

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|email|phone|recipient|password|secret|token|api[-_]?key/iu;

function scrubString(value: string): string {
  return value
    .replace(/Bearer\s+[^\s]+/giu, 'Bearer [REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, '[REDACTED]')
    .replace(/\+?\d[\d\s().-]{8,}\d/gu, '[REDACTED]');
}

function redactValue(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }
  if (typeof value === 'string') {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }
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

export function redactLogFields(fields: LogFields): Record<string, unknown> {
  return redactValue(fields) as Record<string, unknown>;
}
