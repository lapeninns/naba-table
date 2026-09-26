import type { NextRequest } from 'next/server';

const FORWARDED_CLIENT_IP_HEADERS = [
  'cf-connecting-ip',
  'true-client-ip',
  'x-vercel-forwarded-for',
  'x-forwarded-for',
];

function parseBooleanEnv(value: string | undefined): boolean {
  return /^(true|1|yes)$/i.test(value?.trim() ?? '');
}

function isValidIpv4(value: string): boolean {
  const segments = value.split('.');
  if (segments.length !== 4) return false;

  return segments.every((segment) => {
    if (!/^\d{1,3}$/.test(segment)) return false;
    const numeric = Number(segment);
    return numeric >= 0 && numeric <= 255 && String(numeric) === segment.replace(/^0+(?=\d)/, '');
  });
}

function isValidIpv6(value: string): boolean {
  if (!/^[0-9a-f:.]+$/i.test(value) || !value.includes(':')) return false;
  const pieces = value.split(':');
  return pieces.length <= 8 && pieces.some((piece) => piece.length > 0);
}

function normalizeIpHeaderValue(value: string | null): string {
  const first = value?.split(',')[0]?.trim() ?? '';
  if (!first || /[\r\n]/.test(first)) return '';

  const bracketedIpv6 = first.match(/^\[([0-9a-f:.]+)\](?::\d+)?$/i)?.[1];
  const candidate =
    bracketedIpv6 ?? first.replace(/^"|"$/g, '').replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, '$1');

  if (isValidIpv4(candidate) || isValidIpv6(candidate)) {
    return candidate;
  }

  return '';
}

export function extractClientIp(req: NextRequest): string {
  const anyRequest = req as { ip?: string };
  const direct = typeof anyRequest.ip === 'string' ? normalizeIpHeaderValue(anyRequest.ip) : '';
  if (direct) {
    return direct;
  }

  if (parseBooleanEnv(process.env.TRUST_FORWARDED_IP_HEADERS)) {
    for (const header of FORWARDED_CLIENT_IP_HEADERS) {
      const trustedIp = normalizeIpHeaderValue(req.headers.get(header));
      if (trustedIp) {
        return trustedIp;
      }
    }
  }

  return 'unknown';
}

export function anonymizeIp(ip: string | null | undefined): string {
  if (!ip || ip === 'unknown') {
    return 'unknown';
  }

  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts.slice(0, 2).join(':')}::`;
    }
    return `${parts[0] ?? ''}::`;
  }

  const segments = ip.split('.');
  if (segments.length >= 2) {
    return `${segments[0]}.${segments[1]}.x.x`;
  }

  return `${ip.slice(0, 3)}***`;
}

function expandIpv6(ip: string): string[] | null {
  const lower = ip.toLowerCase();
  let head = lower;
  let tail: string[] = [];
  // An embedded IPv4 tail (for example ::ffff:192.0.2.1) counts as two hextets.
  const lastColon = head.lastIndexOf(':');
  const maybeV4 = head.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    if (!isValidIpv4(maybeV4)) return null;
    const octets = maybeV4.split('.').map(Number);
    tail = [
      ((octets[0] << 8) | octets[1]).toString(16),
      ((octets[2] << 8) | octets[3]).toString(16),
    ];
    head = head.slice(0, lastColon + 1);
    if (head.endsWith(':') && !head.endsWith('::')) head = head.slice(0, -1);
  }

  const doubleColon = head.split('::');
  if (doubleColon.length > 2) return null;
  const left = doubleColon[0] ? doubleColon[0].split(':') : [];
  const right = doubleColon.length === 2 && doubleColon[1] ? doubleColon[1].split(':') : [];
  const explicit = [...left, ...right, ...tail];
  if (explicit.some((piece) => !/^[0-9a-f]{1,4}$/.test(piece))) return null;

  if (doubleColon.length === 2) {
    const missing = 8 - explicit.length;
    if (missing < 1) return null;
    return [...left, ...Array.from({ length: missing }, () => '0'), ...right, ...tail].map(
      (piece) => piece.replace(/^0+(?=[0-9a-f])/, ''),
    );
  }
  return explicit.length === 8 ? explicit.map((piece) => piece.replace(/^0+(?=[0-9a-f])/, '')) : null;
}

/**
 * The rate-limit bucket for one client, or `null` when the client has no
 * usable IP. IPv4 is keyed per address (/32). IPv6 is keyed per /64, the
 * smallest prefix a single subscriber is normally allocated, so rotating the
 * interface id does not buy fresh buckets. IPv4-mapped IPv6 is keyed as IPv4.
 *
 * Callers must not collapse `null` into a shared bucket: one global
 * "unknown" bucket lets any client exhaust the limit for everyone. Charge a
 * narrower key (booking, contact hash) or skip the IP charge instead.
 * Unlike {@link anonymizeIp}, this is for limiter keys, never for logs.
 */
export function rateLimitIpKey(ip: string | null | undefined): string | null {
  if (!ip || ip === 'unknown') return null;
  if (isValidIpv4(ip)) return `v4:${ip}`;
  if (!isValidIpv6(ip)) return null;

  const hextets = expandIpv6(ip);
  if (!hextets) return null;
  const isV4Mapped =
    hextets.slice(0, 5).every((piece) => piece === '0') && hextets[5] === 'ffff';
  if (isV4Mapped) {
    const high = Number.parseInt(hextets[6], 16);
    const low = Number.parseInt(hextets[7], 16);
    return `v4:${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return `v6:${hextets.slice(0, 4).join(':')}::/64`;
}
