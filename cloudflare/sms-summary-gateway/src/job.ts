import {
  RetryableDispatchError,
  TerminalDispatchError,
  sendTwilioSmsMessage,
  sendTwilioWhatsAppMessage,
} from './twilio';

import type { DailySummaryPreview, DailySummaryQueueMessage } from './contracts';

type ClaimResult =
  | { status: 'claimed' }
  | { status: 'already_sent'; providerMessageId: string | null; sentAt: string | null }
  | { status: 'locked'; lockUntil: string | null };

export type IdempotencyClient = {
  claim: () => Promise<ClaimResult>;
  prepareWhatsApp: (input: {
    callbackToken: string;
    message: string;
    recipient: string;
  }) => Promise<void>;
  markSent: (input: {
    channel: 'whatsapp' | 'sms';
    message: string;
    providerMessageId: string | null;
    recipient: string;
  }) => Promise<void>;
  release: () => Promise<void>;
};

export async function processDailySummaryDispatch(params: {
  payload: DailySummaryQueueMessage;
  idempotency: IdempotencyClient;
  loadPreview: (payload: DailySummaryQueueMessage) => Promise<DailySummaryPreview>;
  sendSms: (params: {
    recipient: string;
    message: string;
  }) => Promise<{ messageSid: string | null }>;
  sendWhatsApp?: (params: {
    callbackToken: string;
    recipient: string;
    message: string;
  }) => Promise<{ messageSid: string | null }>;
}): Promise<
  | { status: 'duplicate'; providerMessageId: string | null; sentAt: string | null }
  | { status: 'dry_run'; preview: DailySummaryPreview }
  | {
      status: 'sent';
      preview: DailySummaryPreview;
      messageSid: string | null;
      channel: 'whatsapp' | 'sms';
    }
> {
  const claim = await params.idempotency.claim();

  if (claim.status === 'already_sent') {
    return {
      status: 'duplicate',
      providerMessageId: claim.providerMessageId,
      sentAt: claim.sentAt,
    };
  }

  if (claim.status === 'locked') {
    throw new RetryableDispatchError('Dispatch is already being processed');
  }

  let sendCompleted = false;

  try {
    const preview = await params.loadPreview(params.payload);

    if (params.payload.dryRun) {
      await params.idempotency.release();
      return {
        status: 'dry_run',
        preview,
      };
    }

    let channel: 'whatsapp' | 'sms' = 'sms';
    let sent: { messageSid: string | null };
    if (params.payload.whatsappFirst && params.sendWhatsApp) {
      try {
        const callbackToken = crypto.randomUUID();
        await params.idempotency.prepareWhatsApp({
          callbackToken,
          recipient: params.payload.recipient,
          message: preview.message,
        });
        sent = await params.sendWhatsApp({
          callbackToken,
          recipient: params.payload.recipient,
          message: preview.message,
        });
        channel = 'whatsapp';
      } catch {
        sent = await params.sendSms({
          recipient: params.payload.recipient,
          message: preview.message,
        });
      }
    } else {
      sent = await params.sendSms({
        recipient: params.payload.recipient,
        message: preview.message,
      });
    }
    sendCompleted = true;

    await params.idempotency.markSent({
      channel,
      message: preview.message,
      providerMessageId: sent.messageSid,
      recipient: params.payload.recipient,
    });

    return {
      status: 'sent',
      preview,
      messageSid: sent.messageSid,
      channel,
    };
  } catch (error) {
    if (!sendCompleted) {
      await params.idempotency.release();
    } else {
      throw new TerminalDispatchError(
        `SMS send completed but idempotency finalization failed; manual reconciliation required: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    throw error;
  }
}

export async function sendDailySummaryViaWhatsApp(params: {
  env: {
    TWILIO_ACCOUNT_SID: string;
    TWILIO_API_KEY_SID: string;
    TWILIO_API_KEY_SECRET: string;
    TWILIO_WHATSAPP_SENDER: string;
    TWILIO_WHATSAPP_MANAGER_SUMMARY_CONTENT_SID: string;
    SMS_SUMMARY_GATEWAY_PUBLIC_URL: string;
  };
  restaurantId: string;
  localDate: string;
  callbackToken: string;
  recipient: string;
  message: string;
  fetchImpl?: typeof fetch;
}): Promise<{ messageSid: string | null }> {
  const statusCallback = new URL(
    '/webhook/twilio/manager-whatsapp-status',
    params.env.SMS_SUMMARY_GATEWAY_PUBLIC_URL,
  );
  statusCallback.searchParams.set('restaurantId', params.restaurantId);
  statusCallback.searchParams.set('localDate', params.localDate);
  statusCallback.searchParams.set('callbackToken', params.callbackToken);

  const result = await sendTwilioWhatsAppMessage({
    accountSid: params.env.TWILIO_ACCOUNT_SID,
    apiKeySid: params.env.TWILIO_API_KEY_SID,
    apiKeySecret: params.env.TWILIO_API_KEY_SECRET,
    sender: params.env.TWILIO_WHATSAPP_SENDER,
    to: params.recipient,
    contentSid: params.env.TWILIO_WHATSAPP_MANAGER_SUMMARY_CONTENT_SID,
    contentVariables: { '1': params.message },
    statusCallback: statusCallback.toString(),
    fetchImpl: params.fetchImpl,
  });
  return { messageSid: result.messageSid };
}

export async function sendDailySummaryViaTwilio(params: {
  env: {
    TWILIO_ACCOUNT_SID: string;
    TWILIO_API_KEY_SID: string;
    TWILIO_API_KEY_SECRET: string;
    TWILIO_MESSAGING_SERVICE_SID: string;
  };
  recipient: string;
  message: string;
  fetchImpl?: typeof fetch;
}): Promise<{ messageSid: string | null }> {
  const result = await sendTwilioSmsMessage({
    accountSid: params.env.TWILIO_ACCOUNT_SID,
    apiKeySid: params.env.TWILIO_API_KEY_SID,
    apiKeySecret: params.env.TWILIO_API_KEY_SECRET,
    messagingServiceSid: params.env.TWILIO_MESSAGING_SERVICE_SID,
    to: params.recipient,
    body: params.message,
    fetchImpl: params.fetchImpl,
  });

  return {
    messageSid: result.messageSid,
  };
}
