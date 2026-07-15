import { DEV_BOOKING_ID, DEV_BOOKING_OTHER_ID } from '../devIds';
import { DevBookingAssignments } from './devBookingAssignments';
import { createDevEmailDeliveryFeed } from './devEmailDelivery';

import type {
  EmailDeliveryStatus,
  OpsEmailDeliveryFeedResponse,
  OpsEmailDeliveryRange,
  OpsEmailDeliverySummaryResponse,
} from '@/types/emailDelivery';
import type { OpsEmailQueueFeedResponse, OpsEmailQueueJobStatus } from '@/types/emailQueue';

export class DevBookingEmailOperations extends DevBookingAssignments {
  async getRestaurantEmailDeliveryFeed(params: {
    restaurantId?: string;
    range?: OpsEmailDeliveryRange;
    page?: number;
    pageSize?: number;
    status?: EmailDeliveryStatus[];
    simulateEmailDeliveryError?: boolean;
    fixture?: string;
    recipientEmail?: string;
    messageId?: string;
    bookingRef?: string;
    templateType?: string;
    emailType?: string;
  }): Promise<OpsEmailDeliveryFeedResponse> {
    if (!params.restaurantId) {
      throw new Error('[dev][bookingService] restaurantId is required');
    }
    if (params.messageId?.trim() === '__force_error__' || params.simulateEmailDeliveryError) {
      return {
        ok: false,
        code: 'FORCED_ERROR',
        error: 'Forced delivery log error for dev/test validation.',
        message: 'Forced delivery log error for dev/test validation.',
      };
    }
    return createDevEmailDeliveryFeed({
      restaurantId: params.restaurantId,
      range: params.range ?? '7d',
      page: Math.max(1, params.page ?? 1),
      pageSize: Math.max(1, Math.min(200, params.pageSize ?? 50)),
      status: params.status,
      recipientEmail: params.recipientEmail,
      messageId: params.messageId,
      bookingRef: params.bookingRef,
      templateType: params.templateType,
      emailType: params.emailType,
    });
  }

  async getRestaurantEmailDeliverySummary(params: {
    restaurantId?: string;
    range?: OpsEmailDeliveryRange;
    simulateEmailDeliveryError?: boolean;
    recipientEmail?: string;
    messageId?: string;
    bookingRef?: string;
    templateType?: string;
    emailType?: string;
  }): Promise<OpsEmailDeliverySummaryResponse> {
    const feed = await this.getRestaurantEmailDeliveryFeed({
      ...params,
      page: 1,
      pageSize: 1,
    });
    if (!feed.ok) return feed;

    return {
      ok: true,
      restaurantId: feed.restaurantId,
      range: feed.range,
      summary: feed.summary ?? {
        total: 0,
        sent: 0,
        delivered: 0,
        deliveryDelayed: 0,
        bounced: 0,
        complained: 0,
        failed: 0,
        deliveredRate: 0,
        failureRate: 0,
        uniqueRecipients: 0,
        uniqueBookings: 0,
        p50DeliverySeconds: null,
        p95DeliverySeconds: null,
        topFailedTemplates: [],
        topFailedEmailTypes: [],
      },
    };
  }

  async retryEmailDelivery(): Promise<{ ok: true; deliveryLogEntry: unknown }> {
    throw new Error('[dev][bookingService] retryEmailDelivery is not implemented');
  }

  async getRestaurantEmailQueue(params: {
    restaurantId?: string;
    page?: number;
    pageSize?: number;
    status?: OpsEmailQueueJobStatus;
    fixture?: string;
  }): Promise<OpsEmailQueueFeedResponse> {
    if (!params.restaurantId) {
      throw new Error('[dev][bookingService] restaurantId is required');
    }

    const jobs: Extract<OpsEmailQueueFeedResponse, { ok: true }>['jobs'] = [
      {
        id: 'email__reminder_short__dev-booking-1',
        status: 'delayed',
        type: 'reminder_short',
        bookingId: DEV_BOOKING_ID,
        restaurantId: params.restaurantId,
        scheduledFor: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        failedReason: null,
        failedAt: null,
        attemptsMade: 0,
        booking: {
          id: DEV_BOOKING_ID,
          reference: 'DEV123',
          customerName: 'Alex Johnson',
          customerEmail: 'alex@example.com',
          startAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed',
        },
      },
      {
        id: 'email__review_request__dev-booking-2',
        status: 'dlq',
        type: 'review_request',
        bookingId: DEV_BOOKING_OTHER_ID,
        restaurantId: params.restaurantId,
        scheduledFor: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        failedReason: 'Simulated downstream error',
        failedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        attemptsMade: 3,
        booking: {
          id: DEV_BOOKING_OTHER_ID,
          reference: 'DEV456',
          customerName: 'Sam Patel',
          customerEmail: 'sam.patel@example.com',
          startAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
          status: 'completed',
        },
      },
    ];
    const filtered = params.status ? jobs.filter((job) => job.status === params.status) : jobs;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 25));
    const offset = (page - 1) * pageSize;

    return {
      ok: true,
      restaurantId: params.restaurantId,
      pageInfo: {
        page,
        pageSize,
        hasNext: offset + pageSize < filtered.length,
        total: filtered.length,
      },
      summary: {
        total: jobs.length,
        waiting: jobs.filter((job) => job.status === 'waiting').length,
        active: jobs.filter((job) => job.status === 'active').length,
        delayed: jobs.filter((job) => job.status === 'delayed').length,
        dlq: jobs.filter((job) => job.status === 'dlq').length,
      },
      jobs: filtered.slice(offset, offset + pageSize),
      timestamp: new Date().toISOString(),
    };
  }
}
