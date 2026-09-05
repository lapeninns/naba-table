import { PLACEHOLDER_PATTERN } from './contracts';

const SIGNATURE_HEADER_PATTERN = /^sha256=([0-9a-f]{64})$/u;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(expected: string, supplied: string): boolean {
  if (expected.length !== supplied.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return diff === 0;
}

export async function computeWebhookSignature(
  secret: string,
  rawBody: Uint8Array,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bodyBuffer = new Uint8Array(rawBody.byteLength);
  bodyBuffer.set(rawBody);
  const digest = await crypto.subtle.sign('HMAC', key, bodyBuffer);
  return `sha256=${toHex(digest)}`;
}

/**
 * Verifies GitHub's `X-Hub-Signature-256` header over the exact raw request bytes.
 * The comparison is constant-time over the hex digest; malformed headers never match.
 */
export async function verifyWebhookSignature(input: {
  readonly secret: string | undefined;
  readonly rawBody: Uint8Array;
  readonly signatureHeader: string | null;
}): Promise<boolean> {
  if (!input.secret || input.secret.length < 16 || PLACEHOLDER_PATTERN.test(input.secret)) {
    return false;
  }
  const header = input.signatureHeader?.trim().toLowerCase() ?? '';
  const match = header.match(SIGNATURE_HEADER_PATTERN);
  if (!match) return false;
  const expected = await computeWebhookSignature(input.secret, input.rawBody);
  return timingSafeEqualHex(expected.slice('sha256='.length), match[1] ?? '');
}
