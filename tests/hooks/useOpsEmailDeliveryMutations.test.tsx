import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { EmailDeliveryTransportProvider } from '@src/hooks/ops/emailDeliveryTransport';
import {
  useCancelEmailQueueJob,
  usePendingEmailDeliveryIds,
  useRequeueEmailQueueJob,
  useRetryEmailDelivery,
} from '@src/hooks/ops/useOpsEmailDeliveryMutations';

import type { EmailDeliveryTransport } from '@/services/ops/email-delivery';
import type { ReactNode } from 'react';

const transport = {
  retryEmailDelivery: vi.fn<EmailDeliveryTransport['retryEmailDelivery']>(),
  cancelEmailQueueJob: vi.fn<EmailDeliveryTransport['cancelEmailQueueJob']>(),
  requeueEmailQueueJob: vi.fn<EmailDeliveryTransport['requeueEmailQueueJob']>(),
};

function setup<T>(hook: () => T) {
  const queryClient: QueryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <EmailDeliveryTransportProvider transport={transport}>{children}</EmailDeliveryTransportProvider>
    </QueryClientProvider>
  );
  return { queryClient, invalidateSpy, ...renderHook(hook, { wrapper }) };
}

const invalidatedKeys = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey);

describe('email delivery mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks each in-flight resend per row', async () => {
    const resolvers: Array<() => void> = [];
    transport.retryEmailDelivery.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(() =>
            resolve({ ok: true, status: 'sent', retryAttempt: 1, deliveryLogEntry: null }),
          );
        }),
    );
    const { result } = setup(() => ({
      retry: useRetryEmailDelivery(),
      pending: usePendingEmailDeliveryIds(),
    }));

    act(() => {
      result.current.retry.mutate({
        restaurantId: 'r1',
        deliveryLogId: 'log-a',
        bookingId: null,
        recipientEmail: 'a@example.com',
      });
      result.current.retry.mutate({
        restaurantId: 'r1',
        deliveryLogId: 'log-b',
        bookingId: null,
        recipientEmail: 'b@example.com',
      });
    });

    await waitFor(() =>
      expect([...result.current.pending.retryingDeliveryLogIds].sort()).toEqual(['log-a', 'log-b']),
    );

    await act(async () => {
      resolvers[0]?.();
    });
    await waitFor(() =>
      expect([...result.current.pending.retryingDeliveryLogIds]).toEqual(['log-b']),
    );
  });

  it('invalidates the feed, summary and booking log after a resend', async () => {
    transport.retryEmailDelivery.mockResolvedValue({
      ok: true,
      status: 'sent',
      retryAttempt: 1,
      deliveryLogEntry: null,
    });
    const { result, invalidateSpy } = setup(() => useRetryEmailDelivery());

    await act(async () => {
      await result.current.mutateAsync({
        restaurantId: 'r1',
        deliveryLogId: 'log-a',
        bookingId: 'b1',
        recipientEmail: 'a@example.com',
      });
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual([
      ['ops', 'email-delivery', 'r1'],
      ['ops', 'email-delivery-summary', 'r1'],
      ['ops', 'bookings', 'b1', 'email-delivery'],
    ]);
  });

  it('refreshes only the feed when a resend conflicts, and nothing on a 5xx', async () => {
    transport.retryEmailDelivery
      .mockRejectedValueOnce(new HttpError({ status: 409, code: 'ALREADY_RETRIED', message: 'x' }))
      .mockRejectedValueOnce(new HttpError({ status: 502, code: 'SEND_FAILED', message: 'x' }));
    const { result, invalidateSpy } = setup(() => useRetryEmailDelivery());
    const variables = {
      restaurantId: 'r1',
      deliveryLogId: 'log-a',
      bookingId: 'b1',
      recipientEmail: 'a@example.com',
    };

    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => undefined);
    });
    expect(invalidatedKeys(invalidateSpy)).toEqual([['ops', 'email-delivery', 'r1']]);

    invalidateSpy.mockClear();
    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => undefined);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('refreshes only the restaurant queue after a cancel or requeue', async () => {
    transport.cancelEmailQueueJob.mockResolvedValue({ ok: true, jobId: 'j1', action: 'cancelled' });
    transport.requeueEmailQueueJob.mockResolvedValue({ ok: true, jobId: 'j2', action: 'requeued' });
    const { result, invalidateSpy } = setup(() => ({
      cancel: useCancelEmailQueueJob(),
      requeue: useRequeueEmailQueueJob(),
    }));

    await act(async () => {
      await result.current.cancel.mutateAsync({ restaurantId: 'r1', jobId: 'j1' });
      await result.current.requeue.mutateAsync({ restaurantId: 'r1', jobId: 'j2' });
    });

    expect(invalidatedKeys(invalidateSpy)).toEqual([
      ['ops', 'email-queue', 'r1'],
      ['ops', 'email-queue', 'r1'],
    ]);
  });

  it('declares copy for a cancel refused because the email is sending', () => {
    const { result, queryClient } = setup(() => useCancelEmailQueueJob());
    void result;

    act(() => {
      transport.cancelEmailQueueJob.mockRejectedValue(
        new HttpError({ status: 409, code: 'JOB_IN_PROGRESS', message: 'x' }),
      );
      result.current.mutate({ restaurantId: 'r1', jobId: 'j1' });
    });

    const [mutation] = queryClient.getMutationCache().getAll();
    expect(mutation?.meta?.feedback?.error).toMatchObject({
      copy: { JOB_IN_PROGRESS: expect.stringContaining('being sent right now') },
    });
  });
});
