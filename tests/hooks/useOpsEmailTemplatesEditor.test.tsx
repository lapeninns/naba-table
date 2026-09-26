import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { getDefaultTemplateVariants } from '@/lib/restaurants/email-templates';
import { useOpsEmailTemplatesEditor } from '@src/hooks/ops/useOpsEmailTemplatesEditor';

import type * as EmailTemplateHooks from '@/hooks/ops/useOpsRestaurantEmailTemplates';
import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';
import type {
  RestaurantEmailTemplate,
  RestaurantEmailTemplatesSnapshot,
} from '@/services/ops/restaurants';

// Seams: the ops session, the server data hooks (each covered by its own suite) and sonner.
// Drafts, validation, selection and the save flow run for real.
type SessionState = {
  memberships: Array<{ restaurantId: string; restaurantName: string }>;
  activeRestaurantId: string | null;
  setActiveRestaurantId: ReturnType<typeof vi.fn>;
};

const session = vi.hoisted(() => ({
  state: null as unknown as SessionState,
  activeMembership: null as { restaurantId: string; restaurantName: string } | null,
}));

const data = vi.hoisted(() => ({
  templatesQuery: { data: undefined as RestaurantEmailTemplatesSnapshot | undefined },
  updateMutation: { mutateAsync: vi.fn(), isPending: false },
  resetMutation: { mutateAsync: vi.fn(), isPending: false },
  testSendMutation: { mutateAsync: vi.fn(), isPending: false },
  previewArgs: [] as Array<{ templateKey: string | null; variantId: string | null }>,
  previewQuery: { data: undefined, error: null as unknown, refetch: vi.fn() },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => session.state,
  useOpsActiveMembership: () => session.activeMembership,
}));

vi.mock('@/hooks/ops/useOpsRestaurantEmailTemplates', async (importOriginal) => ({
  TEST_SEND_ERROR_COPY: (await importOriginal<typeof EmailTemplateHooks>()).TEST_SEND_ERROR_COPY,
  useOpsRestaurantEmailTemplates: () => data.templatesQuery,
  useOpsUpdateRestaurantEmailTemplate: () => data.updateMutation,
  useOpsResetRestaurantEmailTemplate: () => data.resetMutation,
  useOpsSendRestaurantEmailTemplateTest: () => data.testSendMutation,
  useOpsEmailTemplatePreview: (args: { templateKey: string | null; variantId: string | null }) => {
    data.previewArgs.push({ templateKey: args.templateKey, variantId: args.variantId });
    return data.previewQuery;
  },
}));

vi.mock('sonner', () => ({ toast }));

function template(
  key: RestaurantBookingEmailTemplateKey,
  title: string,
  overrides: Partial<RestaurantEmailTemplate> = {},
): RestaurantEmailTemplate {
  const variants = overrides.variants ?? getDefaultTemplateVariants(key);
  return {
    key,
    title,
    description: `${title} description`,
    groupKey: 'g',
    supportsCtaLabel: true,
    availableVariables: [],
    recommendedVariables: [],
    authoringHints: [],
    status: 'default',
    activeVariantCount: variants.filter((variant) => variant.isActive).length,
    defaultVariants: getDefaultTemplateVariants(key),
    ...overrides,
    variants,
  };
}

function snapshot(): RestaurantEmailTemplatesSnapshot {
  return {
    restaurantId: 'rest-1',
    canEdit: true,
    groups: [
      {
        key: 'confirmation',
        title: 'Confirmation',
        description: '',
        templates: [template('confirmation', 'Confirmation')],
      },
      {
        key: 'cancellation',
        title: 'Cancellation',
        description: '',
        templates: [template('cancelled', 'Cancelled', { status: 'custom' })],
      },
    ],
  };
}

function setup() {
  return renderHook(() => useOpsEmailTemplatesEditor());
}

beforeEach(() => {
  session.state = {
    memberships: [{ restaurantId: 'rest-1', restaurantName: 'The White Horse' }],
    activeRestaurantId: 'rest-1',
    setActiveRestaurantId: vi.fn(),
  };
  session.activeMembership = { restaurantId: 'rest-1', restaurantName: 'The White Horse' };
  data.templatesQuery = { data: snapshot() };
  data.updateMutation = { mutateAsync: vi.fn(), isPending: false };
  data.resetMutation = { mutateAsync: vi.fn(), isPending: false };
  data.testSendMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  data.previewArgs = [];
  data.previewQuery = { data: undefined, error: null, refetch: vi.fn() };
  Object.values(toast).forEach((fn) => fn.mockReset());
});

describe('useOpsEmailTemplatesEditor', () => {
  it('@contract opens the first email and its first variant, and previews it', () => {
    const { result } = setup();

    expect(result.current.templateKey).toBe('confirmation');
    expect(result.current.variant?.id).toBe(getDefaultTemplateVariants('confirmation')[0]!.id);
    expect(result.current.templateCount).toBe(2);
    expect(result.current.customisedCount).toBe(1);
    expect(data.previewArgs.at(-1)).toEqual({
      templateKey: 'confirmation',
      variantId: result.current.variant?.id,
    });
  });

  it('@contract filters the list by title, description or key and drops empty groups', () => {
    const { result } = setup();

    act(() => result.current.setSearch('cancel'));

    expect(result.current.groups.map((group) => group.key)).toEqual(['cancellation']);
    expect(result.current.groups[0]?.templates[0]).toMatchObject({
      key: 'cancelled',
      isCustom: true,
      liveCount: 3,
      isDirty: false,
    });
  });

  it('@contract tracks an edit as an unsaved draft on the email and in the list', () => {
    const { result } = setup();

    act(() => result.current.editField('subject', 'New subject'));

    expect(result.current.variant?.subject).toBe('New subject');
    expect(result.current.isDirty).toBe(true);
    expect(result.current.groups[0]?.templates[0]?.isDirty).toBe(true);

    act(() => result.current.selectTemplate('cancelled'));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.otherDirtyTitles).toEqual(['Confirmation']);
  });

  it('@contract adds and duplicates variants paused, up to five', () => {
    const { result } = setup();

    act(() => result.current.addVariant());
    expect(result.current.variant).toMatchObject({ name: 'Variant 4', isActive: false, order: 3 });

    act(() => result.current.duplicateVariant());
    expect(result.current.variants).toHaveLength(5);
    expect(result.current.canAddVariant).toBe(false);

    act(() => result.current.addVariant());
    expect(result.current.variants).toHaveLength(5);
  });

  it('@contract deletes the open variant, opens its neighbour, and never deletes the last one', () => {
    const { result } = setup();
    const [first, second] = result.current.variants;

    act(() => result.current.deleteVariant());
    expect(result.current.variants.map((variant) => variant.id)).not.toContain(first!.id);
    expect(result.current.variant?.id).toBe(second!.id);

    act(() => result.current.deleteVariant());
    act(() => result.current.deleteVariant());
    expect(result.current.variants).toHaveLength(1);
  });

  it('@contract blocks a save with problems, opens the variant with the first one and shows all problems', async () => {
    const { result } = setup();
    const second = result.current.variants[1]!;
    act(() => result.current.selectVariant(second.id));
    act(() => result.current.editField('intro', 'Hi {{guest}}'));
    act(() => result.current.selectVariant(result.current.variants[0]!.id));

    let outcome: Awaited<ReturnType<typeof result.current.save>> | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });

    expect(outcome).toEqual({
      status: 'blocked',
      blocker: expect.objectContaining({ kind: 'field', variantId: second.id, field: 'intro' }),
    });
    expect(result.current.variant?.id).toBe(second.id);
    expect(result.current.showAllProblems).toBe(true);
    expect(data.updateMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('@contract saves the draft with contiguous order and clears it', async () => {
    const { result } = setup();
    act(() => result.current.editField('subject', 'Saved subject'));
    const sent = result.current.variants;
    data.updateMutation.mutateAsync.mockResolvedValue({
      ...template('confirmation', 'Confirmation', { status: 'custom' }),
      variants: sent,
    });

    let outcome: Awaited<ReturnType<typeof result.current.save>> | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });

    expect(outcome).toEqual({ status: 'saved' });
    expect(data.updateMutation.mutateAsync).toHaveBeenCalledWith({
      templateKey: 'confirmation',
      variants: sent.map((variant, order) => ({ ...variant, order })),
    });
    expect(toast.success).toHaveBeenCalledWith('Confirmation saved', expect.any(Object));
  });

  it('@contract keeps the draft and a safe message when the save fails', async () => {
    const { result } = setup();
    act(() => result.current.editField('subject', 'Unsaved subject'));
    data.updateMutation.mutateAsync.mockRejectedValue(
      new HttpError({ status: 500, message: 'SECRET_DB_DETAIL relation "x" does not exist' }),
    );

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.saveError).toEqual(expect.any(String));
    expect(result.current.saveError).not.toContain('SECRET_DB_DETAIL');

    act(() => result.current.editField('subject', 'Edited again'));
    expect(result.current.saveError).toBeNull();
  });

  it('@contract resets only customised emails and drops their draft', async () => {
    const { result } = setup();

    await act(async () => {
      expect(await result.current.reset()).toBe(false);
    });
    expect(data.resetMutation.mutateAsync).not.toHaveBeenCalled();

    act(() => result.current.selectTemplate('cancelled'));
    act(() => result.current.editField('subject', 'Draft'));
    data.resetMutation.mutateAsync.mockResolvedValue({});

    await act(async () => {
      expect(await result.current.reset()).toBe(true);
    });
    expect(data.resetMutation.mutateAsync).toHaveBeenCalledWith({ templateKey: 'cancelled' });
    expect(result.current.isDirty).toBe(false);
  });

  it('@contract sends a test of only the open variant, so an unfinished sibling cannot block it', async () => {
    const { result } = setup();
    const second = result.current.variants[1]!;
    act(() => result.current.selectVariant(second.id));

    await act(async () => {
      await result.current.sendTest(' owner@example.com ');
    });

    expect(data.testSendMutation.mutateAsync).toHaveBeenCalledWith({
      templateKey: 'confirmation',
      payload: {
        toEmail: 'owner@example.com',
        preferredVariantId: second.id,
        variants: [{ ...second, order: 0 }],
      },
      idempotencyKey: expect.any(String),
    });
  });

  it('@contract reuses the test-send key when the same send is retried after a failure', async () => {
    const { result } = setup();
    data.testSendMutation.mutateAsync
      .mockRejectedValueOnce(new HttpError({ status: 502, message: 'provider timeout' }))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const keyOfCall = (index: number) =>
      (data.testSendMutation.mutateAsync.mock.calls[index]![0] as { idempotencyKey: string })
        .idempotencyKey;

    await act(async () => {
      expect(await result.current.sendTest('owner@example.com')).toBe(false);
    });
    await act(async () => {
      expect(await result.current.sendTest(' Owner@example.com')).toBe(true);
    });
    // Same intent (email, address, draft): the provider deduplicates the retry.
    expect(keyOfCall(1)).toBe(keyOfCall(0));

    await act(async () => {
      await result.current.sendTest('owner@example.com');
    });
    // A completed send starts a new intent.
    expect(keyOfCall(2)).not.toBe(keyOfCall(1));
  });

  it('@contract starts a new test-send key for a different address or draft', async () => {
    const { result } = setup();
    data.testSendMutation.mutateAsync.mockRejectedValue(new HttpError({ status: 502 }));
    const keys = () =>
      data.testSendMutation.mutateAsync.mock.calls.map(
        ([variables]) => (variables as { idempotencyKey: string }).idempotencyKey,
      );

    await act(async () => {
      await result.current.sendTest('owner@example.com');
    });
    await act(async () => {
      await result.current.sendTest('manager@example.com');
    });
    act(() => result.current.editField('subject', 'A new subject'));
    await act(async () => {
      await result.current.sendTest('manager@example.com');
    });

    expect(new Set(keys()).size).toBe(3);
  });

  it('@contract shows test-send failures through toUserMessage copy, never the raw message', async () => {
    const { result } = setup();
    data.testSendMutation.mutateAsync
      .mockRejectedValueOnce(
        new HttpError({
          status: 409,
          code: 'RECIPIENT_SUPPRESSED',
          message: 'suppressed in resend_suppressions row 42',
        }),
      )
      .mockRejectedValueOnce(
        new HttpError({ status: 500, message: 'SECRET_PROVIDER_DETAIL re_live_key' }),
      );

    await act(async () => {
      await result.current.sendTest('owner@example.com');
    });
    await act(async () => {
      await result.current.sendTest('owner@example.com');
    });

    expect(toast.error).toHaveBeenNthCalledWith(1, 'Test not sent', {
      description: 'That address is blocked after a bounce or complaint. Use a different address.',
    });
    expect(toast.error).toHaveBeenNthCalledWith(2, 'Test not sent', {
      description: 'Something went wrong on our side. Try again.',
    });
  });

  it('@contract exposes preview failures as C1 copy with a retry, never promising an automatic refresh', () => {
    data.previewQuery = {
      data: undefined,
      error: new HttpError({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Rate limit bucket ops:preview:rest-1 exhausted',
      }),
      refetch: vi.fn(),
    };
    const { result } = setup();

    expect(result.current.previewErrorMessage).toBe(
      'The preview is paused after too many updates. Wait a moment, then retry the preview.',
    );
    expect(result.current.previewErrorMessage).not.toMatch(/automatic|bucket/i);

    act(() => result.current.retryPreview());
    expect(data.previewQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract has no preview error message while the preview is healthy', () => {
    const { result } = setup();

    expect(result.current.previewErrorMessage).toBeNull();
  });

  it('@contract previews another variant without changing the one being edited', () => {
    const { result } = setup();
    const third = result.current.variants[2]!;

    act(() => result.current.setPreviewVariantId(third.id));

    expect(result.current.previewVariant?.id).toBe(third.id);
    expect(result.current.variant?.id).not.toBe(third.id);
    expect(data.previewArgs.at(-1)?.variantId).toBe(third.id);
  });

  it('@contract drops drafts and selection when the restaurant changes', () => {
    const { result, rerender } = setup();
    act(() => result.current.selectTemplate('cancelled'));
    act(() => result.current.editField('subject', 'Draft'));

    session.activeMembership = { restaurantId: 'rest-2', restaurantName: 'The Bell' };
    rerender();

    expect(result.current.templateKey).toBe('confirmation');
    expect(result.current.otherDirtyTitles).toEqual([]);
    expect(result.current.isDirty).toBe(false);
  });

  it('@contract makes no changes for view-only members', () => {
    data.templatesQuery = { data: { ...snapshot(), canEdit: false } };
    const { result } = setup();

    act(() => result.current.editField('subject', 'x'));
    act(() => result.current.addVariant());

    expect(result.current.isDirty).toBe(false);
    expect(result.current.variants).toHaveLength(3);
  });
});
