export const QA_REDACTED_VALUE = '[redacted]';
export const QA_REDACTED_EMAIL = '[redacted-email]';
export const QA_REDACTED_PHONE = '[redacted-phone]';

type JsonRecord = Record<string, unknown>;

const SENSITIVE_KEY_PARTS = [
  'access_token',
  'apikey',
  'api-key',
  'api_key',
  'authorization',
  'auth',
  'cookie',
  'email',
  'jwt',
  'magiclink',
  'otp',
  'password',
  'phone',
  'refresh_token',
  'secret',
  'service_role',
  'session',
  'signature',
  'token',
];

const SENSITIVE_QUERY_KEYS = [
  'access_token',
  'apikey',
  'api_key',
  'code',
  'email',
  'key',
  'otp',
  'password',
  'phone',
  'refresh_token',
  'secret',
  'session',
  'sig',
  'signature',
  'token',
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const URL_CANDIDATE_PATTERN =
  /(?:https?:\/\/[^\s"'<>]+|\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+(?:\?[^\s"'<>#]+)?(?:#[^\s"'<>]+)?)/g;
const HEADER_LIKE_PATTERN = /^([A-Za-z0-9_-]+)\s*:\s*[^\r\n]+/gim;
const ENV_ASSIGNMENT_PATTERN =
  /\b([A-Za-z_][A-Za-z0-9_ .-]{1,80})\s*=\s*("[^"\r\n]*"|'[^'\r\n]*'|[^&\s"'<>]+)/g;
const CREDENTIAL_URL_PATTERN =
  /\b(?:postgres(?:ql)?|mysql|redis|rediss|amqp|amqps|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/\s+/g, '');
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function isSensitiveQueryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_QUERY_KEYS.some((part) => normalized.includes(part));
}

function isSecretAssignmentKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'email' || normalized === 'phone') {
    return false;
  }
  return isSensitiveKey(key);
}

function redactUrlCandidate(value: string): string {
  try {
    const looksUrlLike =
      value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
    if (!looksUrlLike || !value.includes('?')) return value;

    const isAbsolute = value.startsWith('http://') || value.startsWith('https://');
    const url = new URL(value, 'https://nabatable.local');
    for (const key of Array.from(url.searchParams.keys())) {
      if (isSensitiveQueryKey(key)) {
        url.searchParams.set(key, QA_REDACTED_VALUE);
      }
    }

    const redacted = `${url.pathname}${url.search}${url.hash}`;
    return isAbsolute ? `${url.origin}${redacted}` : redacted;
  } catch {
    return value;
  }
}

function redactUrlQueryText(value: string): string {
  return value.replace(URL_CANDIDATE_PATTERN, (candidate) => redactUrlCandidate(candidate));
}

function redactLooseAssignments(value: string): string {
  return value
    .replace(CREDENTIAL_URL_PATTERN, QA_REDACTED_VALUE)
    .replace(ENV_ASSIGNMENT_PATTERN, (match, key: string) =>
      isSecretAssignmentKey(key) ? `${key}=${QA_REDACTED_VALUE}` : match,
    )
    .replace(
      /(\/(?:invite|bookings\/recover|bookings)\/)([A-Za-z0-9._~+/=-]{10,})(?=\/|\?|#|\s|$)/gi,
      `$1${QA_REDACTED_VALUE}`,
    )
    .replace(
      /"(access_token|api[_-]?key|code|jwt|otp|password|refresh_token|secret|session|signature|token)"\s*:\s*"[^"]*"/gi,
      (_match, key: string) => `"${key}":"${QA_REDACTED_VALUE}"`,
    )
    .replace(
      /\b(access_token|api[_-]?key|code|jwt|otp|password|refresh_token|secret|session|signature|token)=([^&\s"'<>]+)/gi,
      (_match, key: string) => `${key}=${QA_REDACTED_VALUE}`,
    )
    .replace(
      /\b(authorization|cookie|set-cookie)\s*:\s*[^\r\n]+/gi,
      (_match, key: string) => `${key}: ${QA_REDACTED_VALUE}`,
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${QA_REDACTED_VALUE}`);
}

function redactHeaderLikeText(value: string): string {
  return value.replace(HEADER_LIKE_PATTERN, (match, key: string) =>
    isSensitiveKey(key) ? `${key}: ${QA_REDACTED_VALUE}` : match,
  );
}

function redactPhones(value: string): string {
  return value.replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length >= 9 ? QA_REDACTED_PHONE : candidate;
  });
}

export function redactQaText(value: string): string {
  return redactPhones(
    redactLooseAssignments(redactHeaderLikeText(redactUrlQueryText(value))).replace(
      EMAIL_PATTERN,
      QA_REDACTED_EMAIL,
    ),
  );
}

function redactQaRecord(record: JsonRecord, seen: WeakSet<object>): JsonRecord {
  const headerName = typeof record.name === 'string' ? record.name : null;
  const headerValueKey = Object.prototype.hasOwnProperty.call(record, 'value') ? 'value' : null;
  const output: JsonRecord = {};

  for (const [key, value] of Object.entries(record)) {
    if (
      isSensitiveKey(key) ||
      (headerName && headerValueKey === key && isSensitiveKey(headerName))
    ) {
      output[key] = QA_REDACTED_VALUE;
      continue;
    }

    output[key] = redactQaArtifact(value, seen);
  }

  return output;
}

export function redactQaArtifact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactQaText(value);
  if (typeof value !== 'object' || value === null) return value;

  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redactQaArtifact(entry, seen));
  }

  return redactQaRecord(value as JsonRecord, seen);
}
