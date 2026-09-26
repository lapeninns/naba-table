// src/app/api/email/unsubscribe/route.ts
import { NextResponse } from 'next/server';

import config from '@/config';
import { internalError } from '@/lib/api/errors';
import { env } from '@/lib/env';
import { sanitizeLogText } from '@/lib/logger';
import { addEmailToSuppressionList } from '@/server/emails/email-suppression-list';
import { validateUnsubscribeToken } from '@/server/emails/unsubscribe-token';
import { recordObservabilityEvent } from '@/server/observability';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APP_NAME = config.appName ?? 'Nab a Table';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function htmlPage(title: string, bodyHtml: string, status: number): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  body { margin:0; background:#F3F4F6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827; }
  .card { max-width:440px; margin:64px auto; background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:32px; text-align:center; }
  h1 { font-size:20px; margin:0 0 12px; }
  p { font-size:15px; color:#4B5563; line-height:1.5; margin:0 0 20px; }
  button { background:#111827; color:#fff; border:0; border-radius:8px; font-size:15px; font-weight:600; padding:12px 28px; cursor:pointer; }
  .muted { font-size:12px; color:#9CA3AF; margin-top:24px; }
</style>
</head>
<body>
  <div class="card">
    ${bodyHtml}
    <p class="muted">${escapeHtml(APP_NAME)}</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function resolveValidatedEmail(
  req: NextRequest,
): { email: string } | { error: 'not_configured' | 'invalid' } {
  const secret = env.security.sessionRecoveryAccessTokenSecret;
  if (!secret) {
    return { error: 'not_configured' };
  }

  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return { error: 'invalid' };
  }

  const result = validateUnsubscribeToken(token, { secret });
  if (!result.ok) {
    return { error: 'invalid' };
  }

  return { email: result.email };
}

/**
 * GET renders a confirmation page only — it never mutates state. This prevents inbox link
 * scanners / prefetchers (which issue GETs) from accidentally unsubscribing recipients.
 * The confirm button POSTs back to this same URL.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const resolved = resolveValidatedEmail(req);

  if ('error' in resolved) {
    return htmlPage(
      'Unsubscribe link invalid',
      `<h1>This link is no longer valid</h1>
       <p>The unsubscribe link has expired or is invalid. If you keep receiving emails you did not ask for, please contact support.</p>`,
      resolved.error === 'not_configured' ? 503 : 400,
    );
  }

  const actionUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  return htmlPage(
    'Confirm unsubscribe',
    `<h1>Unsubscribe from marketing emails?</h1>
     <p>You'll stop receiving review requests and promotional emails sent to
        <strong>${escapeHtml(resolved.email)}</strong>. You'll still get essential emails
        about your bookings — confirmations, changes, and reminders.</p>
     <form method="post" action="${escapeHtml(actionUrl)}">
       <button type="submit">Unsubscribe</button>
     </form>`,
    200,
  );
}

/**
 * POST performs the unsubscribe. This is the RFC 8058 one-click path that Gmail/Yahoo
 * invoke directly (List-Unsubscribe-Post), and also the target of the GET confirm button.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const resolved = resolveValidatedEmail(req);

  if ('error' in resolved) {
    if (resolved.error === 'not_configured') {
      return NextResponse.json({ error: 'Unsubscribe not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 400 });
  }

  try {
    await addEmailToSuppressionList(resolved.email, 'one_click', { via: 'list-unsubscribe' });

    await recordObservabilityEvent({
      source: 'email.unsubscribe',
      eventType: 'email_suppression.added',
      severity: 'info',
      context: { reason: 'one_click' },
    });
  } catch (error) {
    await recordObservabilityEvent({
      source: 'email.unsubscribe',
      eventType: 'email_suppression.failed',
      severity: 'error',
      context: { error: error instanceof Error ? sanitizeLogText(error.message) : 'unknown' },
    });
    return internalError(
      error,
      { route: '/api/email/unsubscribe' },
      'Failed to process unsubscribe',
    );
  }

  // Browsers (the GET confirm form) get an HTML page; programmatic one-click callers
  // (Gmail/Yahoo) just need a 2xx, which this also satisfies.
  const wantsHtml = (req.headers.get('accept') ?? '').includes('text/html');
  if (wantsHtml) {
    return htmlPage(
      'Unsubscribed',
      `<h1>You're unsubscribed</h1>
       <p>You'll no longer receive review requests or promotional emails at
          <strong>${escapeHtml(resolved.email)}</strong>. You'll still get essential
          emails about your bookings.</p>`,
      200,
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
