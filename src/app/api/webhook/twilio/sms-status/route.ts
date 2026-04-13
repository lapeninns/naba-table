import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import {
  mapTwilioMessageStatusToDeliveryStatus,
  validateTwilioWebhookSignature,
} from '@/lib/twilio/sms';
import { findLatestSmsDeliveryByMessageSid, recordSmsDeliveryLog } from '@/server/sms/delivery-log';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const authToken = env.twilio.authToken;
  if (!authToken) {
    console.error('[webhook][twilio][sms-status] TWILIO_AUTH_TOKEN missing; refusing webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-twilio-signature')?.trim() ?? '';
  if (!signature) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = new URLSearchParams(rawBody);
  const isValid = validateTwilioWebhookSignature({
    url: req.url,
    form,
    signature,
    authToken,
  });

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const messageSid = form.get('MessageSid')?.trim() ?? form.get('SmsSid')?.trim() ?? '';
  const recipientPhone = form.get('To')?.trim() ?? '';
  const providerStatus = form.get('MessageStatus')?.trim() ?? form.get('SmsStatus')?.trim() ?? '';

  if (!messageSid || !recipientPhone || !providerStatus) {
    return NextResponse.json({ error: 'Missing required Twilio status fields' }, { status: 400 });
  }

  const mappedStatus = mapTwilioMessageStatusToDeliveryStatus(providerStatus);
  if (!mappedStatus) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const linkage = await findLatestSmsDeliveryByMessageSid({
    messageSid,
    recipientPhone,
  });

  await recordSmsDeliveryLog({
    bookingId: linkage?.bookingId ?? null,
    restaurantId: linkage?.restaurantId ?? null,
    smsType: linkage?.smsType ?? null,
    recipientPhone,
    messageSid,
    status: mappedStatus,
    provider: 'twilio',
    occurredAt: form.get('Timestamp')?.trim() || undefined,
    error: form.get('ErrorMessage')?.trim() || null,
    metadata: {
      messageStatus: providerStatus,
      errorCode: form.get('ErrorCode')?.trim() || null,
      from: form.get('From')?.trim() || null,
      accountSid: form.get('AccountSid')?.trim() || null,
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
