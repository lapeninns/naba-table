import { beforeEach, describe, expect, it, vi } from 'vitest';

const readDraftByIdMock = vi.hoisted(() => vi.fn());
const readEventsMock = vi.hoisted(() => vi.fn());
const readLatestPublishJobMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/workflowRepository', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    readDraftById: readDraftByIdMock,
    readEvents: readEventsMock,
    readLatestPublishJob: readLatestPublishJobMock,
  };
});

import { updateGoogleBusinessProfileWorkflowDraftState } from '@/server/google-business-profile/workflowDraftLifecycle';

function buildDraftRow(overrides: Record<string, unknown> = {}) {
  return {
    approved_at: null,
    approved_by_user_id: null,
    conflict_metadata: {},
    core_snapshot_hashes: {},
    created_at: '2026-05-21T10:00:00.000Z',
    created_by_user_id: 'user-1',
    external_profile_id: 'external-1',
    fetched_at: '2026-05-21T09:00:00.000Z',
    id: 'draft-1',
    provider: 'google_business_profile',
    published_at: null,
    published_by_user_id: null,
    restaurant_id: 'rest-1',
    section_diffs: [
      {
        sectionKey: 'profile',
        label: 'Profile',
        status: 'ready',
        summary: '1 change ready.',
        canPublishToNabatable: true,
        canPushToGoogle: true,
        blockedReasons: [],
        items: [
          {
            sectionKey: 'profile',
            fieldKey: 'profile.name',
            label: 'Business name',
            currentValue: 'Nabatable Name',
            providerValue: 'Google Name',
            proposedValue: 'Google Name',
            direction: 'pull_from_gbp',
            status: 'ready',
            selected: false,
            normalizedNabatableValue: 'Nabatable Name',
            normalizedGoogleValue: 'Google Name',
            nabatableValueHash: 'nabatable-hash',
            googleValueHash: 'google-hash',
            capabilities: {
              canImportFromGoogle: true,
              canExportToGoogle: true,
              canIgnore: true,
            },
            blockedReasons: [],
            canPublishToNabatable: true,
            canPushToGoogle: true,
            warnings: [],
          },
        ],
      },
    ],
    selected_approvals: { 'profile.name': false },
    source_snapshot_refs: {},
    stale_sections: [],
    status: 'review_ready',
    updated_at: '2026-05-21T10:00:00.000Z',
    ...overrides,
  };
}

function createDraftUpdateClient(result: { data: unknown; error: unknown }) {
  const filters: Array<{ column: string; operator: 'eq' | 'in'; value: unknown }> = [];
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const builder = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, operator: 'eq', value });
      return builder;
    }),
    in: vi.fn((column: string, value: unknown) => {
      filters.push({ column, operator: 'in', value });
      return builder;
    }),
    maybeSingle,
    select: vi.fn(() => builder),
  };
  const update = vi.fn(() => builder);
  const from = vi.fn(() => ({ update }));

  return {
    client: { from },
    filters,
    from,
    maybeSingle,
    update,
  };
}

describe('google business profile workflow draft lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readDraftByIdMock.mockResolvedValue(buildDraftRow());
    readEventsMock.mockResolvedValue([]);
    readLatestPublishJobMock.mockResolvedValue(null);
  });

  it('updates draft review decisions and approval metadata through a guarded status update', async () => {
    const updatedDraft = buildDraftRow({
      approved_at: '2026-05-21T11:00:00.000Z',
      approved_by_user_id: 'user-2',
      status: 'approved',
    });
    const { client, filters, from, update } = createDraftUpdateClient({
      data: updatedDraft,
      error: null,
    });

    const response = await updateGoogleBusinessProfileWorkflowDraftState({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      actorUserId: 'user-2',
      decisions: [
        {
          sectionKey: 'profile',
          fieldKey: 'profile.name',
          action: 'export_to_google',
          reviewedNabatableValueHash: 'nabatable-hash',
          reviewedGoogleValueHash: 'google-hash',
        },
      ],
      status: 'approved',
      client: client as never,
    });

    expect(response.latestDraft?.id).toBe('draft-1');
    expect(from).toHaveBeenCalledWith('restaurant_external_profile_drafts');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        approved_by_user_id: 'user-2',
        approved_at: expect.any(String),
        selected_approvals: expect.objectContaining({
          'profile.name': true,
          __fieldDecisions: [
            expect.objectContaining({
              sectionKey: 'profile',
              fieldKey: 'profile.name',
              action: 'export_to_google',
              decidedByUserId: 'user-2',
              decidedAt: expect.any(String),
            }),
          ],
        }),
      }),
    );
    expect(filters).toEqual([
      { column: 'id', operator: 'eq', value: 'draft-1' },
      { column: 'restaurant_id', operator: 'eq', value: 'rest-1' },
      { column: 'provider', operator: 'eq', value: 'google_business_profile' },
      {
        column: 'status',
        operator: 'in',
        value: ['review_ready', 'approved', 'failed', 'partially_published'],
      },
    ]);
  });

  it('returns a stable state error when the guarded draft update loses the race', async () => {
    const { client } = createDraftUpdateClient({ data: null, error: null });

    await expect(
      updateGoogleBusinessProfileWorkflowDraftState({
        restaurantId: 'rest-1',
        draftId: 'draft-1',
        actorUserId: 'user-2',
        selectedApprovals: { 'profile.name': true },
        client: client as never,
      }),
    ).rejects.toMatchObject({
      name: 'GBP_DRAFT_INVALID_STATE',
    });
  });
});
