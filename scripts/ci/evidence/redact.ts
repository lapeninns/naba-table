/**
 * Local log redactor for CI evidence.
 *
 * Mirrors the patterns in `cloudflare/shared/redaction.ts` and `lib/logger.ts`
 * (bearer tokens, emails, phone numbers, sensitive keys) and adds credential
 * shapes that commonly leak into CI output. It runs over whole files, so
 * secrets split across stream chunks are still caught.
 */

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  'authorization|cookie|email|phone|recipient|password|passwd|passphrase|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret|service[-_]?role|credential|signature';

const PATTERNS: readonly RegExp[] = [
  // Authorization headers and bearer tokens.
  /Bearer\s+[A-Za-z0-9._~+/=-]+/giu,
  /Basic\s+[A-Za-z0-9+/=]{16,}/gu,
  // Well-known credential shapes.
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/gu,
  /\bAKIA[0-9A-Z]{16}\b/gu,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/gu,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/gu,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu,
  // PEM private keys.
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  // URL userinfo credentials.
  /(?<=[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+(?=@)/giu,
  // Emails and phone numbers (guest PII).
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu,
  /\+?\d[\d\s().-]{8,}\d/gu,
];

/** `KEY=value`, `KEY: value`, `"key": "value"` where the key looks sensitive. */
const KEY_VALUE_PATTERN = new RegExp(
  `(["']?)([A-Za-z0-9_.-]*(?:${SENSITIVE_KEY})[A-Za-z0-9_.-]*)(\\1\\s*[=:]\\s*)("?)([^\\s"',;]+)`,
  'giu',
);

export interface RedactionResult {
  readonly text: string;
  readonly redactions: number;
}

export function redactText(input: string): RedactionResult {
  let redactions = 0;
  // Well-known shapes first (so `Authorization: Bearer <token>` loses the whole
  // token), then generic key/value pairs for anything sensitive that remains.
  let text = input;
  for (const pattern of PATTERNS) {
    text = text.replace(pattern, () => {
      redactions += 1;
      return REDACTED;
    });
  }
  text = text.replace(
    KEY_VALUE_PATTERN,
    (
      match: string,
      quote: string,
      key: string,
      separator: string,
      valueQuote: string,
      value: string,
    ) => {
      if (value === REDACTED) return match;
      redactions += 1;
      return `${quote}${key}${separator}${valueQuote}${REDACTED}`;
    },
  );
  return { text, redactions };
}

export function isSensitiveKey(key: string): boolean {
  return new RegExp(SENSITIVE_KEY, 'iu').test(key);
}
