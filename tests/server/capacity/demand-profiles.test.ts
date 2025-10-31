import { DateTime } from 'luxon';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { clearAllDemandProfileCaches, resolveDemandMultiplier } from '@/server/capacity/demand-profiles';
import { setDemandProfileConfigPathForTests } from '@/server/capacity/strategic-config';

const FIXTURE_PATH = path.join(process.cwd(), 'tests/server/capacity/fixtures/demand-profiles-specific.json');

describe('resolveDemandMultiplier — fallback specificity', () => {
  afterEach(() => {
    clearAllDemandProfileCaches();
    setDemandProfileConfigPathForTests(null);
  });

  it('selects the highest priority rule matching the booking time window', async () => {
    setDemandProfileConfigPathForTests(FIXTURE_PATH);

    const fridayEvening = DateTime.fromISO('2025-01-03T18:30:00', { zone: 'Europe/London' });
    const result = await resolveDemandMultiplier({
      restaurantId: null,
      serviceStart: fridayEvening,
      serviceKey: 'dinner',
      timezone: 'Europe/London',
    });

    expect(result.multiplier).toBeCloseTo(1.1, 5);
    expect(result.rule?.label).toBe('friday-early');
    expect(result.rule?.priority).toBe(1);
  });

  it('prefers higher-priority late rules when within their window', async () => {
    setDemandProfileConfigPathForTests(FIXTURE_PATH);

    const lateDinner = DateTime.fromISO('2025-01-03T21:30:00', { zone: 'Europe/London' });
    const result = await resolveDemandMultiplier({
      serviceStart: lateDinner,
      serviceKey: 'dinner',
      timezone: 'Europe/London',
    });

    expect(result.multiplier).toBeCloseTo(1.5, 5);
    expect(result.rule?.label).toBe('friday-late');
    expect(result.rule?.priority).toBe(2);
  });
});
