import { describe, expect, it, vi } from 'vitest';

import {
  markDraftStaleAndThrow,
  resolveCanPushServicePeriods,
} from '@/server/google-business-profile/workflowPreflightContext';

function createDraftUpdateClient(result: { error: unknown }) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const builder = {
    error: result.error,
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, value });
      return builder;
    }),
  };
  const update = vi.fn(() => builder);
  const from = vi.fn(() => ({ update }));

  return {
    client: { from },
    filters,
    from,
    update,
  };
}

describe('google business profile workflow preflight context', () => {
  it('marks stale drafts with section, field, reason, and stable error metadata', async () => {
    const { client, filters, from, update } = createDraftUpdateClient({ error: null });

    await expect(
      markDraftStaleAndThrow({
        draft: { id: 'draft-1' } as never,
        staleSections: ['profile'],
        staleFieldKeys: ['profile.name'],
        reason: 'google_changed_after_draft',
        client: client as never,
      }),
    ).rejects.toMatchObject({
      name: 'GBP_DRAFT_STALE',
      message: 'Changes need another check for section: profile',
    });

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_drafts');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'stale',
        stale_sections: ['profile'],
        conflict_metadata: expect.objectContaining({
          staleSections: ['profile'],
          staleFieldKeys: ['profile.name'],
          reason: 'google_changed_after_draft',
          checkedAt: expect.any(String),
        }),
      }),
    );
    expect(filters).toEqual([{ column: 'id', value: 'draft-1' }]);
  });

  it('propagates stale draft update errors before raising domain stale errors', async () => {
    const updateError = new Error('database unavailable');
    const { client } = createDraftUpdateClient({ error: updateError });

    await expect(
      markDraftStaleAndThrow({
        draft: { id: 'draft-1' } as never,
        staleSections: ['profile'],
        client: client as never,
      }),
    ).rejects.toBe(updateError);
  });

  it('returns false when service-period push capability cannot be resolved', () => {
    expect(
      resolveCanPushServicePeriods({
        core: {
          servicePeriods: [
            {
              updatedAt: '2026-05-21T10:00:00.000Z',
            },
          ],
        } as never,
        businessInfo: {} as never,
        lastPulledAt: null,
        lastPushedAt: null,
      }),
    ).toBe(false);
  });
});
