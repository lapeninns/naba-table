import config from '@/config';
import { env } from '@/lib/env';
import { getTrustedSiteOrigin } from '@/lib/site-url';
import { normalizeEmail } from '@/server/customers';

import { resolvePlatformReplyTo } from './sender-policy';
import { createUnsubscribeToken } from './unsubscribe-token';

export const UNSUBSCRIBE_PATH = '/api/email/unsubscribe';

function buildOneClickUrl(email: string): string | null {
  const secret = env.security.sessionRecoveryAccessTokenSecret;
  if (!secret) {
    // Without a signing secret we cannot mint a tamper-proof token, so we fall back to
    // mailto-only unsubscribe rather than exposing an unauthenticated suppression URL.
    return null;
  }

  try {
    const token = createUnsubscribeToken({ email, secret });
    const url = new URL(`${getTrustedSiteOrigin()}${UNSUBSCRIBE_PATH}`);
    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    return null;
  }
}

function buildMailtoUnsubscribe(): string {
  // Point the mailto fallback at the monitored platform reply-to inbox so manual
  // unsubscribe requests are actually seen and actioned.
  const address = resolvePlatformReplyTo();
  const subject = encodeURIComponent(`Unsubscribe ${config.appName ?? ''}`.trim());
  return `mailto:${address}?subject=${subject}`;
}

/**
 * Builds RFC 2369 `List-Unsubscribe` and RFC 8058 `List-Unsubscribe-Post` headers for a
 * single recipient. The one-click HTTPS variant (preferred by Gmail/Yahoo) is included
 * when a signing secret is configured; a mailto fallback is always included.
 *
 * Returns an empty object if the email is unusable, so the caller can spread it safely.
 */
export function buildListUnsubscribeHeaders(email: string): Record<string, string> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return {};
  }

  const oneClickUrl = buildOneClickUrl(normalizedEmail);
  const mailto = buildMailtoUnsubscribe();

  if (!oneClickUrl) {
    return { 'List-Unsubscribe': `<${mailto}>` };
  }

  return {
    'List-Unsubscribe': `<${oneClickUrl}>, <${mailto}>`,
    // One-click requires the HTTPS entry above; this header tells the mailbox provider it
    // can POST to that URL to unsubscribe without any further user interaction.
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
