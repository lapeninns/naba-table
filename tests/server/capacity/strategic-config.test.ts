import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const strategicEnv = vi.hoisted(() => ({
  scarcityWeight: undefined as number | undefined,
  demandProfilePath: undefined as string | undefined,
  demandMultiplierOverride: null as number | null,
  futureConflictPenalty: null as number | null,
}));

vi.mock('@/lib/env', () => ({
  env: { strategic: strategicEnv },
}));

import {
  DEFAULT_SCARCITY_WEIGHT,
  applyStrategicConfigOverride,
  getDemandProfileConfigPath,
  getStrategicConfigSnapshot,
  getStrategicScarcityWeight,
  invalidateStrategicConfigCache,
  loadStrategicConfig,
  resetStrategicConfigTestOverrides,
  setDemandProfileConfigPathForTests,
  setStrategicConfigForTests,
  setStrategicScarcityWeightForTests,
} from '@/server/capacity/strategic-config';

import type { StrategicConfigState } from '@/server/capacity/strategic-config';

function resetEnv() {
  strategicEnv.scarcityWeight = undefined;
  strategicEnv.demandProfilePath = undefined;
  strategicEnv.demandMultiplierOverride = null;
  strategicEnv.futureConflictPenalty = null;
}

describe('strategic config', () => {
  beforeEach(() => {
    resetEnv();
    resetStrategicConfigTestOverrides(); // also clears the module cache
  });

  afterEach(() => {
    resetStrategicConfigTestOverrides();
    vi.useRealTimers();
  });

  it('@contract defaults to the built-in scarcity weight when env provides nothing', () => {
    const snapshot = getStrategicConfigSnapshot();

    expect(snapshot).toMatchObject({
      scarcityWeight: DEFAULT_SCARCITY_WEIGHT,
      demandMultiplierOverride: null,
      futureConflictPenalty: null,
      updatedAt: null,
      source: 'env',
    });
    expect(DEFAULT_SCARCITY_WEIGHT).toBe(22);
  });

  it('@contract clamps env-provided values into their allowed ranges', () => {
    strategicEnv.scarcityWeight = 5000;
    strategicEnv.demandMultiplierOverride = 25;
    strategicEnv.futureConflictPenalty = 1_000_000;

    const snapshot = getStrategicConfigSnapshot({ restaurantId: 'clamp-check' });

    expect(snapshot.scarcityWeight).toBe(1000);
    expect(snapshot.demandMultiplierOverride).toBe(10);
    expect(snapshot.futureConflictPenalty).toBe(100_000);

    strategicEnv.scarcityWeight = -3;
    expect(getStrategicConfigSnapshot({ restaurantId: 'clamp-low' }).scarcityWeight).toBe(0);
  });

  it('@contract snapshots are cached per key until loadStrategicConfig refreshes from env', async () => {
    strategicEnv.scarcityWeight = 30;
    expect(getStrategicConfigSnapshot().scarcityWeight).toBe(30);

    // A later env change is invisible until an explicit load.
    strategicEnv.scarcityWeight = 40;
    expect(getStrategicConfigSnapshot().scarcityWeight).toBe(30);

    const loaded = await loadStrategicConfig();
    expect(loaded.scarcityWeight).toBe(40);
    expect(getStrategicConfigSnapshot().scarcityWeight).toBe(40);
  });

  it('@contract scoped overrides apply per restaurant and leave the global entry untouched', () => {
    applyStrategicConfigOverride({ restaurantId: 'r1', scarcityWeight: 77, source: 'db' });

    expect(getStrategicConfigSnapshot({ restaurantId: 'r1' })).toMatchObject({
      scarcityWeight: 77,
      source: 'db',
    });
    expect(getStrategicConfigSnapshot()).toMatchObject({
      scarcityWeight: DEFAULT_SCARCITY_WEIGHT,
      source: 'env',
    });
    expect(getStrategicScarcityWeight({ restaurantId: 'r1' })).toBe(77);

    invalidateStrategicConfigCache('r1');
    expect(getStrategicConfigSnapshot({ restaurantId: 'r1' }).scarcityWeight).toBe(
      DEFAULT_SCARCITY_WEIGHT,
    );
  });

  it('@contract invalidating without an id clears every cached entry', () => {
    applyStrategicConfigOverride({ restaurantId: 'r1', scarcityWeight: 77 });
    applyStrategicConfigOverride({ scarcityWeight: 88 });

    invalidateStrategicConfigCache();

    expect(getStrategicConfigSnapshot({ restaurantId: 'r1' }).scarcityWeight).toBe(
      DEFAULT_SCARCITY_WEIGHT,
    );
    expect(getStrategicConfigSnapshot().scarcityWeight).toBe(DEFAULT_SCARCITY_WEIGHT);
  });

  it('@contract override merge keeps unspecified fields but leaks the restaurantId key into state (KNOWN-ISSUE)', () => {
    // KNOWN-ISSUE: server/capacity/strategic-config.ts:174-190 spreads the whole
    // override object ({...override}) into the cached state, so the routing-only
    // restaurantId field becomes part of every subsequent snapshot object. Correct
    // behavior would strip restaurantId before merging.
    applyStrategicConfigOverride({ restaurantId: 'r1', demandMultiplierOverride: 2 });

    const snapshot = getStrategicConfigSnapshot({ restaurantId: 'r1' }) as StrategicConfigState & {
      restaurantId?: string | null;
    };

    expect(snapshot.demandMultiplierOverride).toBe(2);
    expect(snapshot.scarcityWeight).toBe(DEFAULT_SCARCITY_WEIGHT); // untouched field survives
    expect(snapshot.restaurantId).toBe('r1'); // pinned leak
  });

  it('@contract non-finite override weights clamp to the minimum, not the default', () => {
    applyStrategicConfigOverride({ restaurantId: 'inf', scarcityWeight: Number.POSITIVE_INFINITY });
    expect(getStrategicConfigSnapshot({ restaurantId: 'inf' }).scarcityWeight).toBe(0);

    applyStrategicConfigOverride({ restaurantId: 'nan', scarcityWeight: Number.NaN });
    expect(getStrategicConfigSnapshot({ restaurantId: 'nan' }).scarcityWeight).toBe(0);
  });

  it('@contract the 30s cache TTL is written but never enforced on reads (KNOWN-ISSUE)', () => {
    // KNOWN-ISSUE: server/capacity/strategic-config.ts:141-158 stores expiresAt on
    // every entry but no read path ever checks it — ensureCacheEntry and
    // getStrategicConfigSnapshot serve the stale state forever. Correct behavior
    // would re-derive from env (or the DB) once expiresAt has passed.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));

    applyStrategicConfigOverride({ restaurantId: 'ttl', scarcityWeight: 77 });
    vi.setSystemTime(new Date('2026-07-15T12:05:00Z')); // 5 minutes >> 30s TTL

    expect(getStrategicConfigSnapshot({ restaurantId: 'ttl' }).scarcityWeight).toBe(77);
  });

  it('@contract test override hooks shape snapshots and reset cleanly', () => {
    setStrategicScarcityWeightForTests(444);
    expect(getStrategicConfigSnapshot().scarcityWeight).toBe(444);
    expect(getStrategicScarcityWeight()).toBe(444);

    setStrategicScarcityWeightForTests(44_444);
    expect(getStrategicConfigSnapshot().scarcityWeight).toBe(1000); // clamped

    setStrategicConfigForTests({ futureConflictPenalty: 5, source: 'db' });
    expect(getStrategicConfigSnapshot()).toMatchObject({
      futureConflictPenalty: 5,
      source: 'db',
    });

    resetStrategicConfigTestOverrides();
    expect(getStrategicConfigSnapshot()).toMatchObject({
      scarcityWeight: DEFAULT_SCARCITY_WEIGHT,
      futureConflictPenalty: null,
      source: 'env',
    });
  });

  it('@contract resolves the demand profile path across default, relative, absolute and test override', () => {
    expect(getDemandProfileConfigPath()).toBe(
      path.join(process.cwd(), 'config/demand-profiles.json'),
    );

    strategicEnv.demandProfilePath = 'custom/profiles.json';
    expect(getDemandProfileConfigPath()).toBe(path.join(process.cwd(), 'custom/profiles.json'));

    strategicEnv.demandProfilePath = '/absolute/profiles.json';
    expect(getDemandProfileConfigPath()).toBe('/absolute/profiles.json');

    setDemandProfileConfigPathForTests('/tmp/override.json');
    expect(getDemandProfileConfigPath()).toBe('/tmp/override.json');

    setDemandProfileConfigPathForTests(null);
    expect(getDemandProfileConfigPath()).toBe('/absolute/profiles.json');
  });
});
