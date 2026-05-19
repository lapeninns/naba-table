import type { NextRequest } from 'next/server';

const TRUSTED_CLIENT_IP_HEADERS = ['cf-connecting-ip', 'true-client-ip', 'x-vercel-forwarded-for'];

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
  const direct = typeof anyRequest.ip === 'string' ? anyRequest.ip.trim() : '';
  if (direct) {
    return direct;
  }

  for (const header of TRUSTED_CLIENT_IP_HEADERS) {
    const trustedIp = normalizeIpHeaderValue(req.headers.get(header));
    if (trustedIp) {
      return trustedIp;
    }
  }

  if (parseBooleanEnv(process.env.TRUST_FORWARDED_IP_HEADERS)) {
    const forwardedIp = normalizeIpHeaderValue(req.headers.get('x-forwarded-for'));
    if (forwardedIp) {
      return forwardedIp;
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
