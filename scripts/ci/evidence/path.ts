/** Shared admission rule for collected files and their eventual R2 object keys. */
const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export function isSafeEvidencePath(relativePath: string): boolean {
  return relativePath
    .split('/')
    .every((segment) => KEY_SEGMENT.test(segment) && segment !== '.' && segment !== '..');
}
