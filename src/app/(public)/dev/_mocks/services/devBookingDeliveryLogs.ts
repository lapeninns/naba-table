import { DevBookingQueries } from './devBookingQueries';

import type { BookingService } from '@/services/ops/bookings';
import type { BookingEmailDeliveryResponse, EmailDeliveryEventDTO } from '@/types/emailDelivery';
import type {
  BookingSmsDeliveryResponse,
  OpsSmsDeliveryAttemptDTO,
  SmsDeliveryEventDTO,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';

export class DevBookingDeliveryLogs extends DevBookingQueries {
  getBookingEmailDeliveryLog: BookingService['getBookingEmailDeliveryLog'] = async (
    bookingId,
  ): Promise<BookingEmailDeliveryResponse> => {
    const booking = this.getBookingRecord(bookingId);
    const recipientEmail = booking.customerEmail ?? 'guest@example.com';
    const now = new Date();
    const base: Omit<EmailDeliveryEventDTO, 'id' | 'status' | 'occurredAt'> = {
      bookingId,
      restaurantId: booking.restaurantId ?? null,
      emailType: 'booking_confirmation',
      templateType: 'booking_confirmation',
      recipientEmail,
      messageId: `dev-msg-${bookingId}`,
      provider: 'mock',
      error: null,
      metadata: null,
    };

    return {
      ok: true,
      bookingId,
      events: [
        {
          ...base,
          id: `dev-mail-${bookingId}-sent`,
          status: 'sent',
          occurredAt: new Date(now.getTime() - 60_000).toISOString(),
        },
        {
          ...base,
          id: `dev-mail-${bookingId}-delivered`,
          status: 'delivered',
          occurredAt: new Date(now.getTime() - 30_000).toISOString(),
        },
      ],
    };
  };

  getBookingSmsDeliveryLog: BookingService['getBookingSmsDeliveryLog'] = async (
    bookingId,
  ): Promise<BookingSmsDeliveryResponse> => {
    const booking = this.getBookingRecord(bookingId);
    const recipientPhone = booking.customerPhone ?? '+447700900000';
    const now = new Date();
    const base: Omit<SmsDeliveryEventDTO, 'id' | 'status' | 'occurredAt'> = {
      bookingId,
      restaurantId: booking.restaurantId ?? null,
      smsType: 'booking_confirmation',
      recipientPhone,
      messageSid: `dev-sms-${bookingId}`,
      provider: 'mock',
      error: null,
      metadata: null,
    };

    return {
      ok: true,
      bookingId,
      events: [
        {
          ...base,
          id: `dev-sms-${bookingId}-queued`,
          status: 'queued',
          occurredAt: new Date(now.getTime() - 90_000).toISOString(),
        },
        {
          ...base,
          id: `dev-sms-${bookingId}-delivered`,
          status: 'delivered',
          occurredAt: new Date(now.getTime() - 20_000).toISOString(),
        },
      ],
    };
  };

  getRestaurantSmsDeliveryFeed: BookingService['getRestaurantSmsDeliveryFeed'] = async ({
    restaurantId,
    range = '7d',
    page = 1,
    pageSize = 50,
    status,
    channel = 'all',
  }) => {
    if (!restaurantId) {
      throw new Error('[dev][bookingService] restaurantId is required');
    }

    // Dev fixtures only simulate plain SMS attempts today; WhatsApp is excluded
    // from the feed when the channel filter is narrowed to 'whatsapp'.
    if (channel === 'whatsapp') {
      return {
        ok: true,
        restaurantId,
        range,
        pageInfo: { page, pageSize, hasNext: false },
        attempts: [],
        summary: {
          total: 0,
          queued: 0,
          sent: 0,
          delivered: 0,
          undelivered: 0,
          failed: 0,
          deliveredRate: 0,
          failureRate: 0,
          uniqueRecipients: 0,
          uniqueBookings: 0,
          stuckInFlight: 0,
          whatsappCount: 0,
          smsCount: 0,
          fallbackCount: 0,
        },
      };
    }

    const filterStatuses = status?.length ? new Set(status) : null;
    const attempts: OpsSmsDeliveryAttemptDTO[] = this.bookings
      .filter((record) => record.restaurantId === restaurantId)
      .map((record) => {
        const currentStatus: SmsDeliveryStatus =
          record.status === 'cancelled' ? 'failed' : 'delivered';
        const event = {
          id: `dev-sms-feed-${record.id}`,
          bookingId: record.id,
          restaurantId,
          smsType: 'booking_confirmation',
          recipientPhone: record.customerPhone ?? '+447700900000',
          messageSid: `dev-sms-${record.id}`,
          status: currentStatus,
          provider: 'mock',
          occurredAt: record.createdAt,
          error: currentStatus === 'failed' ? 'Simulated cancelled-booking SMS failure.' : null,
          metadata: null,
        } as const;

        return {
          messageSid: event.messageSid,
          recipientPhone: event.recipientPhone,
          bookingId: record.id,
          smsType: event.smsType,
          provider: event.provider,
          currentStatus,
          currentOccurredAt: record.createdAt,
          events: [event],
          booking: {
            id: record.id,
            reference: record.reference ?? record.id,
            bookingDate: record.startIso?.slice(0, 10) ?? '',
            startTime: record.startIso?.slice(11, 16) ?? '',
            endTime: record.endIso?.slice(11, 16) ?? '',
            customerName: record.customerName ?? 'Guest',
            partySize: record.partySize,
          },
          isStale: false,
          stuckForMs: null,
        };
      })
      .filter((attempt) => !filterStatuses || filterStatuses.has(attempt.currentStatus));

    const startIndex = (Math.max(1, page) - 1) * Math.max(1, pageSize);
    const pageAttempts = attempts.slice(startIndex, startIndex + Math.max(1, pageSize));
    const statusCounts: Record<SmsDeliveryStatus, number> = {
      queued: 0,
      sent: 0,
      delivered: 0,
      undelivered: 0,
      failed: 0,
    };
    for (const attempt of attempts) statusCounts[attempt.currentStatus] += 1;
    const delivered = statusCounts.delivered;
    const failed = statusCounts.failed;

    return {
      ok: true,
      restaurantId,
      range,
      pageInfo: { page, pageSize, hasNext: startIndex + pageAttempts.length < attempts.length },
      attempts: pageAttempts,
      summary: {
        total: attempts.length,
        queued: statusCounts.queued,
        sent: statusCounts.sent,
        delivered,
        undelivered: statusCounts.undelivered,
        failed,
        deliveredRate: attempts.length > 0 ? delivered / attempts.length : 0,
        failureRate: attempts.length > 0 ? failed / attempts.length : 0,
        uniqueRecipients: new Set(attempts.map((attempt) => attempt.recipientPhone)).size,
        uniqueBookings: new Set(attempts.map((attempt) => attempt.bookingId).filter(Boolean)).size,
        stuckInFlight: 0,
        whatsappCount: 0,
        smsCount: attempts.length,
        fallbackCount: 0,
      },
    };
  };
}
