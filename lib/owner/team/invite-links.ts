import { getTrustedSiteOrigin } from '@/lib/site-url';

export function buildInviteUrl(token: string): string {
  const base = getTrustedSiteOrigin();
  const url = new URL(`/invite/${token}`, base);
  return url.toString();
}
