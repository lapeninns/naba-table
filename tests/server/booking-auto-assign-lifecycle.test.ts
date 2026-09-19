import { beforeEach, describe, expect, it, vi } from 'vitest';

const { afterMock, jobMock } = vi.hoisted(() => ({
  afterMock: vi.fn<(callback: () => Promise<void>) => void>(),
  jobMock: vi.fn<(bookingId: string) => Promise<void>>(),
}));

vi.mock('next/server', () => ({ after: afterMock }));
vi.mock('@/server/jobs/auto-assign', () => ({ autoAssignAndConfirmIfPossible: jobMock }));

import { scheduleBookingCreateAutoAssignRetry } from '@/server/bookings/auto-assign-domain';

describe('booking assignment retry request lifecycle', () => {
  beforeEach(() => {
    afterMock.mockReset();
    jobMock.mockReset();
  });

  it('registers retry after the response and keeps the callback pending until allocation finishes', async () => {
    // Given a job that has not yet finished its database work.
    let finishJob: () => void = () => undefined;
    jobMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishJob = resolve;
        }),
    );

    // When creation schedules its retry.
    await scheduleBookingCreateAutoAssignRetry({
      autoAssignEnabled: true,
      bookingId: 'booking-1',
      bookingStatus: 'pending',
    });

    // Then Next owns the job lifetime, including work after the HTTP response.
    expect(jobMock).not.toHaveBeenCalled();
    expect(afterMock).toHaveBeenCalledOnce();
    const callback = afterMock.mock.calls[0]?.[0];
    expect(callback).toBeDefined();
    if (!callback) throw new Error('Missing after callback');
    let completed = false;
    const completion = callback().then(() => {
      completed = true;
    });
    await vi.waitFor(() => expect(jobMock).toHaveBeenCalledWith('booking-1'));
    expect(completed).toBe(false);
    finishJob();
    await completion;
    expect(completed).toBe(true);
  });
});
