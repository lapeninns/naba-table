import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { hashEmailTemplatePreviewInput } from '@/services/ops/email-templates';
import { EmailTemplatesTransportProvider } from '@src/hooks/ops/emailTemplatesTransport';
import {
  PREVIEW_DEBOUNCE_MS,
  PREVIEW_RATE_LIMIT,
  useOpsEmailTemplatePreview,
  useOpsResetRestaurantEmailTemplate,
  useOpsRestaurantEmailTemplates,
  useOpsSendRestaurantEmailTemplateTest,
  useOpsUpdateRestaurantEmailTemplate,
} from '@src/hooks/ops/useOpsRestaurantEmailTemplates';

import type { ReactNode } from 'react';

const restaurantService = vi.hoisted(() => ({
  getEmailTemplates: vi.fn(),
  updateEmailTemplate: vi.fn(),
  resetEmailTemplate: vi.fn(),
  previewEmailTemplate: vi.fn(),
  sendTestEmailTemplate: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));

const transport = vi.hoisted(() => ({
  previewEmailTemplate: vi.fn(),
  sendTestEmailTemplate: vi.fn(),
}));

function transportWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EmailTemplatesTransportProvider transport={transport}>
          {children}
        </EmailTemplatesTransportProvider>
      </QueryClientProvider>
    );
  };
}

const restaurantId = 'rest-1';
const templatesKey = queryKeys.opsRestaurants.emailTemplates(restaurantId);
const snapshot = { groups: [{ title: 'Booking', templates: [] }] };

function setup<T, P = undefined>(hook: (props: P) => T) {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, invalidateSpy, ...renderHook(hook, { wrapper }) };
}

beforeEach(() => {
  for (const mock of Object.values(restaurantService)) mock.mockReset();
  for (const mock of Object.values(transport)) mock.mockReset();
});

describe('useOpsRestaurantEmailTemplates', () => {
  it('@contract stays disabled without a restaurant id', () => {
    setup(() => useOpsRestaurantEmailTemplates(null));

    expect(restaurantService.getEmailTemplates).not.toHaveBeenCalled();
  });

  it('@contract fetches the templates snapshot', async () => {
    restaurantService.getEmailTemplates.mockResolvedValue(snapshot);

    const { result } = setup(() => useOpsRestaurantEmailTemplates(restaurantId));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(snapshot);
    expect(restaurantService.getEmailTemplates).toHaveBeenCalledWith(restaurantId, {
      signal: expect.any(AbortSignal),
    });
  });

  it('@contract surfaces fetch errors', async () => {
    restaurantService.getEmailTemplates.mockRejectedValue(new Error('boom'));

    const { result } = setup(() => useOpsRestaurantEmailTemplates(restaurantId));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

function seededSnapshot() {
  return {
    restaurantId,
    canEdit: true,
    groups: [
      {
        key: 'confirmation',
        title: 'Confirmation',
        description: '',
        templates: [
          { key: 'confirmation', status: 'default', variants: [{ id: 'old' }] },
          { key: 'cancelled', status: 'default', variants: [{ id: 'keep' }] },
        ],
      },
    ],
  };
}

describe('useOpsUpdateRestaurantEmailTemplate', () => {
  it('@contract saves and writes the returned template into the cached snapshot', async () => {
    const template = { key: 'confirmation', status: 'custom', variants: [{ id: 'new' }] };
    restaurantService.updateEmailTemplate.mockResolvedValue(template);

    const { result, queryClient, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantEmailTemplate(restaurantId),
    );
    queryClient.setQueryData(templatesKey, seededSnapshot());

    await result.current.mutateAsync({
      templateKey: 'confirmation',
      variants: [] as never,
    });

    expect(restaurantService.updateEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'confirmation',
      {
        variants: [],
      },
    );
    const cached = queryClient.getQueryData<ReturnType<typeof seededSnapshot>>(templatesKey);
    expect(cached?.groups[0]?.templates).toEqual([
      template,
      { key: 'cancelled', status: 'default', variants: [{ id: 'keep' }] },
    ]);
    // No round trip: the save response is the new server state.
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('@contract fails before the service call without a restaurant id', async () => {
    const { result } = setup(() => useOpsUpdateRestaurantEmailTemplate(null));

    await expect(
      result.current.mutateAsync({
        templateKey: 'confirmation',
        variants: [] as never,
      }),
    ).rejects.toThrow('Restaurant id is required');
    expect(restaurantService.updateEmailTemplate).not.toHaveBeenCalled();
  });
});

describe('useOpsResetRestaurantEmailTemplate', () => {
  it('@contract resets and writes the default template into the cached snapshot', async () => {
    const template = { key: 'confirmation', status: 'default', variants: [{ id: 'default' }] };
    restaurantService.resetEmailTemplate.mockResolvedValue(template);

    const { result, queryClient } = setup(() => useOpsResetRestaurantEmailTemplate(restaurantId));
    queryClient.setQueryData(templatesKey, seededSnapshot());

    await result.current.mutateAsync({ templateKey: 'confirmation' });

    expect(restaurantService.resetEmailTemplate).toHaveBeenCalledWith(restaurantId, 'confirmation');
    const cached = queryClient.getQueryData<ReturnType<typeof seededSnapshot>>(templatesKey);
    expect(cached?.groups[0]?.templates[0]).toEqual(template);
  });
});

describe('useOpsEmailTemplatePreview', () => {
  const variants = [{ id: 'v1', subject: 'Hello' }] as never;

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract renders straight away, then waits for typing to settle before re-rendering', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    restaurantService.previewEmailTemplate.mockImplementation(async (_id, _key, payload) => ({
      templateKey: 'confirmation',
      html: payload.variants[0].subject,
    }));

    const { result, rerender } = setup(({ subject }: { subject: string } = { subject: 'Hello' }) =>
      useOpsEmailTemplatePreview({
        restaurantId,
        templateKey: 'confirmation',
        variantId: 'v1',
        variants: [{ id: 'v1', subject }] as never,
      }),
    );
    await waitFor(() => expect(result.current.data?.html).toBe('Hello'));

    rerender({ subject: 'Hello t' });
    rerender({ subject: 'Hello there' });
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    });

    await waitFor(() => expect(result.current.data?.html).toBe('Hello there'));
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(2);
    expect(restaurantService.previewEmailTemplate).toHaveBeenLastCalledWith(
      restaurantId,
      'confirmation',
      { preferredVariantId: 'v1', variants: [{ id: 'v1', subject: 'Hello there' }] },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('@contract holds renders once the rate window is full, then sends the latest draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    restaurantService.previewEmailTemplate.mockImplementation(async (_id, _key, payload) => ({
      templateKey: 'confirmation',
      html: payload.variants[0].subject,
    }));

    const { result, rerender } = setup(({ subject }: { subject: string } = { subject: 's0' }) =>
      useOpsEmailTemplatePreview({
        restaurantId: 'rest-rate-limited',
        templateKey: 'confirmation',
        variantId: 'v1',
        variants: [{ id: 'v1', subject }] as never,
        debounceMs: 0,
      }),
    );
    for (let index = 1; index < PREVIEW_RATE_LIMIT.limit; index += 1) {
      rerender({ subject: `s${index}` });
      await waitFor(() =>
        expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(index + 1),
      );
    }

    rerender({ subject: 'over the limit' });
    rerender({ subject: 'latest' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(PREVIEW_RATE_LIMIT.limit);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREVIEW_RATE_LIMIT.windowMs);
    });
    await waitFor(() => expect(result.current.data?.html).toBe('latest'));
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(
      PREVIEW_RATE_LIMIT.limit + 1,
    );
  });

  it('@contract keeps showing the last preview of the same email while the next one renders', async () => {
    restaurantService.previewEmailTemplate
      .mockResolvedValueOnce({ templateKey: 'confirmation', html: 'first' })
      .mockReturnValueOnce(new Promise(() => {}));

    const { result, rerender } = setup(({ id }: { id: string } = { id: 'v1' }) =>
      useOpsEmailTemplatePreview({
        restaurantId,
        templateKey: 'confirmation',
        variantId: id,
        variants,
        debounceMs: 0,
      }),
    );
    await waitFor(() => expect(result.current.data?.html).toBe('first'));

    rerender({ id: 'v2' });

    await waitFor(() => expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(2));
    expect(result.current.data?.html).toBe('first');
    expect(result.current.isPlaceholderData).toBe(true);
  });

  it('@contract keys the render by a hash of the draft from lib/query/keys and reuses it for an identical draft', async () => {
    restaurantService.previewEmailTemplate.mockResolvedValue({
      templateKey: 'confirmation',
      html: 'x',
    });

    const { queryClient, rerender } = setup(
      ({ subject }: { subject: string } = { subject: 'same' }) =>
        useOpsEmailTemplatePreview({
          restaurantId: 'rest-cache',
          templateKey: 'confirmation',
          variantId: 'v1',
          variants: [{ id: 'v1', subject }] as never,
          debounceMs: 0,
        }),
    );
    await waitFor(() => expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(1));

    // A new array with identical content is the same draft: no second render.
    rerender({ subject: 'same' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(1);

    const key = queryKeys.opsEmailTemplates.preview(
      'rest-cache',
      'confirmation',
      hashEmailTemplatePreviewInput({
        preferredVariantId: 'v1',
        variants: [{ id: 'v1', subject: 'same' }] as never,
      }),
    );
    expect(queryClient.getQueryData(key)).toEqual({ templateKey: 'confirmation', html: 'x' });
  });

  it('@contract aborts the render of a superseded draft', async () => {
    const signals: AbortSignal[] = [];
    restaurantService.previewEmailTemplate.mockImplementation(
      (_id, _key, _payload, options: { signal: AbortSignal }) => {
        signals.push(options.signal);
        return new Promise(() => {});
      },
    );

    const { rerender } = setup(({ id }: { id: string } = { id: 'v1' }) =>
      useOpsEmailTemplatePreview({
        restaurantId: 'rest-abort',
        templateKey: 'confirmation',
        variantId: id,
        variants: [{ id: 'v1' }, { id: 'v2' }] as never,
        debounceMs: 0,
      }),
    );
    await waitFor(() => expect(signals).toHaveLength(1));

    rerender({ id: 'v2' });

    await waitFor(() => expect(signals).toHaveLength(2));
    await waitFor(() => expect(signals[0]!.aborted).toBe(true));
    expect(signals[1]!.aborted).toBe(false);
  });

  it('@contract never sends a request per keystroke, so fast typing cannot trigger a 429 storm', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    restaurantService.previewEmailTemplate.mockImplementation(async (_id, _key, payload) => ({
      templateKey: 'confirmation',
      html: payload.variants[0].subject,
    }));

    const { result, rerender } = setup(({ subject }: { subject: string } = { subject: '' }) =>
      useOpsEmailTemplatePreview({
        restaurantId: 'rest-typing',
        templateKey: 'confirmation',
        variantId: 'v1',
        variants: [{ id: 'v1', subject }] as never,
      }),
    );
    await waitFor(() => expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(1));

    // 60 keystrokes, 100 ms apart: well inside the debounce window each time.
    const text = 'A long subject line typed quickly by a member of staff......';
    for (let index = 1; index <= text.length; index += 1) {
      rerender({ subject: text.slice(0, index) });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    });
    await waitFor(() => expect(result.current.data?.html).toBe(text));
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(2);
  });

  it('@contract retries a rate-limited preview once, after its Retry-After, and recovers', async () => {
    vi.useFakeTimers();
    restaurantService.previewEmailTemplate
      .mockRejectedValueOnce(
        new HttpError({ status: 429, code: 'RATE_LIMITED', message: 'Too many', retryAfter: 3 }),
      )
      .mockResolvedValueOnce({ templateKey: 'confirmation', html: 'recovered' });

    const { result } = setup(() =>
      useOpsEmailTemplatePreview({
        restaurantId: 'rest-429-recover',
        templateKey: 'confirmation',
        variantId: 'v1',
        variants,
        debounceMs: 0,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(1);

    // No hammering inside the Retry-After window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_900);
    });
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual({ templateKey: 'confirmation', html: 'recovered' });
    expect(result.current.isError).toBe(false);
  });

  it('@contract surfaces a preview that is still rate limited after one retry', async () => {
    vi.useFakeTimers();
    restaurantService.previewEmailTemplate.mockRejectedValue(
      new HttpError({ status: 429, code: 'RATE_LIMITED', message: 'Too many', retryAfter: 1 }),
    );

    const { result } = setup(() =>
      useOpsEmailTemplatePreview({
        restaurantId: 'rest-429-fail',
        templateKey: 'confirmation',
        variantId: 'v1',
        variants,
        debounceMs: 0,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(2);
    expect(result.current.isError).toBe(true);
  });

  it('@contract does not retry a rejected draft (4xx)', async () => {
    restaurantService.previewEmailTemplate.mockRejectedValue(
      new HttpError({ status: 400, code: 'VALIDATION_FAILED', message: 'Bad draft' }),
    );

    const { result } = setup(() =>
      useOpsEmailTemplatePreview({
        restaurantId: 'rest-400',
        templateKey: 'confirmation',
        variantId: 'v1',
        variants,
        debounceMs: 0,
      }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledTimes(1);
  });

  it('@contract stays idle without a restaurant, email or variants', () => {
    setup(() =>
      useOpsEmailTemplatePreview({
        restaurantId: null,
        templateKey: 'confirmation',
        variantId: 'v1',
        variants,
        debounceMs: 0,
      }),
    );
    setup(() =>
      useOpsEmailTemplatePreview({
        restaurantId,
        templateKey: 'confirmation',
        variantId: null,
        variants: [],
        debounceMs: 0,
      }),
    );

    expect(restaurantService.previewEmailTemplate).not.toHaveBeenCalled();
  });
});

describe('useOpsSendRestaurantEmailTemplateTest', () => {
  it('@contract sends through the transport with the per-intent idempotency key', async () => {
    const response = { provider: 'resend' };
    transport.sendTestEmailTemplate.mockResolvedValue(response);

    const { result } = renderHook(() => useOpsSendRestaurantEmailTemplateTest(restaurantId), {
      wrapper: transportWrapper(createTestQueryClient()),
    });

    await expect(
      result.current.mutateAsync({
        templateKey: 'confirmation',
        payload: { toEmail: 'ops@example.com' } as never,
        idempotencyKey: 'click-key-1',
      }),
    ).resolves.toEqual(response);

    expect(transport.sendTestEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'confirmation',
      { toEmail: 'ops@example.com' },
      { idempotencyKey: 'click-key-1' },
    );
    expect(restaurantService.sendTestEmailTemplate).not.toHaveBeenCalled();
  });

  it('@contract fails before the transport call without a restaurant id', async () => {
    const { result } = renderHook(() => useOpsSendRestaurantEmailTemplateTest(undefined), {
      wrapper: transportWrapper(createTestQueryClient()),
    });

    await expect(
      result.current.mutateAsync({
        templateKey: 'confirmation',
        payload: { toEmail: 'ops@example.com' } as never,
        idempotencyKey: 'k-1',
      }),
    ).rejects.toThrow('Restaurant id is required');
    expect(transport.sendTestEmailTemplate).not.toHaveBeenCalled();
  });
});
