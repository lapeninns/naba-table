import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BookingOfflineQueueProvider,
  useBookingOfflineQueue,
} from '@/contexts/booking-offline-queue';

const useOnlineStatusMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useOnlineStatus', () => ({
  default: useOnlineStatusMock,
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function QueueHarness() {
  const queue = useBookingOfflineQueue();
  if (!queue) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          queue.enqueue({
            bookingId: 'booking-1',
            action: 'first',
            label: 'First',
            perform: vi.fn(),
          })
        }
      >
        unused
      </button>
      <div data-testid="pending-labels">{queue.pending.map((entry) => entry.label).join(',')}</div>
    </div>
  );
}

describe('BookingOfflineQueueProvider', () => {
  beforeEach(() => {
    useOnlineStatusMock.mockReset();
    useOnlineStatusMock.mockReturnValue(true);
  });

  it('does not drop actions enqueued during an in-flight flush', async () => {
    const first = deferred();
    const firstPerform = vi.fn(() => first.promise);
    const secondPerform = vi.fn().mockResolvedValue(undefined);
    let queueApi: NonNullable<ReturnType<typeof useBookingOfflineQueue>> | null = null;

    function CaptureQueue() {
      queueApi = useBookingOfflineQueue();
      return <QueueHarness />;
    }

    render(
      <BookingOfflineQueueProvider>
        <CaptureQueue />
      </BookingOfflineQueueProvider>,
    );

    await act(async () => {
      queueApi?.enqueue({
        bookingId: 'booking-1',
        action: 'first',
        label: 'First',
        perform: firstPerform,
      });
    });

    const flushPromise = queueApi?.flush();

    await waitFor(() => {
      expect(firstPerform).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      queueApi?.enqueue({
        bookingId: 'booking-2',
        action: 'second',
        label: 'Second',
        perform: secondPerform,
      });
    });

    await act(async () => {
      first.resolve();
      await flushPromise;
    });

    expect(secondPerform).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('pending-labels')).toHaveTextContent('');
  });
});
