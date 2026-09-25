import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsEmailTemplatesPageState } from '@src/hooks/ops/useOpsEmailTemplatesPageState';

import type { RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';
import type {
  RestaurantEmailTemplate,
  RestaurantEmailTemplatesSnapshot,
} from '@/services/ops/restaurants';

// Seams: the ops session context, the five template hooks (each covered by its
// own suite), and sonner toasts. Everything else (draft reducers, dirty
// tracking, search, variant CRUD) runs for real.
type SessionState = {
  memberships: Array<{ restaurantId: string; restaurantName: string }>;
  activeRestaurantId: string | null;
  setActiveRestaurantId: ReturnType<typeof vi.fn>;
};

const session = vi.hoisted(() => ({
  state: null as unknown as SessionState,
  activeMembership: null as { restaurantId: string; restaurantName: string } | null,
}));

const templateHooks = vi.hoisted(() => ({
  restaurantIds: [] as Array<string | null>,
  templatesQuery: { data: undefined as RestaurantEmailTemplatesSnapshot | undefined },
  updateMutation: { mutateAsync: vi.fn(), isPending: false },
  resetMutation: { mutateAsync: vi.fn(), isPending: false },
  previewMutation: {
    mutate: vi.fn(),
    data: undefined as { templateKey: string } | undefined,
    isPending: false,
  },
  testSendMutation: { mutateAsync: vi.fn(), isPending: false },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => session.state,
  useOpsActiveMembership: () => session.activeMembership,
}));

vi.mock('@/hooks/ops/useOpsRestaurantEmailTemplates', () => ({
  useOpsRestaurantEmailTemplates: (restaurantId: string | null) => {
    templateHooks.restaurantIds.push(restaurantId);
    return templateHooks.templatesQuery;
  },
  useOpsUpdateRestaurantEmailTemplate: () => templateHooks.updateMutation,
  useOpsResetRestaurantEmailTemplate: () => templateHooks.resetMutation,
  useOpsPreviewRestaurantEmailTemplate: () => templateHooks.previewMutation,
  useOpsSendRestaurantEmailTemplateTest: () => templateHooks.testSendMutation,
}));

vi.mock('sonner', () => ({ toast }));

function makeVariant(
  overrides: Partial<RestaurantEmailTemplateVariant> = {},
): RestaurantEmailTemplateVariant {
  return {
    id: 'confirmation-a',
    name: 'Variant A',
    subject: 'Your booking is confirmed',
    preheader: 'See you soon',
    headline: 'Confirmed',
    intro: 'We look forward to hosting you.',
    cue: 'Check your details.',
    ask: 'Reply if plans change.',
    ctaLabel: 'View booking',
    isActive: true,
    order: 0,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<RestaurantEmailTemplate> = {}): RestaurantEmailTemplate {
  const variants = overrides.variants ?? [makeVariant()];
  return {
    key: 'confirmation',
    title: 'Booking confirmed',
    description: 'Sent right after a guest books.',
    groupKey: 'booking',
    supportsCtaLabel: true,
    availableVariables: [],
    recommendedVariables: [],
    authoringHints: [],
    status: 'default',
    activeVariantCount: variants.filter((variant) => variant.isActive).length,
    defaultVariants: [makeVariant()],
    ...overrides,
    variants,
  } as RestaurantEmailTemplate;
}

function makeSnapshot(): RestaurantEmailTemplatesSnapshot {
  return {
    restaurantId: 'rest-1',
    canEdit: true,
    groups: [
      {
        key: 'booking',
        title: 'Booking lifecycle',
        description: 'Transactional booking emails',
        templates: [
          makeTemplate(),
          makeTemplate({
            key: 'cancelled',
            title: 'Booking cancelled',
            description: 'Sent when a booking is cancelled.',
            status: 'custom',
            variants: [
              makeVariant({ id: 'cancelled-a', name: 'Variant A', order: 0 }),
              makeVariant({ id: 'cancelled-b', name: 'Variant B', order: 1, isActive: false }),
            ],
          }),
        ],
      },
      {
        key: 'reviews',
        title: 'Reviews',
        description: 'Post-visit emails',
        templates: [
          makeTemplate({
            key: 'review_request',
            title: 'Review request',
            description: 'Sent after the visit.',
            variants: [makeVariant({ id: 'review-a' })],
          }),
        ],
      },
    ],
  };
}

function setup() {
  return renderHook(() => useOpsEmailTemplatesPageState());
}

describe('useOpsEmailTemplatesPageState', () => {
  beforeEach(() => {
    session.state = {
      memberships: [{ restaurantId: 'rest-1', restaurantName: 'Cafe One' }],
      activeRestaurantId: 'rest-1',
      setActiveRestaurantId: vi.fn(),
    };
    session.activeMembership = { restaurantId: 'rest-1', restaurantName: 'Cafe One' };
    templateHooks.restaurantIds = [];
    templateHooks.templatesQuery = { data: makeSnapshot() };
    templateHooks.previewMutation.data = undefined;
    templateHooks.updateMutation.mutateAsync.mockResolvedValue({});
    templateHooks.resetMutation.mutateAsync.mockResolvedValue({});
    templateHooks.testSendMutation.mutateAsync.mockResolvedValue({ provider: 'resend' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract resolves the restaurant from the active membership and auto-selects the first template', () => {
    session.activeMembership = { restaurantId: 'rest-2', restaurantName: 'Cafe Two' };

    const { result } = setup();

    expect(result.current.restaurantId).toBe('rest-2');
    expect(result.current.restaurantName).toBe('Cafe Two');
    expect(templateHooks.restaurantIds.at(-1)).toBe('rest-2');
    expect(result.current.selectedTemplateKey).toBe('confirmation');
    expect(result.current.selectedVariantId).toBe('confirmation-a');
    expect(result.current.currentVariant?.id).toBe('confirmation-a');
    expect(result.current.activePane).toBe('list');
    expect(session.state.setActiveRestaurantId).not.toHaveBeenCalled();
  });

  it('@contract falls back to the first membership and pushes it into the session', () => {
    session.activeMembership = null;
    session.state.activeRestaurantId = null;

    const { result } = setup();

    expect(result.current.restaurantId).toBe('rest-1');
    expect(result.current.restaurantName).toBe('Cafe One');
    expect(session.state.setActiveRestaurantId).toHaveBeenCalledWith('rest-1');
  });

  it('@contract exposes an empty state without memberships or templates', () => {
    session.activeMembership = null;
    session.state = {
      memberships: [],
      activeRestaurantId: null,
      setActiveRestaurantId: vi.fn(),
    };
    templateHooks.templatesQuery = { data: undefined };

    const { result } = setup();

    expect(result.current.restaurantId).toBeNull();
    expect(result.current.restaurantName).toBe('Selected restaurant');
    expect(session.state.setActiveRestaurantId).not.toHaveBeenCalled();
    expect(result.current.selectedTemplateKey).toBeNull();
    expect(result.current.selectedVariantId).toBeNull();
    expect(result.current.currentVariants).toEqual([]);
    expect(result.current.currentVariant).toBeNull();
    expect(result.current.filteredGroups).toEqual([]);
    expect(result.current.preview).toBeNull();

    act(() => {
      result.current.handleSelectTemplate('confirmation');
    });
    // Selecting a key that is not in the snapshot immediately falls back to null.
    expect(result.current.selectedTemplateKey).toBeNull();

    void result.current.handleSave();
    void result.current.handleSendTest();
    act(() => result.current.handleAddVariant());
    expect(templateHooks.updateMutation.mutateAsync).not.toHaveBeenCalled();
    expect(templateHooks.testSendMutation.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('@contract handleSelectTemplate switches the template and jumps to the editor pane', () => {
    const { result } = setup();

    act(() => result.current.handleSelectTemplate('cancelled'));

    expect(result.current.selectedTemplateKey).toBe('cancelled');
    expect(result.current.activePane).toBe('editor');
    expect(result.current.selectedVariantId).toBe('cancelled-a');
    expect(result.current.baseTemplate?.title).toBe('Booking cancelled');
    expect(result.current.activeVariantCount).toBe(1);
  });

  it('@contract switching restaurants resets selection, drafts, test email, and pane', async () => {
    const { result, rerender } = setup();

    act(() => result.current.handleSelectTemplate('cancelled'));
    act(() =>
      result.current.updateCurrentVariant('cancelled-a', (variant) => ({
        ...variant,
        subject: 'Edited',
      })),
    );
    act(() => result.current.setTestEmail('ops@example.com'));
    expect(result.current.isCurrentDirty).toBe(true);

    session.activeMembership = { restaurantId: 'rest-2', restaurantName: 'Cafe Two' };
    session.state = { ...session.state, activeRestaurantId: 'rest-2' };
    rerender();

    expect(result.current.restaurantId).toBe('rest-2');
    expect(result.current.activePane).toBe('list');
    expect(result.current.testEmail).toBe('');
    expect(result.current.hasDirtyDrafts).toBe(false);
    // Selection re-seeds from the fresh snapshot's first template.
    expect(result.current.selectedTemplateKey).toBe('confirmation');
    expect(templateHooks.restaurantIds.at(-1)).toBe('rest-2');
  });

  it('@contract filters template groups by title and description and drops empty groups', async () => {
    const { result } = setup();

    expect(result.current.filteredGroups).toHaveLength(2);

    act(() => result.current.setSearchQuery('  REVIEW  '));
    await waitFor(() => expect(result.current.filteredGroups).toHaveLength(1));
    expect(result.current.filteredGroups[0]?.key).toBe('reviews');

    // Matches only the confirmation description, so the booking group keeps one
    // template and the reviews group is dropped.
    act(() => result.current.setSearchQuery('guest books'));
    await waitFor(() => {
      expect(result.current.filteredGroups).toHaveLength(1);
      expect(result.current.filteredGroups[0]?.templates.map((template) => template.key)).toEqual([
        'confirmation',
      ]);
    });

    act(() => result.current.setSearchQuery('no such template'));
    await waitFor(() => expect(result.current.filteredGroups).toHaveLength(0));

    act(() => result.current.setSearchQuery(''));
    await waitFor(() => expect(result.current.filteredGroups).toHaveLength(2));
  });

  it('@contract updateCurrentVariant stages a draft and tracks dirtiness against the base', () => {
    const { result } = setup();

    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        subject: 'Fresh subject',
      })),
    );

    expect(result.current.currentVariant?.subject).toBe('Fresh subject');
    expect(result.current.isCurrentDirty).toBe(true);
    expect(result.current.hasDirtyDrafts).toBe(true);
    expect(result.current.dirtyTemplateKeys.has('confirmation')).toBe(true);
    // The base snapshot is never mutated.
    expect(templateHooks.templatesQuery.data?.groups[0]?.templates[0]?.variants[0]?.subject).toBe(
      'Your booking is confirmed',
    );

    // A draft normalizing back to the base counts as clean.
    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        subject: 'Your booking is confirmed',
      })),
    );
    expect(result.current.isCurrentDirty).toBe(false);
    expect(result.current.hasDirtyDrafts).toBe(false);
  });

  it('@contract handleAddVariant seeds from the current variant and caps at the maximum', () => {
    const { result } = setup();

    act(() => result.current.handleAddVariant());

    expect(result.current.currentVariants).toHaveLength(2);
    const added = result.current.currentVariants[1]!;
    expect(added.name).toBe('Variant B');
    expect(added.order).toBe(1);
    expect(added.isActive).toBe(true);
    expect(added.subject).toBe('Your booking is confirmed');
    expect(added.id).toMatch(/^confirmation-/);
    expect(added.id).not.toBe('confirmation-a');
    expect(result.current.selectedVariantId).toBe(added.id);

    act(() => result.current.handleAddVariant());
    act(() => result.current.handleAddVariant());
    act(() => result.current.handleAddVariant());
    expect(result.current.currentVariants).toHaveLength(5);
    expect(result.current.activeVariantCount).toBe(5);

    act(() => result.current.handleAddVariant());
    expect(result.current.currentVariants).toHaveLength(5);
  });

  it('@contract handleMoveVariant reorders variants and ignores out-of-bounds moves', () => {
    const { result } = setup();
    act(() => result.current.handleSelectTemplate('cancelled'));

    act(() => result.current.handleMoveVariant('cancelled-b', -1));
    expect(result.current.currentVariants.map((variant) => variant.id)).toEqual([
      'cancelled-b',
      'cancelled-a',
    ]);
    expect(result.current.currentVariants.map((variant) => variant.order)).toEqual([0, 1]);

    // Already first: moving up again is a no-op.
    act(() => result.current.handleMoveVariant('cancelled-b', -1));
    expect(result.current.currentVariants.map((variant) => variant.id)).toEqual([
      'cancelled-b',
      'cancelled-a',
    ]);
  });

  it('@contract handleDeleteVariant refuses the last variant and reselects after deletes', () => {
    const { result } = setup();

    act(() => result.current.handleDeleteVariant('confirmation-a'));
    expect(toast.error).toHaveBeenCalledWith('Each template needs at least one variant.');
    expect(result.current.currentVariants).toHaveLength(1);

    act(() => result.current.handleSelectTemplate('cancelled'));
    expect(result.current.selectedVariantId).toBe('cancelled-a');

    act(() => result.current.handleDeleteVariant('cancelled-a'));
    expect(result.current.currentVariants.map((variant) => variant.id)).toEqual(['cancelled-b']);
    expect(result.current.currentVariants[0]?.order).toBe(0);
    expect(result.current.selectedVariantId).toBe('cancelled-b');
  });

  it('@contract handleDiscardCurrent drops the staged draft', () => {
    const { result } = setup();

    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        headline: 'Changed',
      })),
    );
    expect(result.current.isCurrentDirty).toBe(true);

    act(() => result.current.handleDiscardCurrent());

    expect(result.current.isCurrentDirty).toBe(false);
    expect(result.current.currentVariant?.headline).toBe('Confirmed');
  });

  it('@contract handleSave persists the draft variants then clears the draft', async () => {
    const { result } = setup();

    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        subject: 'Saved subject',
      })),
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(templateHooks.updateMutation.mutateAsync).toHaveBeenCalledWith({
      templateKey: 'confirmation',
      variants: [expect.objectContaining({ id: 'confirmation-a', subject: 'Saved subject' })],
    });
    expect(result.current.isCurrentDirty).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Template saved', {
      description: 'Restaurant-specific copy variants are now live for future sends.',
    });
  });

  it('@contract handleSave surfaces failures and keeps the draft', async () => {
    templateHooks.updateMutation.mutateAsync.mockRejectedValue(new Error('DB down'));
    const { result } = setup();

    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        subject: 'Unsaved subject',
      })),
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(toast.error).toHaveBeenCalledWith('Save failed', { description: 'DB down' });
    expect(result.current.isCurrentDirty).toBe(true);
    expect(result.current.currentVariant?.subject).toBe('Unsaved subject');
  });

  it('keeps a field typed while the template was saving and takes the server values for the rest', async () => {
    let resolveSave: (template: RestaurantEmailTemplate) => void = () => undefined;
    templateHooks.updateMutation.mutateAsync.mockImplementation(
      () =>
        new Promise<RestaurantEmailTemplate>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const { result, rerender } = setup();

    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        subject: '  Sent subject ',
      })),
    );

    let saving: Promise<void> = Promise.resolve();
    act(() => {
      saving = result.current.handleSave();
    });
    expect(templateHooks.updateMutation.mutateAsync).toHaveBeenCalledWith({
      templateKey: 'confirmation',
      variants: [expect.objectContaining({ subject: '  Sent subject ' })],
    });

    // Staff keep typing while the request is in flight.
    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        headline: 'Typed during save',
      })),
    );

    // The server trims the subject; the refetched list and the response both carry it.
    const serverVariants = [makeVariant({ subject: 'Sent subject' })];
    const serverSnapshot = makeSnapshot();
    serverSnapshot.groups[0]!.templates[0] = makeTemplate({
      status: 'custom',
      variants: serverVariants,
    });
    templateHooks.templatesQuery = { data: serverSnapshot };
    rerender();
    await act(async () => {
      resolveSave(makeTemplate({ status: 'custom', variants: serverVariants }));
      await saving;
    });

    expect(result.current.currentVariant).toEqual(
      makeVariant({ subject: 'Sent subject', headline: 'Typed during save' }),
    );
    expect(result.current.isCurrentDirty).toBe(true);

    act(() => result.current.handleDiscardCurrent());
    expect(result.current.currentVariant).toEqual(makeVariant({ subject: 'Sent subject' }));
    expect(result.current.isCurrentDirty).toBe(false);
  });

  it('@contract handleResetTemplate only resets custom templates after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = setup();

    // Default templates never prompt or reset.
    await act(async () => {
      await result.current.handleResetTemplate('confirmation');
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(templateHooks.resetMutation.mutateAsync).not.toHaveBeenCalled();

    // Declining the prompt keeps the custom template untouched.
    await act(async () => {
      await result.current.handleResetTemplate('cancelled');
    });
    expect(confirmSpy).toHaveBeenCalledWith(
      'Reset "Booking cancelled" back to the system default variants?',
    );
    expect(templateHooks.resetMutation.mutateAsync).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    act(() => result.current.handleSelectTemplate('cancelled'));
    act(() =>
      result.current.updateCurrentVariant('cancelled-a', (variant) => ({
        ...variant,
        subject: 'Draft to discard',
      })),
    );

    await act(async () => {
      await result.current.handleResetTemplate('cancelled');
    });

    expect(templateHooks.resetMutation.mutateAsync).toHaveBeenCalledWith({
      templateKey: 'cancelled',
    });
    expect(result.current.isCurrentDirty).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Template reset', {
      description: 'Booking cancelled is using the default copy again.',
    });
  });

  it('@contract handleResetTemplate surfaces reset failures', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    templateHooks.resetMutation.mutateAsync.mockRejectedValue(new Error('nope'));
    const { result } = setup();

    await act(async () => {
      await result.current.handleResetTemplate('cancelled');
    });

    expect(toast.error).toHaveBeenCalledWith('Reset failed', { description: 'nope' });
  });

  it('@contract handleSendTest validates the address then sends the current variants', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleSendTest();
    });
    expect(toast.error).toHaveBeenCalledWith('Enter a test email address first.');
    expect(templateHooks.testSendMutation.mutateAsync).not.toHaveBeenCalled();

    act(() => result.current.setTestEmail('  ops@example.com  '));
    await act(async () => {
      await result.current.handleSendTest();
    });

    expect(templateHooks.testSendMutation.mutateAsync).toHaveBeenCalledWith({
      templateKey: 'confirmation',
      payload: {
        toEmail: 'ops@example.com',
        preferredVariantId: 'confirmation-a',
        variants: [expect.objectContaining({ id: 'confirmation-a' })],
      },
    });
    expect(toast.success).toHaveBeenCalledWith('Test email sent', {
      description: 'Delivered to ops@example.com via resend.',
    });

    templateHooks.testSendMutation.mutateAsync.mockRejectedValue(new Error('SMTP down'));
    await act(async () => {
      await result.current.handleSendTest();
    });
    expect(toast.error).toHaveBeenCalledWith('Test send failed', { description: 'SMTP down' });
  });

  it('@contract debounces draft previews by 180ms and collapses rapid edits', () => {
    vi.useFakeTimers();
    const { result } = setup();

    act(() => {
      vi.advanceTimersByTime(179);
    });
    expect(templateHooks.previewMutation.mutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(templateHooks.previewMutation.mutate).toHaveBeenCalledTimes(1);
    expect(templateHooks.previewMutation.mutate).toHaveBeenCalledWith({
      templateKey: 'confirmation',
      payload: {
        preferredVariantId: 'confirmation-a',
        variants: [expect.objectContaining({ id: 'confirmation-a' })],
      },
    });

    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        intro: 'First edit',
      })),
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        intro: 'Second edit',
      })),
    );
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(templateHooks.previewMutation.mutate).toHaveBeenCalledTimes(2);
    expect(templateHooks.previewMutation.mutate).toHaveBeenLastCalledWith({
      templateKey: 'confirmation',
      payload: {
        preferredVariantId: 'confirmation-a',
        variants: [expect.objectContaining({ intro: 'Second edit' })],
      },
    });
  });

  it('@contract exposes the preview only when it matches the selected template', () => {
    templateHooks.previewMutation.data = { templateKey: 'confirmation' };
    const { result } = setup();

    expect(result.current.preview).toEqual({ templateKey: 'confirmation' });

    act(() => result.current.handleSelectTemplate('cancelled'));
    expect(result.current.preview).toBeNull();
  });

  it('@contract blocks unload only while drafts are dirty', () => {
    const { result } = setup();

    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    act(() =>
      result.current.updateCurrentVariant('confirmation-a', (variant) => ({
        ...variant,
        ask: 'Different ask',
      })),
    );

    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });
});
