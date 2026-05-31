import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasRecentEmailDeliveryMock = vi.hoisted(() => vi.fn());
const hasRecentSmsDeliveryMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());
const sendGuestBookingConfirmationSmsMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const claimInsertMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/emails/email-delivery-log', () => ({
  hasRecentEmailDelivery: hasRecentEmailDeliveryMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingConfirmationEmail: sendBookingConfirmationEmailMock,
}));

vi.mock('@/server/sms/bookings', () => ({
  sendGuestBookingConfirmationSms: sendGuestBookingConfirmationSmsMock,
}));

vi.mock('@/server/sms/delivery-log', () => ({
  hasRecentSmsDelivery: hasRecentSmsDeliveryMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { sendFirstBookingConfirmationNotifications } from '@/server/bookings/confirmation-notifications';

const booking = {
  id: 'booking-1',
  restaurant_id: 'rest-1',
  customer_email: 'guest@example.com',
  customer_phone: '+447700900000',
} as const;

describe('sendFirstBookingConfirmationNotifications', () => {
  beforeEach(() => {
    hasRecentEmailDeliveryMock.mockReset();
    sendBookingConfirmationEmailMock.mockReset();
    hasRecentSmsDeliveryMock.mockReset();
    sendGuestBookingConfirmationSmsMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    claimInsertMock.mockReset();
    hasRecentEmailDeliveryMock.mockResolvedValue(false);
    hasRecentSmsDeliveryMock.mockResolvedValue(false);
    sendBookingConfirmationEmailMock.mockResolvedValue({ id: 'email-log-1' });
    sendGuestBookingConfirmationSmsMock.mockResolvedValue({
      messageSid: 'SM123',
      status: 'queued',
    });
    claimInsertMock.mockResolvedValue({ error: null });
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe('booking_confirmation_notification_claims');
        return { insert: claimInsertMock };
      }),
    });
  });

  it('still sends sms when a confirmation email already exists', async () => {
    hasRecentEmailDeliveryMock.mockResolvedValue(true);

    const result = await sendFirstBookingConfirmationNotifications(booking as never);

    expect(result).toEqual({
      alreadySent: true,
      emailSent: false,
      smsSent: true,
    });
    expect(sendBookingConfirmationEmailMock).not.toHaveBeenCalled();
    expect(claimInsertMock).toHaveBeenCalledTimes(1);
    expect(claimInsertMock).toHaveBeenCalledWith({
      booking_id: 'booking-1',
      restaurant_id: 'rest-1',
      channel: 'sms',
    });
    expect(hasRecentSmsDeliveryMock).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      smsType: 'booking_confirmation',
      recipientPhone: '+447700900000',
      withinMs: 365 * 24 * 60 * 60 * 1000,
    });
    expect(sendGuestBookingConfirmationSmsMock).toHaveBeenCalledWith(booking);
  });

  it('sends both email and sms on the first confirmed notification', async () => {
    const result = await sendFirstBookingConfirmationNotifications(booking as never);

    expect(hasRecentEmailDeliveryMock).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      templateType: 'confirmation',
      withinMs: 365 * 24 * 60 * 60 * 1000,
    });
    expect(hasRecentSmsDeliveryMock).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      smsType: 'booking_confirmation',
      recipientPhone: '+447700900000',
      withinMs: 365 * 24 * 60 * 60 * 1000,
    });
    expect(sendBookingConfirmationEmailMock).toHaveBeenCalledWith(booking);
    expect(sendGuestBookingConfirmationSmsMock).toHaveBeenCalledWith(booking);
    expect(claimInsertMock).toHaveBeenCalledTimes(2);
    expect(claimInsertMock).toHaveBeenNthCalledWith(1, {
      booking_id: 'booking-1',
      restaurant_id: 'rest-1',
      channel: 'email',
    });
    expect(claimInsertMock).toHaveBeenNthCalledWith(2, {
      booking_id: 'booking-1',
      restaurant_id: 'rest-1',
      channel: 'sms',
    });
    expect(result).toEqual({
      alreadySent: false,
      emailSent: true,
      smsSent: true,
    });
  });

  it('still sends sms when no email is available', async () => {
    const result = await sendFirstBookingConfirmationNotifications({
      ...booking,
      customer_email: null,
    } as never);

    expect(hasRecentEmailDeliveryMock).not.toHaveBeenCalled();
    expect(hasRecentSmsDeliveryMock).toHaveBeenCalled();
    expect(sendBookingConfirmationEmailMock).not.toHaveBeenCalled();
    expect(sendGuestBookingConfirmationSmsMock).toHaveBeenCalled();
    expect(claimInsertMock).toHaveBeenCalledTimes(1);
    expect(claimInsertMock).toHaveBeenCalledWith({
      booking_id: 'booking-1',
      restaurant_id: 'rest-1',
      channel: 'sms',
    });
    expect(result).toEqual({
      alreadySent: false,
      emailSent: false,
      smsSent: true,
    });
  });

  it('does not send sms when a confirmation sms already exists', async () => {
    hasRecentSmsDeliveryMock.mockResolvedValue(true);

    const result = await sendFirstBookingConfirmationNotifications(booking as never);

    expect(sendBookingConfirmationEmailMock).toHaveBeenCalledWith(booking);
    expect(sendGuestBookingConfirmationSmsMock).not.toHaveBeenCalled();
    expect(claimInsertMock).toHaveBeenCalledTimes(1);
    expect(claimInsertMock).toHaveBeenCalledWith({
      booking_id: 'booking-1',
      restaurant_id: 'rest-1',
      channel: 'email',
    });
    expect(result).toEqual({
      alreadySent: true,
      emailSent: true,
      smsSent: false,
    });
  });

  it('does not send a provider notification when another worker already claimed the channel', async () => {
    claimInsertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

    const result = await sendFirstBookingConfirmationNotifications(booking as never);

    expect(sendBookingConfirmationEmailMock).toHaveBeenCalledWith(booking);
    expect(sendGuestBookingConfirmationSmsMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      alreadySent: true,
      emailSent: true,
      smsSent: false,
    });
  });

  it('fails closed without provider sends when the claim table is unavailable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    claimInsertMock.mockResolvedValue({
      error: { code: '42P01', message: 'relation does not exist' },
    });

    try {
      const result = await sendFirstBookingConfirmationNotifications(booking as never);

      expect(sendBookingConfirmationEmailMock).not.toHaveBeenCalled();
      expect(sendGuestBookingConfirmationSmsMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        alreadySent: true,
        emailSent: false,
        smsSent: false,
      });
      expect(warnSpy).toHaveBeenCalledWith('[booking.confirmation-notifications] claim failed', {
        channel: 'email',
        code: '42P01',
      });
    } finally {
      warnSpy.mockRestore();
    }
  });
});
