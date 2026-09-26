function formatUuidV4(bytes: Uint8Array): string {
  // RFC 4122 §4.4: version 4 in the high nibble of byte 6, variant 10xx in byte 8.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generates a v4 UUID idempotency key for one user intent.
 * Uses crypto.randomUUID(), or a v4 UUID built from crypto.getRandomValues() where
 * randomUUID is unavailable (older Safari, non-secure contexts). There is no Math.random
 * fallback: a predictable key could replay another request.
 */
export function generateIdempotencyKey(): string {
  const webCrypto: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;

  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    return formatUuidV4(webCrypto.getRandomValues(new Uint8Array(16)));
  }

  throw new Error('A secure random source is required to generate an idempotency key.');
}
