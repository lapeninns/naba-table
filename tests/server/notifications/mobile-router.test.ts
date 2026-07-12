import { describe, expect, it, vi } from 'vitest';

import { dispatchMobileNotificationWithDependencies } from '@/server/notifications/mobile';
import {
  reconcileWhatsAppStatusWithDependencies,
  shouldApplyWhatsAppStatus,
} from '@/server/notifications/whatsapp-status';

const input = {
  bookingId: 'booking-1',
  restaurantId: 'restaurant-1',
  logicalKey: 'booking-1:booking_confirmation:v1',
  notificationType: 'booking_confirmation' as const,
  recipientPhone: '+447123456789',
  whatsappEligible: true,
  whatsappTemplateId: 'HX-confirmation',
  whatsappVariables: { '1': 'Old Crown Girton' },
};

const reviewInput = {
  ...input,
  logicalKey: 'booking-1:booking_review_request',
  notificationType: 'booking_review_request' as const,
  whatsappTemplateId: 'HX-review',
};

function createDependencies() {
  return {
    claimNotification: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    claimAttempt: vi.fn().mockResolvedValue('attempt-whatsapp'),
    updateAttempt: vi.fn().mockResolvedValue(undefined),
    claimFallback: vi.fn().mockResolvedValue('attempt-sms'),
    sendWhatsApp: vi.fn().mockResolvedValue({ messageSid: 'WA1', status: 'queued' }),
    sendSms: vi.fn().mockResolvedValue({ messageSid: 'SM1', status: 'queued' }),
  };
}

describe('dispatchMobileNotificationWithDependencies', () => {
  it('sends WhatsApp first and suppresses SMS after provider acceptance @worker', async () => {
    const dependencies = createDependencies();

    await dispatchMobileNotificationWithDependencies(input, dependencies);

    expect(dependencies.claimAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'whatsapp' }),
    );
    expect(dependencies.sendWhatsApp).toHaveBeenCalledOnce();
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });

  it('falls back once when WhatsApp fails before acceptance @worker', async () => {
    const dependencies = createDependencies();
    dependencies.sendWhatsApp.mockRejectedValueOnce(new Error('provider unavailable'));

    await dispatchMobileNotificationWithDependencies(input, dependencies);

    expect(dependencies.claimFallback).toHaveBeenCalledWith({
      notificationId: 'notification-1',
      restaurantId: input.restaurantId,
      recipientPhone: input.recipientPhone,
      whatsappAttemptId: 'attempt-whatsapp',
    });
    expect(dependencies.sendSms).toHaveBeenCalledOnce();
  });

  it('falls back when the provider immediately returns a terminal failure @worker', async () => {
    const dependencies = createDependencies();
    dependencies.sendWhatsApp.mockResolvedValueOnce({
      messageSid: 'WA-failed',
      status: 'failed',
    });

    await dispatchMobileNotificationWithDependencies(input, dependencies);

    expect(dependencies.claimFallback).toHaveBeenCalledOnce();
    expect(dependencies.sendSms).toHaveBeenCalledOnce();
  });

  it('sends SMS directly when WhatsApp consent or configuration is unavailable @worker', async () => {
    const dependencies = createDependencies();

    await dispatchMobileNotificationWithDependencies(
      { ...input, whatsappEligible: false, whatsappTemplateId: null },
      dependencies,
    );

    expect(dependencies.sendWhatsApp).not.toHaveBeenCalled();
    expect(dependencies.sendSms).toHaveBeenCalledOnce();
  });

  it('does not dispatch when another worker owns the channel attempt @worker', async () => {
    const dependencies = createDependencies();
    dependencies.claimAttempt.mockResolvedValueOnce(null);

    await dispatchMobileNotificationWithDependencies(input, dependencies);

    expect(dependencies.sendWhatsApp).not.toHaveBeenCalled();
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });

  it('canonicalizes comparable-form recipient phones to strict E.164 before claiming @worker', async () => {
    const dependencies = createDependencies();

    // Regression: recipient_phone CHECK constraints reject comparable-form
    // phones (leading + stripped), which failed every mobile notification claim.
    await dispatchMobileNotificationWithDependencies(
      { ...input, recipientPhone: '447123456789' },
      dependencies,
    );

    expect(dependencies.claimNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: '+447123456789' }),
    );
    expect(dependencies.claimAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: '+447123456789' }),
    );
    expect(dependencies.sendWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+447123456789' }),
    );
  });

  it('canonicalizes local UK recipient phones to E.164 @worker', async () => {
    const dependencies = createDependencies();

    await dispatchMobileNotificationWithDependencies(
      { ...input, recipientPhone: '07123456789', whatsappEligible: false },
      dependencies,
    );

    expect(dependencies.claimNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: '+447123456789' }),
    );
  });

  it('keeps unstorable phones on the plain SMS path without touching the ledger @worker', async () => {
    const dependencies = createDependencies();

    const channel = await dispatchMobileNotificationWithDependencies(
      { ...input, recipientPhone: 'not-a-phone' },
      dependencies,
    );

    expect(channel).toBe('sms');
    expect(dependencies.claimNotification).not.toHaveBeenCalled();
    expect(dependencies.sendWhatsApp).not.toHaveBeenCalled();
    expect(dependencies.sendSms).toHaveBeenCalledOnce();
  });

  it('sends no SMS for a review request with an unstorable phone @worker', async () => {
    // Given: a review request whose phone cannot be stored in the mobile ledger.
    const dependencies = createDependencies();

    // When: the review request is dispatched.
    await dispatchMobileNotificationWithDependencies(
      { ...reviewInput, recipientPhone: 'not-a-phone' },
      dependencies,
    );

    // Then: neither a direct nor claimed SMS attempt is made.
    expect(dependencies.claimAttempt).not.toHaveBeenCalled();
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });

  it('sends no SMS for an ineligible review request with a present template @worker', async () => {
    // Given: an ineligible review request whose template is present.
    const dependencies = createDependencies();

    // When: the review request is dispatched.
    await dispatchMobileNotificationWithDependencies(
      { ...reviewInput, whatsappEligible: false },
      dependencies,
    );

    // Then: the router records no SMS attempt and sends no SMS.
    expect(dependencies.claimAttempt).not.toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'sms' }),
    );
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });

  it('sends no SMS for an eligible review request with a missing template @worker', async () => {
    // Given: an eligible review request whose template is missing.
    const dependencies = createDependencies();

    // When: the review request is dispatched.
    await dispatchMobileNotificationWithDependencies(
      { ...reviewInput, whatsappTemplateId: null },
      dependencies,
    );

    // Then: the router records no SMS attempt and sends no SMS.
    expect(dependencies.claimAttempt).not.toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'sms' }),
    );
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });

  it('records a pre-accept review failure without claiming or sending SMS @worker', async () => {
    // Given: an eligible review whose provider send fails before acceptance.
    const dependencies = createDependencies();
    dependencies.sendWhatsApp.mockRejectedValueOnce(new Error('provider unavailable'));

    // When: the review request is dispatched.
    await dispatchMobileNotificationWithDependencies(reviewInput, dependencies);

    // Then: the WhatsApp failure is recorded and no fallback is claimed or sent.
    expect(dependencies.updateAttempt).toHaveBeenCalledWith({
      attemptId: 'attempt-whatsapp',
      errorCode: 'Error',
      status: 'failed',
    });
    expect(dependencies.claimFallback).not.toHaveBeenCalled();
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });

  it('sends one eligible review through WhatsApp without SMS @worker', async () => {
    // Given: an eligible review with an approved template and valid recipient snapshot.
    const dependencies = createDependencies();

    // When: the review request is dispatched.
    const channel = await dispatchMobileNotificationWithDependencies(reviewInput, dependencies);

    // Then: one WhatsApp attempt is accepted and no SMS path is touched.
    expect(channel).toBe('whatsapp');
    expect(dependencies.sendWhatsApp).toHaveBeenCalledOnce();
    expect(dependencies.claimFallback).not.toHaveBeenCalled();
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });

  it('does not send a second review when another worker owns the WhatsApp attempt @worker', async () => {
    // Given: a duplicate review job after another worker claimed WhatsApp.
    const dependencies = createDependencies();
    dependencies.claimAttempt.mockResolvedValueOnce(null);

    // When: the duplicate review request is dispatched.
    const channel = await dispatchMobileNotificationWithDependencies(reviewInput, dependencies);

    // Then: the job is deduplicated without another WhatsApp or SMS send.
    expect(channel).toBe('duplicate');
    expect(dependencies.sendWhatsApp).not.toHaveBeenCalled();
    expect(dependencies.claimFallback).not.toHaveBeenCalled();
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });
});

describe('shouldApplyWhatsAppStatus', () => {
  it('allows delivered to advance to read but rejects terminal failure after success @worker', () => {
    expect(shouldApplyWhatsAppStatus('delivered', 'read')).toBe(true);
    expect(shouldApplyWhatsAppStatus('delivered', 'failed')).toBe(false);
  });
});

describe('reconcileWhatsAppStatusWithDependencies', () => {
  it('records a terminal review callback without claiming an SMS fallback @worker', async () => {
    // Given: one accepted review attempt and a terminal provider callback.
    const dependencies = {
      findAttempt: vi.fn().mockResolvedValue({
        id: 'attempt-whatsapp',
        notificationId: 'notification-1',
        notificationRecipientPhone: '+447123456789',
        notificationType: 'booking_review_request' as const,
        recipientPhone: '+447123456789',
        restaurantId: 'restaurant-1',
        status: 'accepted',
      }),
      updateAttempt: vi.fn().mockResolvedValue(true),
      claimFallback: vi.fn().mockResolvedValue('attempt-sms'),
      sendFallback: vi.fn().mockResolvedValue(true),
    };

    // When: callback reconciliation observes the terminal review failure.
    const result = await reconcileWhatsAppStatusWithDependencies(
      {
        errorCode: '63016',
        messageSid: 'MM-review',
        providerStatus: 'undelivered',
        recipientPhone: 'whatsapp:+447123456789',
      },
      dependencies,
    );

    // Then: the failure remains observable but creates no SMS fallback.
    expect(result).toEqual({ ignored: false, fallbackSent: false });
    expect(dependencies.updateAttempt).toHaveBeenCalledOnce();
    expect(dependencies.claimFallback).not.toHaveBeenCalled();
    expect(dependencies.sendFallback).not.toHaveBeenCalled();
  });

  it('records a failed review callback without claiming an SMS fallback @worker', async () => {
    // Given: one sent review attempt and a failed provider callback.
    const dependencies = {
      findAttempt: vi.fn().mockResolvedValue({
        id: 'attempt-whatsapp',
        notificationId: 'notification-1',
        notificationRecipientPhone: '+447123456789',
        notificationType: 'booking_review_request' as const,
        recipientPhone: '+447123456789',
        restaurantId: 'restaurant-1',
        status: 'sent' as const,
      }),
      updateAttempt: vi.fn().mockResolvedValue(true),
      claimFallback: vi.fn().mockResolvedValue('attempt-sms'),
      sendFallback: vi.fn().mockResolvedValue(true),
    };

    // When: callback reconciliation observes the failed review status.
    const result = await reconcileWhatsAppStatusWithDependencies(
      {
        errorCode: '63017',
        messageSid: 'MM-review-failed',
        providerStatus: 'failed',
        recipientPhone: 'whatsapp:+447123456789',
      },
      dependencies,
    );

    // Then: failure is recorded and no SMS fallback is claimed or sent.
    expect(result).toEqual({ ignored: false, fallbackSent: false });
    expect(dependencies.updateAttempt).toHaveBeenCalledOnce();
    expect(dependencies.claimFallback).not.toHaveBeenCalled();
    expect(dependencies.sendFallback).not.toHaveBeenCalled();
  });

  it('retains one SMS fallback for a lifecycle terminal callback @worker', async () => {
    // Given: one accepted lifecycle attempt and an undelivered callback.
    const dependencies = {
      findAttempt: vi.fn().mockResolvedValue({
        id: 'attempt-whatsapp',
        notificationId: 'notification-1',
        notificationRecipientPhone: '+447123456789',
        notificationType: 'booking_confirmation' as const,
        recipientPhone: '+447123456789',
        restaurantId: 'restaurant-1',
        status: 'accepted' as const,
      }),
      updateAttempt: vi.fn().mockResolvedValue(true),
      claimFallback: vi.fn().mockResolvedValue('attempt-sms'),
      sendFallback: vi.fn().mockResolvedValue(true),
    };

    // When: callback reconciliation applies the terminal failure.
    const result = await reconcileWhatsAppStatusWithDependencies(
      {
        errorCode: '63016',
        messageSid: 'MM-confirmation',
        providerStatus: 'undelivered',
        recipientPhone: 'whatsapp:+447123456789',
      },
      dependencies,
    );

    // Then: the existing exactly-once lifecycle fallback path remains active.
    expect(result).toEqual({ ignored: false, fallbackSent: true });
    expect(dependencies.claimFallback).toHaveBeenCalledOnce();
    expect(dependencies.sendFallback).toHaveBeenCalledOnce();
  });

  it('ignores an out-of-order review callback without another channel attempt @worker', async () => {
    // Given: a review attempt that is already terminal.
    const dependencies = {
      findAttempt: vi.fn().mockResolvedValue({
        id: 'attempt-whatsapp',
        notificationId: 'notification-1',
        notificationRecipientPhone: '+447123456789',
        notificationType: 'booking_review_request' as const,
        recipientPhone: '+447123456789',
        restaurantId: 'restaurant-1',
        status: 'failed' as const,
      }),
      updateAttempt: vi.fn().mockResolvedValue(true),
      claimFallback: vi.fn().mockResolvedValue('attempt-sms'),
      sendFallback: vi.fn().mockResolvedValue(true),
    };

    // When: a stale sent callback arrives after failure.
    const result = await reconcileWhatsAppStatusWithDependencies(
      {
        errorCode: null,
        messageSid: 'MM-review',
        providerStatus: 'sent',
        recipientPhone: 'whatsapp:+447123456789',
      },
      dependencies,
    );

    // Then: the terminal record is preserved without WhatsApp or SMS replay.
    expect(result).toEqual({ ignored: true, fallbackSent: false });
    expect(dependencies.updateAttempt).not.toHaveBeenCalled();
    expect(dependencies.claimFallback).not.toHaveBeenCalled();
    expect(dependencies.sendFallback).not.toHaveBeenCalled();
  });

  it('loses a duplicate callback race without claiming fallback @worker', async () => {
    // Given: another callback updates the same review attempt first.
    const dependencies = {
      findAttempt: vi.fn().mockResolvedValue({
        id: 'attempt-whatsapp',
        notificationId: 'notification-1',
        notificationRecipientPhone: '+447123456789',
        notificationType: 'booking_review_request' as const,
        recipientPhone: '+447123456789',
        restaurantId: 'restaurant-1',
        status: 'sent' as const,
      }),
      updateAttempt: vi.fn().mockResolvedValue(false),
      claimFallback: vi.fn().mockResolvedValue('attempt-sms'),
      sendFallback: vi.fn().mockResolvedValue(true),
    };

    // When: this duplicate callback attempts the same terminal update.
    const result = await reconcileWhatsAppStatusWithDependencies(
      {
        errorCode: '63016',
        messageSid: 'MM-review',
        providerStatus: 'failed',
        recipientPhone: 'whatsapp:+447123456789',
      },
      dependencies,
    );

    // Then: the compare-and-set loser creates no fallback.
    expect(result).toEqual({ ignored: true, fallbackSent: false });
    expect(dependencies.claimFallback).not.toHaveBeenCalled();
    expect(dependencies.sendFallback).not.toHaveBeenCalled();
  });
});
