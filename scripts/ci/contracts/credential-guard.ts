/**
 * Detects keys that look like they carry credentials. Used to reject any
 * heartbeat, evidence, or readiness payload that would otherwise leak a
 * token into logs, artifacts, or check-run output.
 */

const CREDENTIAL_KEY_PATTERN =
  /(?:^|[^a-z])(?:token|secret|passw(?:or)?d|passphrase|api[_-]?key|apikey|authorization|auth[_-]?header|cookie|private[_-]?key|credential|bearer|session[_-]?(?:id|key)|jwt|access[_-]?key|client[_-]?secret|signing[_-]?key|refresh[_-]?key|pem|service[_-]?role)(?:$|[^a-z])/iu;

const NORMALISE_KEY = /[^a-z0-9]+/giu;

function normaliseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(NORMALISE_KEY, '_')
    .toLowerCase();
}

export function isCredentialLikeKey(key: string): boolean {
  return CREDENTIAL_KEY_PATTERN.test(normaliseKey(key));
}

/**
 * Walks an arbitrary JSON-ish value and returns dotted paths of every key that
 * looks like a credential. Arrays are traversed; primitives are ignored.
 */
export function findCredentialLikeKeys(value: unknown, path: readonly string[] = []): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findCredentialLikeKeys(entry, [...path, String(index)]));
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  const found: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = [...path, key];
    if (isCredentialLikeKey(key)) {
      found.push(childPath.join('.'));
    }
    found.push(...findCredentialLikeKeys(child, childPath));
  }
  return found;
}
