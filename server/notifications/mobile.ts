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

export type MobileDispatchResult =
  | {
      readonly attemptId: string;
      readonly kind: 'whatsapp_accepted';
      readonly providerMessageId: string;
      readonly status: MobileAttemptStatus;
    }
  | { readonly kind: 'sms' }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'ineligible' }
  | { readonly attemptId: string; readonly kind: 'provider_attempt_failed' }
  | {
      readonly attemptId: string;
      readonly errorCode: string | null;
      readonly kind: 'attempt_finalization_pending';
      readonly providerMessageId: string | null;
      readonly status: MobileAttemptStatus;
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
  finalizeWhatsAppAttempt: (input: {
    attemptId: string;
    errorCode: string | null;
    providerMessageId: string | null;
    status: MobileAttemptStatus;
  }) => Promise<MobileAttemptStatus>;
  claimFallback: (input: {
    notificationId: string;
    preacceptFailure?: boolean;
    restaurantId: string;
    recipientPhone: string;
    whatsappAttemptId: string;
  }) => Promise<string | null>;
  sendWhatsApp: (input: {
    attemptId: string;
    templateId: string;
    to: string;
    variables: Readonly<Record<string, string>>;
  }) => Promise<ProviderSendResult>;
  sendSms: (attemptId?: string) => Promise<ProviderSendResult | null>;
};

type WhatsAppAttemptFinalization = {
  readonly attemptId: string;
  readonly errorCode: string | null;
  readonly providerMessageId: string | null;
  readonly status: MobileAttemptStatus;
};

const ATTEMPT_FINALIZATION_TRIES = 2;

async function finalizeWhatsAppAttemptWithRetry(
  input: WhatsAppAttemptFinalization,
  dependencies: Pick<MobileNotificationDependencies, 'finalizeWhatsAppAttempt'>,
): Promise<MobileAttemptStatus> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < ATTEMPT_FINALIZATION_TRIES; attempt += 1) {
    try {
      return await dependencies.finalizeWhatsAppAttempt(input);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError ?? new Error('Failed to finalize mobile WhatsApp attempt.');
}

export async function finalizeMobileWhatsAppAttempt(
  input: WhatsAppAttemptFinalization,
): Promise<MobileAttemptStatus> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client.rpc('finalize_mobile_whatsapp_attempt', {
    p_attempt_id: input.attemptId,
    p_error_code: input.errorCode,
    p_provider_message_id: input.providerMessageId,
    p_status: input.status,
  });
  if (error || !data) {
    throw new Error('Failed to finalize mobile WhatsApp attempt.');
  }
  return parsePersistedMobileAttemptStatus(data);
}

export async function finalizeMobileSmsAttempt(
  input: WhatsAppAttemptFinalization,
): Promise<MobileAttemptStatus> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client.rpc('finalize_mobile_sms_attempt', {
    p_attempt_id: input.attemptId,
    p_error_code: input.errorCode,
    p_provider_message_id: input.providerMessageId,
    p_status: input.status,
  });
  if (error || !data) {
    throw new Error('Failed to finalize mobile SMS attempt.');
  }
  return parsePersistedMobileAttemptStatus(data);
}

function parsePersistedMobileAttemptStatus(status: string): MobileAttemptStatus {
  switch (status) {
    case 'claimed':
    case 'accepted':
    case 'queued':
    case 'sent':
    case 'delivered':
    case 'read':
    case 'undelivered':
    case 'failed':
      return status;
  }
  throw new Error('Mobile attempt status is unsupported.');
}

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
    const result = await dependencies.sendSms(attemptId);
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
): Promise<MobileDispatchResult> {
  const recipientPhone = toE164RecipientPhone(rawInput.recipientPhone);
  if (!recipientPhone) {
    if (rawInput.notificationType === 'booking_review_request') {
      return { kind: 'ineligible' };
    }
    // Phones the ledger cannot store stay on the legacy plain-SMS path so the
    // guest is still notified.
    await dependencies.sendSms();
    return { kind: 'sms' };
  }

  const input: MobileNotificationInput = { ...rawInput, recipientPhone };
  const notification = await dependencies.claimNotification(input);
  const whatsappTemplateId = input.whatsappTemplateId;

  if (!input.whatsappEligible || !whatsappTemplateId) {
    if (input.notificationType === 'booking_review_request') {
      return { kind: 'ineligible' };
    }
    const smsAttemptId = await dependencies.claimAttempt({
      notificationId: notification.id,
      channel: 'sms',
      recipientPhone: input.recipientPhone,
      templateId: null,
    });
    if (smsAttemptId) {
      await sendClaimedSmsAttempt(smsAttemptId, dependencies);
      return { kind: 'sms' };
    }
    return { kind: 'duplicate' };
  }

  const whatsappAttemptId = await dependencies.claimAttempt({
    notificationId: notification.id,
    channel: 'whatsapp',
    recipientPhone: input.recipientPhone,
    templateId: whatsappTemplateId,
  });
  if (!whatsappAttemptId) {
    return { kind: 'duplicate' };
  }

  let result: ProviderSendResult;
  try {
    result = await dependencies.sendWhatsApp({
      attemptId: whatsappAttemptId,
      templateId: whatsappTemplateId,
      to: input.recipientPhone,
      variables: input.whatsappVariables,
    });
    if (!result.messageSid) {
      throw new Error('WhatsApp provider did not return a message identifier.');
    }
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : 'WHATSAPP_DISPATCH_FAILED';
    try {
      await finalizeWhatsAppAttemptWithRetry(
        {
          attemptId: whatsappAttemptId,
          errorCode,
          providerMessageId: null,
          status: 'failed',
        },
        dependencies,
      );
    } catch (finalizationError) {
      if (!(finalizationError instanceof Error)) {
        throw finalizationError;
      }
      if (input.notificationType !== 'booking_review_request') {
        const smsAttemptId = await dependencies.claimFallback({
          notificationId: notification.id,
          preacceptFailure: true,
          restaurantId: input.restaurantId,
          recipientPhone: input.recipientPhone,
          whatsappAttemptId,
        });
        if (smsAttemptId) {
          await sendClaimedSmsAttempt(smsAttemptId, dependencies);
          return { kind: 'sms' };
        }
        return { kind: 'duplicate' };
      }
      return {
        attemptId: whatsappAttemptId,
        errorCode,
        kind: 'attempt_finalization_pending',
        providerMessageId: null,
        status: 'failed',
      };
    }
    if (input.notificationType === 'booking_review_request') {
      return { attemptId: whatsappAttemptId, kind: 'provider_attempt_failed' };
    }
    const smsAttemptId = await dependencies.claimFallback({
      notificationId: notification.id,
      restaurantId: input.restaurantId,
      recipientPhone: input.recipientPhone,
      whatsappAttemptId,
    });
    if (smsAttemptId) {
      await sendClaimedSmsAttempt(smsAttemptId, dependencies);
      return { kind: 'sms' };
    }
    return { kind: 'duplicate' };
  }

  const providerStatus = mapProviderMobileStatus(result.status);
  let persistedStatus: MobileAttemptStatus;
  try {
    persistedStatus = await finalizeWhatsAppAttemptWithRetry(
      {
        attemptId: whatsappAttemptId,
        errorCode: null,
        providerMessageId: result.messageSid,
        status: providerStatus,
      },
      dependencies,
    );
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    return {
      attemptId: whatsappAttemptId,
      errorCode: null,
      kind: 'attempt_finalization_pending',
      providerMessageId: result.messageSid,
      status: providerStatus,
    };
  }

  if (persistedStatus === 'failed' || persistedStatus === 'undelivered') {
    if (input.notificationType === 'booking_review_request') {
      return { attemptId: whatsappAttemptId, kind: 'provider_attempt_failed' };
    }
    const smsAttemptId = await dependencies.claimFallback({
      notificationId: notification.id,
      restaurantId: input.restaurantId,
      recipientPhone: input.recipientPhone,
      whatsappAttemptId,
    });
    if (smsAttemptId) {
      await sendClaimedSmsAttempt(smsAttemptId, dependencies);
      return { kind: 'sms' };
    }
    return { kind: 'duplicate' };
  }

  return {
    attemptId: whatsappAttemptId,
    kind: 'whatsapp_accepted',
    providerMessageId: result.messageSid,
    status: persistedStatus,
  };
}

export async function dispatchMobileNotification(
  input: MobileNotificationInput,
  options: {
    sendSms: (attemptId?: string) => Promise<ProviderSendResult | null>;
    fetchImpl?: typeof fetch;
  },
): Promise<MobileDispatchResult> {
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
      await finalizeMobileSmsAttempt({
        attemptId,
        errorCode: errorCode ?? null,
        providerMessageId: providerMessageId ?? null,
        status,
      });
    },
    finalizeWhatsAppAttempt: finalizeMobileWhatsAppAttempt,
    claimFallback: async ({
      notificationId,
      preacceptFailure,
      recipientPhone,
      restaurantId,
      whatsappAttemptId,
    }) => {
      const rpc = preacceptFailure
        ? 'claim_mobile_notification_preaccept_fallback'
        : 'claim_mobile_notification_fallback';
      const { data, error } = await client.rpc(rpc, {
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
    sendWhatsApp: async ({ attemptId, templateId, to, variables }) => {
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
      const statusCallback = new URL('/api/webhook/twilio/whatsapp-status', env.app.url);
      statusCallback.searchParams.set('attempt', attemptId);
      return sendTwilioWhatsAppMessage({
        accountSid,
        apiKeySid,
        apiKeySecret,
        contentSid: templateId,
        contentVariables: variables,
        fetchImpl: options.fetchImpl,
        sender: whatsapp.sender,
        statusCallback: statusCallback.toString(),
        to,
      });
    },
    sendSms: options.sendSms,
  });
}
