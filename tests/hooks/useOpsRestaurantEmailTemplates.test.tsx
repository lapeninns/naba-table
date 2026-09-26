import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { EmailTemplatesTransportProvider } from '@src/hooks/ops/emailTemplatesTransport';
import {
  useOpsResetRestaurantEmailTemplate,
  useOpsRestaurantEmailTemplatePreview,
  useOpsRestaurantEmailTemplates,
  useOpsSendRestaurantEmailTemplateTest,
  useOpsUpdateRestaurantEmailTemplate,
  type EmailTemplatePreviewRequest,
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

const restaurantId = 'rest-1';
const templatesKey = queryKeys.opsRestaurants.emailTemplates(restaurantId);
const snapshot = { groups: [{ title: 'Booking', templates: [] }] };

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EmailTemplatesTransportProvider transport={transport}>{children}</EmailTemplatesTransportProvider>
      </QueryClientProvider>
    );
  };
}

function setup<T>(hook: () => T, queryClient: QueryClient = createTestQueryClient()) {
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = createWrapper(queryClient);
  return { queryClient, invalidateSpy, ...renderHook(hook, { wrapper }) };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
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

describe('useOpsUpdateRestaurantEmailTemplate', () => {
  it('@contract writes the saved template into the cached snapshot without a refetch', async () => {
    const template = { key: 'confirmation', title: 'Confirmed', variants: [{ id: 'v1' }] };
    restaurantService.updateEmailTemplate.mockResolvedValue(template);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(templatesKey, {
      restaurantId,
      canEdit: true,
      groups: [
        {
          key: 'booking',
          templates: [
            { key: 'confirmation', title: 'Old', variants: [] },
            { key: 'cancelled', title: 'Other', variants: [] },
          ],
        },
      ],
    });

    const { result, invalidateSpy } = setup(
      () => useOpsUpdateRestaurantEmailTemplate(restaurantId),
      queryClient,
    );

    await result.current.mutateAsync({
      templateKey: 'confirmation' as never,
      variants: [] as never,
    });

    expect(restaurantService.updateEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'confirmation',
      { variants: [] },
    );
    expect(invalidateSpy).not.toHaveBeenCalled();
    const cached = queryClient.getQueryData<{
      groups: Array<{ templates: Array<{ key: string; title: string }> }>;
    }>(templatesKey);
    expect(cached?.groups[0]?.templates.map((entry) => entry.title)).toEqual([
      'Confirmed',
      'Other',
    ]);
  });

  it('@contract invalidates the snapshot when it is not cached', async () => {
    restaurantService.updateEmailTemplate.mockResolvedValue({ key: 'confirmation', variants: [] });

    const { result, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantEmailTemplate(restaurantId),
    );

    await result.current.mutateAsync({
      templateKey: 'confirmation' as never,
      variants: [] as never,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: templatesKey });
  });

  it('@contract fails before the service call without a restaurant id', async () => {
    const { result } = setup(() => useOpsUpdateRestaurantEmailTemplate(null));

    await expect(
      result.current.mutateAsync({
        templateKey: 'booking_confirmed' as never,
        variants: [] as never,
      }),
    ).rejects.toThrow('Restaurant id is required');
    expect(restaurantService.updateEmailTemplate).not.toHaveBeenCalled();
  });
});

describe('useOpsResetRestaurantEmailTemplate', () => {
  it('@contract resets the template and invalidates the snapshot cache', async () => {
    restaurantService.resetEmailTemplate.mockResolvedValue({ key: 'booking_confirmed' });

    const { result, invalidateSpy } = setup(() => useOpsResetRestaurantEmailTemplate(restaurantId));

    await result.current.mutateAsync({ templateKey: 'booking_confirmed' as never });

    expect(restaurantService.resetEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'booking_confirmed',
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: templatesKey });
  });
});

function previewRequest(intro: string): EmailTemplatePreviewRequest {
  return {
    templateKey: 'confirmation',
    payload: {
      preferredVariantId: 'v1',
      variants: [
        {
          id: 'v1',
          name: 'A',
          subject: 'S',
          preheader: 'P',
          headline: 'H',
          intro,
          cue: '',
          ask: '',
          ctaLabel: 'Go',
          isActive: true,
          order: 0,
        },
      ],
    },
  };
}

describe('useOpsRestaurantEmailTemplatePreview', () => {
  it('@contract renders the first draft at once, then debounces edits into one request', async () => {
    vi.useFakeTimers();
    transport.previewEmailTemplate.mockResolvedValue({ templateKey: 'confirmation', html: 'v1' });

    const { result, rerender } = renderHook(
      ({ request }: { request: EmailTemplatePreviewRequest }) =>
        useOpsRestaurantEmailTemplatePreview(restaurantId, request),
      {
        wrapper: createWrapper(createTestQueryClient()),
        initialProps: { request: previewRequest('first') },
      },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(transport.previewEmailTemplate).toHaveBeenCalledTimes(1);

    // Keystrokes inside the debounce window never reach the server.
    rerender({ request: previewRequest('second') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    rerender({ request: previewRequest('third') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.isPreviewStale).toBe(true);
    expect(transport.previewEmailTemplate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(transport.previewEmailTemplate).toHaveBeenCalledTimes(2);
    expect(transport.previewEmailTemplate).toHaveBeenLastCalledWith(
      restaurantId,
      'confirmation',
      expect.objectContaining({
        variants: [expect.objectContaining({ intro: 'third' })],
      }),
      { signal: expect.any(AbortSignal) },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).toEqual({ templateKey: 'confirmation', html: 'v1' });
    expect(result.current.isPreviewStale).toBe(false);
  });

  it('@contract keeps the previous render on screen while the next draft loads', async () => {
    vi.useFakeTimers();
    let resolveSecond: (value: unknown) => void = () => undefined;
    transport.previewEmailTemplate
      .mockResolvedValueOnce({ templateKey: 'confirmation', html: 'first' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result, rerender } = renderHook(
      ({ request }: { request: EmailTemplatePreviewRequest }) =>
        useOpsRestaurantEmailTemplatePreview(restaurantId, request),
      {
        wrapper: createWrapper(createTestQueryClient()),
        initialProps: { request: previewRequest('first') },
      },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.data).toEqual({ templateKey: 'confirmation', html: 'first' });

    rerender({ request: previewRequest('second') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(transport.previewEmailTemplate).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual({ templateKey: 'confirmation', html: 'first' });
    expect(result.current.isPreviewStale).toBe(true);

    await act(async () => {
      resolveSecond({ templateKey: 'confirmation', html: 'second' });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).toEqual({ templateKey: 'confirmation', html: 'second' });
  });

  it('@contract reuses the cached render of an unchanged draft', async () => {
    vi.useFakeTimers();
    transport.previewEmailTemplate.mockResolvedValue({ templateKey: 'confirmation', html: 'x' });

    const { rerender } = renderHook(
      ({ request }: { request: EmailTemplatePreviewRequest }) =>
        useOpsRestaurantEmailTemplatePreview(restaurantId, request),
      {
        wrapper: createWrapper(createTestQueryClient()),
        initialProps: { request: previewRequest('same') },
      },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    // A new object with identical content is the same draft.
    rerender({ request: previewRequest('same') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(transport.previewEmailTemplate).toHaveBeenCalledTimes(1);
  });

  it('@contract surfaces a rate-limited preview without retrying it', async () => {
    transport.previewEmailTemplate.mockRejectedValue(
      new HttpError({ status: 429, code: 'RATE_LIMITED', message: 'Too many' }),
    );

    const { result } = setup(() =>
      useOpsRestaurantEmailTemplatePreview(restaurantId, previewRequest('x'), { debounceMs: 0 }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(transport.previewEmailTemplate).toHaveBeenCalledTimes(1);
  });

  it('@contract stays idle without a draft', () => {
    setup(() => useOpsRestaurantEmailTemplatePreview(restaurantId, null, { debounceMs: 0 }));

    expect(transport.previewEmailTemplate).not.toHaveBeenCalled();
  });
});

describe('useOpsSendRestaurantEmailTemplateTest', () => {
  it('@contract sends through the transport with the per-click idempotency key', async () => {
    const response = { provider: 'resend' };
    transport.sendTestEmailTemplate.mockResolvedValue(response);

    const { result } = setup(() => useOpsSendRestaurantEmailTemplateTest(restaurantId));

    await expect(
      result.current.mutateAsync({
        templateKey: 'booking_confirmed' as never,
        payload: { toEmail: 'ops@example.com' } as never,
        idempotencyKey: 'click-key-1',
      }),
    ).resolves.toEqual(response);

    expect(transport.sendTestEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'booking_confirmed',
      { toEmail: 'ops@example.com' },
      { idempotencyKey: 'click-key-1' },
    );
  });

  it('@contract declares success and error feedback through meta', async () => {
    transport.sendTestEmailTemplate.mockResolvedValue({ provider: 'resend' });
    const { result, queryClient } = setup(() => useOpsSendRestaurantEmailTemplateTest(restaurantId));

    await result.current.mutateAsync({
      templateKey: 'confirmation' as never,
      payload: { toEmail: 'ops@example.com' } as never,
      idempotencyKey: 'k-1',
    });

    const [mutation] = queryClient.getMutationCache().getAll();
    const feedback = mutation?.meta?.feedback;
    expect(typeof feedback?.success).toBe('function');
    expect(
      (feedback?.success as (data: unknown, variables: unknown) => string)(
        {},
        { payload: { toEmail: 'ops@example.com' } },
      ),
    ).toBe('Test email sent to ops@example.com.');
    expect(feedback?.error).toMatchObject({
      copy: { RECIPIENT_SUPPRESSED: expect.any(String) },
    });
  });

  it('@contract fails before the transport call without a restaurant id', async () => {
    const { result } = setup(() => useOpsSendRestaurantEmailTemplateTest(undefined));

    await expect(
      result.current.mutateAsync({
        templateKey: 'booking_confirmed' as never,
        payload: { toEmail: 'ops@example.com' } as never,
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow('Restaurant id is required');
    expect(transport.sendTestEmailTemplate).not.toHaveBeenCalled();
  });
});
