import { afterEach, describe, expect, it } from 'vitest';

import { getSelectorScoringConfig } from '@/server/capacity/policy';
import {
  applyStrategicConfigOverride,
  getStrategicConfigSnapshot,
  getStrategicScarcityWeight,
  resetStrategicConfigTestOverrides,
  setStrategicScarcityWeightForTests,
  setStrategicConfigForTests,
} from '@/server/capacity/strategic-config';

describe('strategic-config cache', () => {
  afterEach(() => {
    resetStrategicConfigTestOverrides();
  });

  it('returns current scarcity weight from snapshot', () => {
    const before = getStrategicScarcityWeight();
    applyStrategicConfigOverride({ scarcityWeight: before + 10, updatedAt: new Date().toISOString() });
    const after = getStrategicScarcityWeight();
    expect(after).toBe(before + 10);
  });

  it('supports test scarcity overrides without mutating cache', () => {
    const baseline = getStrategicScarcityWeight();
    setStrategicScarcityWeightForTests(baseline + 25);
    expect(getStrategicScarcityWeight()).toBe(baseline + 25);
    resetStrategicConfigTestOverrides();
    expect(getStrategicScarcityWeight()).toBe(baseline);
  });

  it('allows test config overrides to adjust snapshot values', () => {
    const snapshotBefore = getStrategicConfigSnapshot();
    setStrategicConfigForTests({
      demandMultiplierOverride: 1.5,
      futureConflictPenalty: 800,
    });
    const snapshotAfter = getStrategicConfigSnapshot();
    expect(snapshotAfter.demandMultiplierOverride).toBe(1.5);
    expect(snapshotAfter.futureConflictPenalty).toBe(800);
    expect(snapshotAfter.scarcityWeight).toBe(snapshotBefore.scarcityWeight);
  });

  it('supports per-restaurant overrides without affecting defaults', () => {
    const restaurantId = 'rest-123';
    const baseline = getStrategicScarcityWeight();

    applyStrategicConfigOverride({
      restaurantId,
      scarcityWeight: baseline + 10,
      updatedAt: new Date().toISOString(),
      source: 'db',
    });

    expect(getStrategicScarcityWeight({ restaurantId })).toBe(baseline + 10);
    expect(getStrategicScarcityWeight()).toBe(baseline);

    const config = getSelectorScoringConfig({ restaurantId });
    expect(config.weights.scarcity).toBe(baseline + 10);
  });
});
