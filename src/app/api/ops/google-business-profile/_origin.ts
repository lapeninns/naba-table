import type { NextRequest } from 'next/server';

function readForwardedHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  return normalized ?? null;
}

export function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = readForwardedHeaderValue(request.headers.get('x-forwarded-proto'));
  const protocol =
    forwardedProto === 'http' || forwardedProto === 'https'
      ? forwardedProto
      : request.nextUrl.protocol.replace(/:$/, '');
  const host =
    readForwardedHeaderValue(request.headers.get('x-forwarded-host')) ??
    request.headers.get('host') ??
    request.nextUrl.host;

  return `${protocol}://${host}`;
}
