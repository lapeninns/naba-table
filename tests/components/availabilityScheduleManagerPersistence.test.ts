import { describe, expect, it, vi } from 'vitest';

import { persistAvailabilityOccasionDrafts } from '@/components/features/restaurant-settings/availabilityScheduleManagerPersistence';
import { buildAvailabilityOccasionSavePlan } from '@/components/features/restaurant-settings/availabilitySchedulePayloadDomain';

import type { OccasionService, OpsOccasion } from '@/services/ops/occasions';

function makeOccasion(overrides: Partial<OpsOccasion> & { key: string }): OpsOccasion {
  return {
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    shortLabel: overrides.shortLabel ?? overrides.label ?? overrides.key,
    description: overrides.description ?? null,
    availability: overrides.availability ?? [{ kind: 'anytime' }],
    defaultDurationMinutes: overrides.defaultDurationMinutes ?? 90,
    displayOrder: overrides.displayOrder ?? 10,
    isActive: overrides.isActive ?? true,
    isBuiltin: overrides.isBuiltin ?? false,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

describe('availability schedule occasion persistence', () => {
  it('plans occasion creates, updates, and non-builtin deletes without mutating drafts', () => {
    const originalOccasions = [
      makeOccasion({ key: 'lunch', isBuiltin: true }),
      makeOccasion({ key: 'private-dining', label: 'Private Dining' }),
      makeOccasion({ key: 'seasonal', label: 'Seasonal' }),
    ];
    const draftOccasions = [
      makeOccasion({ key: 'lunch', isBuiltin: true }),
      makeOccasion({ key: 'private-dining', label: 'Private Dining Room' }),
      makeOccasion({ key: 'supper', label: 'Supper', displayOrder: 30 }),
    ];

    const plan = buildAvailabilityOccasionSavePlan({
      draftOccasions,
      originalOccasions,
    });

    expect(plan.createInputs).toEqual([
      expect.objectContaining({
        key: 'supper',
        label: 'Supper',
        description: null,
        displayOrder: 30,
      }),
    ]);
    expect(plan.updateInputs).toEqual([
      {
        key: 'private-dining',
        input: expect.objectContaining({
          label: 'Private Dining Room',
          shortLabel: 'Private Dining Room',
        }),
      },
    ]);
    expect(plan.updateInputs[0]?.input).not.toHaveProperty('key');
    expect(plan.deleteKeys).toEqual(['seasonal']);
  });

  it('executes occasion persistence in create, update, then delete order', async () => {
    const calls: string[] = [];
    const occasionService: OccasionService = {
      listOccasions: vi.fn(async () => []),
      createOccasion: vi.fn(async (input) => {
        calls.push(`create:${input.key}`);
        return makeOccasion({ key: input.key, label: input.label });
      }),
      updateOccasion: vi.fn(async (key, input) => {
        calls.push(`update:${key}:${input.label}`);
        return makeOccasion({ key, label: input.label ?? key });
      }),
      deleteOccasion: vi.fn(async (key) => {
        calls.push(`delete:${key}`);
      }),
    };

    const plan = await persistAvailabilityOccasionDrafts({
      draftOccasions: [
        makeOccasion({ key: 'lunch', label: 'Lunch service' }),
        makeOccasion({ key: 'supper', label: 'Supper' }),
      ],
      occasionService,
      originalOccasions: [
        makeOccasion({ key: 'lunch', label: 'Lunch' }),
        makeOccasion({ key: 'seasonal', label: 'Seasonal' }),
      ],
    });

    expect(calls).toEqual(['create:supper', 'update:lunch:Lunch service', 'delete:seasonal']);
    expect(plan.createInputs).toHaveLength(1);
    expect(plan.updateInputs).toHaveLength(1);
    expect(plan.deleteKeys).toEqual(['seasonal']);
  });
});
