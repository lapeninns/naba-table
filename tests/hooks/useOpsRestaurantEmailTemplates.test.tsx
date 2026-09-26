import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import {
  PREVIEW_DEBOUNCE_MS,
  useOpsEmailTemplatePreview,
  useOpsResetRestaurantEmailTemplate,
  useOpsRestaurantEmailTemplates,
  useOpsSendRestaurantEmailTemplateTest,
  useOpsUpdateRestaurantEmailTemplate,
} from '@src/hooks/ops/useOpsRestaurantEmailTemplates';

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
  it('@contract sends the test email through the service', async () => {
    const response = { provider: 'resend' };
    restaurantService.sendTestEmailTemplate.mockResolvedValue(response);

    const { result } = setup(() => useOpsSendRestaurantEmailTemplateTest(restaurantId));

    await expect(
      result.current.mutateAsync({
        templateKey: 'confirmation',
        payload: { toEmail: 'ops@example.com' } as never,
      }),
    ).resolves.toEqual(response);

    expect(restaurantService.sendTestEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'confirmation',
      { toEmail: 'ops@example.com' },
    );
  });

  it('@contract fails before the service call without a restaurant id', async () => {
    const { result } = setup(() => useOpsSendRestaurantEmailTemplateTest(undefined));

    await expect(
      result.current.mutateAsync({
        templateKey: 'confirmation',
        payload: { toEmail: 'ops@example.com' } as never,
      }),
    ).rejects.toThrow('Restaurant id is required');
    expect(restaurantService.sendTestEmailTemplate).not.toHaveBeenCalled();
  });
});
