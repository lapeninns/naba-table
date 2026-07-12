import 'server-only';

import { env } from '@/lib/env';
import { sendTwilioWhatsAppMessage } from '@/lib/twilio/sms';
import { getServiceSupabaseClient } from '@/server/supabase';
import { formatUKPhoneToE164 } from '@reserve/shared/validation';

export type MobileNotificationType =
  | 'booking_confirmation'
  | 'booking_update'
  | 'booking_cancellation'
  | 'restaurant_cancellation'
  | 'booking_review_request'
  | 'manager_daily_summary';

export type MobileAttemptStatus =
  | 'claimed'
  | 'accepted'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'undelivered'
  | 'failed';

type ProviderSendResult = {
  messageSid: string | null;
  status: string | null;
};

// mobile_notifications/mobile_notification_attempts recipient_phone CHECKs
// require strict E.164; comparable-form phones (leading + stripped) are not storable.
const E164_RECIPIENT_PHONE_REGEX = /^\+[1-9][0-9]{6,14}$/;

function toE164RecipientPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const withPlus = /^[1-9][0-9]{6,14}$/.test(trimmed) ? `+${trimmed}` : trimmed;
  const canonical = formatUKPhoneToE164(withPlus) ?? withPlus;
  return E164_RECIPIENT_PHONE_REGEX.test(canonical) ? canonical : null;
}

export type MobileNotificationInput = {
  bookingId: string | null;
  restaurantId: string;
  logicalKey: string;
  notificationType: MobileNotificationType;
  recipientPhone: string;
  whatsappEligible: boolean;
  whatsappTemplateId: string | null;
  whatsappVariables: Readonly<Record<string, string>>;
};

export type MobileNotificationDependencies = {
  claimNotification: (input: MobileNotificationInput) => Promise<{ id: string }>;
  claimAttempt: (input: {
    notificationId: string;
    channel: 'whatsapp' | 'sms';
    recipientPhone: string;
    templateId: string | null;
  }) => Promise<string | null>;
  updateAttempt: (input: {
    attemptId: string;
    status: MobileAttemptStatus;
    providerMessageId?: string | null;
    errorCode?: string | null;
  }) => Promise<void>;
  claimFallback: (input: {
    notificationId: string;
    restaurantId: string;
    recipientPhone: string;
    whatsappAttemptId: string;
  }) => Promise<string | null>;
  sendWhatsApp: (input: {
    templateId: string;
    to: string;
    variables: Readonly<Record<string, string>>;
  }) => Promise<ProviderSendResult>;
  sendSms: () => Promise<ProviderSendResult | null>;
};

export function mapProviderMobileStatus(status: string | null | undefined): MobileAttemptStatus {
  switch (status?.trim().toLowerCase()) {
    case 'accepted':
      return 'accepted';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'undelivered':
      return 'undelivered';
    case 'failed':
    case 'canceled':
      return 'failed';
    default:
      return 'queued';
  }
}

async function sendClaimedSmsAttempt(
  attemptId: string,
  dependencies: Pick<MobileNotificationDependencies, 'sendSms' | 'updateAttempt'>,
): Promise<void> {
  try {
    const result = await dependencies.sendSms();
    if (!result || (!result.messageSid && !result.status)) {
      await dependencies.updateAttempt({ attemptId, status: 'failed' });
      return;
    }
    await dependencies.updateAttempt({
      attemptId,
      providerMessageId: result.messageSid,
      status: mapProviderMobileStatus(result.status),
    });
  } catch (error) {
    await dependencies.updateAttempt({
      attemptId,
      status: 'failed',
      errorCode: error instanceof Error ? error.name : 'SMS_DISPATCH_FAILED',
    });
    throw error;
  }
}

export async function completeClaimedSmsAttempt(
  attemptId: string,
  dependencies: Pick<MobileNotificationDependencies, 'sendSms' | 'updateAttempt'>,
): Promise<void> {
  await sendClaimedSmsAttempt(attemptId, dependencies);
}

export async function dispatchMobileNotificationWithDependencies(
  rawInput: MobileNotificationInput,
  dependencies: MobileNotificationDependencies,
): Promise<'whatsapp' | 'sms' | 'duplicate'> {
  const recipientPhone = toE164RecipientPhone(rawInput.recipientPhone);
  if (!recipientPhone) {
    if (rawInput.notificationType === 'booking_review_request') {
      return 'duplicate';
    }
    // Phones the ledger cannot store stay on the legacy plain-SMS path so the
    // guest is still notified.
    await dependencies.sendSms();
    return 'sms';
  }

  const input: MobileNotificationInput = { ...rawInput, recipientPhone };
  const notification = await dependencies.claimNotification(input);
  const whatsappTemplateId = input.whatsappTemplateId;

  if (!input.whatsappEligible || !whatsappTemplateId) {
    if (input.notificationType === 'booking_review_request') {
      return 'duplicate';
    }
    const smsAttemptId = await dependencies.claimAttempt({
      notificationId: notification.id,
      channel: 'sms',
      recipientPhone: input.recipientPhone,
      templateId: null,
    });
    if (smsAttemptId) {
      await sendClaimedSmsAttempt(smsAttemptId, dependencies);
      return 'sms';
    }
    return 'duplicate';
  }

  const whatsappAttemptId = await dependencies.claimAttempt({
    notificationId: notification.id,
    channel: 'whatsapp',
    recipientPhone: input.recipientPhone,
    templateId: whatsappTemplateId,
  });
  if (!whatsappAttemptId) {
    return 'duplicate';
  }

  try {
    const result = await dependencies.sendWhatsApp({
      templateId: whatsappTemplateId,
      to: input.recipientPhone,
      variables: input.whatsappVariables,
    });
    if (!result.messageSid) {
      throw new Error('WhatsApp provider did not return a message identifier.');
    }
    const providerStatus = mapProviderMobileStatus(result.status);
    if (providerStatus === 'failed' || providerStatus === 'undelivered') {
      throw new Error('WhatsApp provider rejected the message before delivery.');
    }
    await dependencies.updateAttempt({
      attemptId: whatsappAttemptId,
      providerMessageId: result.messageSid,
      status: providerStatus,
    });
    return 'whatsapp';
  } catch (error) {
    await dependencies.updateAttempt({
      attemptId: whatsappAttemptId,
      status: 'failed',
      errorCode: error instanceof Error ? error.name : 'WHATSAPP_DISPATCH_FAILED',
    });
    if (input.notificationType === 'booking_review_request') {
      return 'duplicate';
    }
    const smsAttemptId = await dependencies.claimFallback({
      notificationId: notification.id,
      restaurantId: input.restaurantId,
      recipientPhone: input.recipientPhone,
      whatsappAttemptId,
    });
    if (smsAttemptId) {
      await sendClaimedSmsAttempt(smsAttemptId, dependencies);
      return 'sms';
    }
    return 'duplicate';
  }
}

export async function dispatchMobileNotification(
  input: MobileNotificationInput,
  options: {
    sendSms: () => Promise<ProviderSendResult | null>;
    fetchImpl?: typeof fetch;
  },
): Promise<'whatsapp' | 'sms' | 'duplicate'> {
  const client = getServiceSupabaseClient();

  return dispatchMobileNotificationWithDependencies(input, {
    claimNotification: async (notificationInput) => {
      const { data, error } = await client
        .from('mobile_notifications')
        .upsert(
          {
            booking_id: notificationInput.bookingId,
            logical_key: notificationInput.logicalKey,
            notification_type: notificationInput.notificationType,
            recipient_phone: notificationInput.recipientPhone,
            restaurant_id: notificationInput.restaurantId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'restaurant_id,logical_key' },
        )
        .select('id')
        .single();
      if (error || !data) {
        throw new Error('Failed to claim mobile notification.');
      }
      return data;
    },
    claimAttempt: async ({ channel, notificationId, recipientPhone, templateId }) => {
      const { data, error } = await client
        .from('mobile_notification_attempts')
        .insert({
          channel,
          notification_id: notificationId,
          recipient_phone: recipientPhone,
          status: 'claimed',
          template_id: templateId,
        })
        .select('id')
        .single();
      if (error?.code === '23505') {
        return null;
      }
      if (error || !data) {
        throw new Error('Failed to claim mobile notification attempt.');
      }
      return data.id;
    },
    updateAttempt: async ({ attemptId, errorCode, providerMessageId, status }) => {
      const { error } = await client
        .from('mobile_notification_attempts')
        .update({
          error_code: errorCode,
          provider_message_id: providerMessageId,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', attemptId);
      if (error) {
        throw new Error('Failed to update mobile notification attempt.');
      }
    },
    claimFallback: async ({ notificationId, recipientPhone, restaurantId, whatsappAttemptId }) => {
      const { data, error } = await client.rpc('claim_mobile_notification_fallback', {
        p_fallback_for_attempt_id: whatsappAttemptId,
        p_notification_id: notificationId,
        p_recipient_phone: recipientPhone,
        p_restaurant_id: restaurantId,
      });
      if (error) {
        throw new Error('Failed to claim SMS fallback.');
      }
      return data;
    },
    sendWhatsApp: async ({ templateId, to, variables }) => {
      const { accountSid, apiKeySid, apiKeySecret, authToken, whatsapp } = env.twilio;
      if (
        !accountSid ||
        !apiKeySid ||
        !apiKeySecret ||
        !authToken ||
        !whatsapp.sender ||
        !env.app.url
      ) {
        throw new Error('Twilio WhatsApp is not configured.');
      }
      return sendTwilioWhatsAppMessage({
        accountSid,
        apiKeySid,
        apiKeySecret,
        contentSid: templateId,
        contentVariables: variables,
        fetchImpl: options.fetchImpl,
        sender: whatsapp.sender,
        statusCallback: new URL('/api/webhook/twilio/whatsapp-status', env.app.url).toString(),
        to,
      });
    },
    sendSms: options.sendSms,
  });
}
