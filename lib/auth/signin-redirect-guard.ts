export function hasRedirectedFrom(raw: string | string[] | undefined): boolean {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return typeof candidate === 'string' && candidate.trim().length > 0;
}
