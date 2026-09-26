import { MutationObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient, type MutationToastNotifier } from '@/lib/query/client';

import type { AppMutationMeta } from '@/lib/query/meta';
import type { QueryClient } from '@tanstack/react-query';

function createNotifier(): MutationToastNotifier & {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return { success: vi.fn(), error: vi.fn() };
}

async function runMutation(
  client: QueryClient,
  options: {
    meta?: AppMutationMeta;
    mutationFn: (variables: { id: string }) => Promise<unknown>;
  },
): Promise<void> {
  const observer = new MutationObserver(client, options);
  await observer.mutate({ id: 'v-1' }).catch(() => undefined);
}

const conflict = () =>
  new HttpError({
    message: 'Booking was changed by someone else.',
    status: 409,
    code: 'BOOKING_STATE_CONFLICT',
  });

describe('createAppQueryClient mutation feedback', () => {
  it('shows one success toast with the static success copy', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });

    await runMutation(client, {
      meta: { feedback: { success: 'Booking saved' } },
      mutationFn: async () => ({ ok: true }),
    });

    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalledWith('Booking saved');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('passes data and variables to a success function and skips the toast when it returns null', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });
    const success = vi.fn((data: unknown, variables: unknown) =>
      (data as { name: string }).name === 'skip'
        ? null
        : `Saved ${(variables as { id: string }).id}`,
    );

    await runMutation(client, {
      meta: { feedback: { success } },
      mutationFn: async () => ({ name: 'keep' }),
    });
    await runMutation(client, {
      meta: { feedback: { success } },
      mutationFn: async () => ({ name: 'skip' }),
    });

    expect(success).toHaveBeenNthCalledWith(1, { name: 'keep' }, { id: 'v-1' });
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalledWith('Saved v-1');
  });

  it('never fails the mutation when the success copy function throws', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });
    const observer = new MutationObserver(client, {
      meta: {
        feedback: {
          success: () => {
            throw new Error('copy bug');
          },
        },
      },
      mutationFn: async () => 'done',
    });

    await expect(observer.mutate(undefined)).resolves.toBe('done');
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('shows one error toast using the per-code copy', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });

    await runMutation(client, {
      meta: {
        feedback: {
          success: 'Saved',
          error: { copy: { BOOKING_STATE_CONFLICT: 'Someone else updated this booking.' } },
        },
      },
      mutationFn: async () => {
        throw conflict();
      },
    });

    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith('Someone else updated this booking.');
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('uses the fallback for errors without copy and never shows a 5xx server message', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });

    await runMutation(client, {
      meta: { feedback: { error: { fallback: 'Could not save the booking.' } } },
      mutationFn: async () => {
        throw new Error('raw internal detail');
      },
    });
    await runMutation(client, {
      meta: { feedback: { error: {} } },
      mutationFn: async () => {
        throw new HttpError({ message: 'relation "bookings" does not exist', status: 500 });
      },
    });

    expect(notify.error).toHaveBeenNthCalledWith(1, 'Could not save the booking.');
    expect(notify.error).toHaveBeenCalledTimes(2);
    expect(notify.error.mock.calls[1]?.[0]).not.toContain('relation');
  });

  it('shows a fixed string error copy as is', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });

    await runMutation(client, {
      meta: { feedback: { error: 'Could not cancel the booking.' } },
      mutationFn: async () => {
        throw conflict();
      },
    });

    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith('Could not cancel the booking.');
  });

  it('defaults to a user message error toast when feedback is set without error config', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });

    await runMutation(client, {
      meta: { feedback: { success: 'Saved' } },
      mutationFn: async () => {
        throw conflict();
      },
    });

    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith('Booking was changed by someone else.');
  });

  it('does not toast errors when feedback.error is false (the call site handles them inline)', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });

    await runMutation(client, {
      meta: { feedback: { success: 'Saved', error: false } },
      mutationFn: async () => {
        throw conflict();
      },
    });

    expect(notify.error).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('does not toast at all when the mutation has no feedback meta', async () => {
    const notify = createNotifier();
    const client = createAppQueryClient({ notify });

    await runMutation(client, { mutationFn: async () => 'ok' });
    await runMutation(client, {
      mutationFn: async () => {
        throw conflict();
      },
    });

    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });
});

describe('createAppQueryClient mutation defaults', () => {
  it('does not retry mutations and only runs them online', () => {
    const client = createAppQueryClient({ notify: createNotifier() });
    const defaults = client.getDefaultOptions().mutations;

    expect(defaults?.retry).toBe(0);
    expect(defaults?.networkMode).toBe('online');
  });

  it('runs a failing mutation exactly once', async () => {
    const client = createAppQueryClient({ notify: createNotifier() });
    const mutationFn = vi.fn(async () => {
      throw new HttpError({ message: 'Unavailable', status: 503 });
    });

    await runMutation(client, { mutationFn });

    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it('can still be created without arguments (useState initializer)', () => {
    expect(() => createAppQueryClient()).not.toThrow();
  });
});
