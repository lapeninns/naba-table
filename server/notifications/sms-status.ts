import 'server-only';

import {
  finalizeMobileSmsAttempt,
  mapProviderMobileStatus,
  type MobileAttemptStatus,
} from '@/server/notifications/mobile';
import { getServiceSupabaseClient } from '@/server/supabase';

type SmsStatusInput = {
  readonly attemptId?: string;
  readonly errorCode: string | null;
  readonly messageSid: string;
  readonly providerStatus: string;
  readonly recipientPhone: string;
};

function normalizeSmsRecipient(value: string): string {
  return value.trim().replace(/^sms:/i, '');
}

export async function processSmsStatusCallback(
  input: SmsStatusInput,
): Promise<{ readonly ignored: boolean; readonly status: MobileAttemptStatus | null }> {
  const client = getServiceSupabaseClient();
  let query = client
    .from('mobile_notification_attempts')
    .select('id,recipient_phone')
    .eq('provider', 'twilio')
    .eq('channel', 'sms');

  query = input.attemptId
    ? query
        .eq('id', input.attemptId)
        .or(`provider_message_id.is.null,provider_message_id.eq.${input.messageSid}`)
    : query.eq('provider_message_id', input.messageSid);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error('Failed to resolve SMS delivery attempt.');
  }

  const attempt = data;
  if (
    !attempt ||
    normalizeSmsRecipient(attempt.recipient_phone) !== normalizeSmsRecipient(input.recipientPhone)
  ) {
    return { ignored: true, status: null };
  }

  const status = await finalizeMobileSmsAttempt({
    attemptId: attempt.id,
    errorCode: input.errorCode,
    providerMessageId: input.messageSid,
    status: mapProviderMobileStatus(input.providerStatus),
  });
  return { ignored: false, status };
}
