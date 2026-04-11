import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasRecentEmailDeliveryMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());
const sendGuestBookingConfirmationSmsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/emails/email-delivery-log', () => ({
  hasRecentEmailDelivery: hasRecentEmailDeliveryMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingConfirmationEmail: sendBookingConfirmationEmailMock,
}));

vi.mock('@/server/sms/bookings', () => ({
  sendGuestBookingConfirmationSms: sendGuestBookingConfirmationSmsMock,
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
    sendGuestBookingConfirmationSmsMock.mockReset();
    hasRecentEmailDeliveryMock.mockResolvedValue(false);
    sendBookingConfirmationEmailMock.mockResolvedValue({ id: 'email-log-1' });
    sendGuestBookingConfirmationSmsMock.mockResolvedValue({
      messageSid: 'SM123',
      status: 'queued',
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
    expect(sendGuestBookingConfirmationSmsMock).toHaveBeenCalledWith(booking);
  });

  it('sends both email and sms on the first confirmed notification', async () => {
    const result = await sendFirstBookingConfirmationNotifications(booking as never);

    expect(hasRecentEmailDeliveryMock).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      templateType: 'confirmation',
      withinMs: 365 * 24 * 60 * 60 * 1000,
    });
    expect(sendBookingConfirmationEmailMock).toHaveBeenCalledWith(booking);
    expect(sendGuestBookingConfirmationSmsMock).toHaveBeenCalledWith(booking);
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
    expect(sendBookingConfirmationEmailMock).not.toHaveBeenCalled();
    expect(sendGuestBookingConfirmationSmsMock).toHaveBeenCalled();
    expect(result).toEqual({
      alreadySent: false,
      emailSent: false,
      smsSent: true,
    });
  });
});
