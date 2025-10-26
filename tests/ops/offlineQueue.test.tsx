
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import React, { forwardRef, useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookingOfflineQueueProvider, useBookingOfflineQueue } from '@/contexts/booking-offline-queue';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';

import type { BookingService } from '@/services/ops/bookings';

const onlineState = { value: false };

vi.mock('@/hooks/useOnlineStatus', () => ({
  __esModule: true,
  default: () => onlineState.value,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

type BookingServiceMock = BookingService & {
  checkInBooking: ReturnType<typeof vi.fn>;
};

function createBookingServiceStub(): BookingServiceMock {
  const stub = {
    getTodaySummary: vi.fn(),
    getBookingHeatmap: vi.fn(),
    listBookings: vi.fn(),
    updateBooking: vi.fn(),
    updateBookingStatus: vi.fn(),
    checkInBooking: vi.fn(),
    checkOutBooking: vi.fn(),
    markNoShowBooking: vi.fn(),
    undoNoShowBooking: vi.fn(),
    getStatusSummary: vi.fn(),
    getBookingHistory: vi.fn(),
    cancelBooking: vi.fn(),
    createWalkInBooking: vi.fn(),
    assignTable: vi.fn(),
    unassignTable: vi.fn(),
    autoAssignTables: vi.fn(),
  } satisfies Record<string, ReturnType<typeof vi.fn>>;

  return stub as unknown as BookingServiceMock;
}

type HarnessApi = {
  getQueue: () => ReturnType<typeof useBookingOfflineQueue>;
  checkIn: () => Promise<unknown>;
  flush: () => Promise<void>;
};

const OfflineQueueHarness = forwardRef<HarnessApi>(function OfflineQueueHarness(_, ref) {
  const { checkIn } = useOpsBookingLifecycleActions();
  const queue = useBookingOfflineQueue();

  useImperativeHandle(ref, () => ({
    getQueue: () => queue,
    checkIn: () => checkIn.mutateAsync({ restaurantId: 'rest-1', bookingId: 'booking-1' }),
    flush: () => queue?.flush() ?? Promise.resolve(),
  }), [checkIn, queue]);

  return null;
});

describe('useOpsBookingLifecycleActions offline queue', () => {
  afterEach(() => {
    onlineState.value = false;
  });

  it('queues lifecycle mutations while offline and flushes when online', async () => {
    const queryClient = createQueryClient();
    const bookingService = createBookingServiceStub();
    bookingService.checkInBooking.mockResolvedValue({
      status: 'checked_in',
      checkedInAt: new Date().toISOString(),
      checkedOutAt: null,
    });

    const harnessRef = { current: null as HarnessApi | null };

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <OpsServicesProvider factories={{ bookingService: () => bookingService }}>
          <BookingOfflineQueueProvider>
            <OfflineQueueHarness ref={harnessRef} />
          </BookingOfflineQueueProvider>
        </OpsServicesProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(harnessRef.current).not.toBeNull();
    });

    await act(async () => {
      await harnessRef.current!.checkIn();
    });

    await waitFor(() => {
      expect(harnessRef.current!.getQueue()?.pending.length ?? 0).toBe(1);
    });
    expect(bookingService.checkInBooking).not.toHaveBeenCalled();

    onlineState.value = true;
    rerender(
      <QueryClientProvider client={queryClient}>
        <OpsServicesProvider factories={{ bookingService: () => bookingService }}>
          <BookingOfflineQueueProvider>
            <OfflineQueueHarness ref={harnessRef} />
          </BookingOfflineQueueProvider>
        </OpsServicesProvider>
      </QueryClientProvider>,
    );
    await act(async () => {
      await harnessRef.current!.flush();
    });

    await waitFor(() => {
      expect(bookingService.checkInBooking).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(harnessRef.current!.getQueue()?.pending.length ?? 0).toBe(0);
    });
  });
});
