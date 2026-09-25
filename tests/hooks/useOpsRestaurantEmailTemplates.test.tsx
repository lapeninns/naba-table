import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import {
  useOpsPreviewRestaurantEmailTemplate,
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

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, invalidateSpy, ...renderHook(hook, { wrapper }) };
}

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
  it('@contract updates the template and invalidates the snapshot cache', async () => {
    const template = { key: 'booking_confirmed', variants: [] };
    restaurantService.updateEmailTemplate.mockResolvedValue(template);

    const { result, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantEmailTemplate(restaurantId),
    );

    await result.current.mutateAsync({
      templateKey: 'booking_confirmed' as never,
      variants: [] as never,
    });

    expect(restaurantService.updateEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'booking_confirmed',
      { variants: [] },
    );
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

describe('useOpsPreviewRestaurantEmailTemplate', () => {
  it('@contract previews the template with the optional payload', async () => {
    const preview = { templateKey: 'booking_confirmed', html: '<p>Hi</p>' };
    restaurantService.previewEmailTemplate.mockResolvedValue(preview);

    const { result } = setup(() => useOpsPreviewRestaurantEmailTemplate(restaurantId));

    await expect(
      result.current.mutateAsync({
        templateKey: 'booking_confirmed' as never,
        payload: { preferredVariantId: 'variant-1' } as never,
      }),
    ).resolves.toEqual(preview);

    expect(restaurantService.previewEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'booking_confirmed',
      { preferredVariantId: 'variant-1' },
    );
  });
});

describe('useOpsSendRestaurantEmailTemplateTest', () => {
  it('@contract sends the test email through the service', async () => {
    const response = { provider: 'resend' };
    restaurantService.sendTestEmailTemplate.mockResolvedValue(response);

    const { result } = setup(() => useOpsSendRestaurantEmailTemplateTest(restaurantId));

    await expect(
      result.current.mutateAsync({
        templateKey: 'booking_confirmed' as never,
        payload: { toEmail: 'ops@example.com' } as never,
      }),
    ).resolves.toEqual(response);

    expect(restaurantService.sendTestEmailTemplate).toHaveBeenCalledWith(
      restaurantId,
      'booking_confirmed',
      { toEmail: 'ops@example.com' },
    );
  });

  it('@contract fails before the service call without a restaurant id', async () => {
    const { result } = setup(() => useOpsSendRestaurantEmailTemplateTest(undefined));

    await expect(
      result.current.mutateAsync({
        templateKey: 'booking_confirmed' as never,
        payload: { toEmail: 'ops@example.com' } as never,
      }),
    ).rejects.toThrow('Restaurant id is required');
    expect(restaurantService.sendTestEmailTemplate).not.toHaveBeenCalled();
  });
});
