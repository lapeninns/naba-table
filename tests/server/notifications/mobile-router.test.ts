import { describe, expect, it, vi } from 'vitest';

import { dispatchMobileNotificationWithDependencies } from '@/server/notifications/mobile';
import { shouldApplyWhatsAppStatus } from '@/server/notifications/whatsapp-status';

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
});

describe('shouldApplyWhatsAppStatus', () => {
  it('allows delivered to advance to read but rejects terminal failure after success @worker', () => {
    expect(shouldApplyWhatsAppStatus('delivered', 'read')).toBe(true);
    expect(shouldApplyWhatsAppStatus('delivered', 'failed')).toBe(false);
  });
});
