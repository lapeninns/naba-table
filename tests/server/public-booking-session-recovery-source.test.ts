import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const routeSource = readFileSync(join(process.cwd(), 'src/app/api/bookings/[id]/route.ts'), 'utf8');

describe('session recovery booking mutation source guards', () => {
  it('enforces the guest self-service lock on dashboard-shaped session recovery updates', () => {
    expect(routeSource).toMatch(
      /handleDashboardUpdate\(\{[\s\S]*?serviceSupabase,\s*enforceGuestSelfServiceLock: true,[\s\S]*?\}\);/,
    );
  });

  it('checks the guest self-service lock before session recovery cancellation', () => {
    const lockIndex = routeSource.indexOf('const cancellationLock = evaluateGuestModificationLock');
    const cancelIndex = routeSource.indexOf('const cancellation = await softCancelBooking');

    expect(lockIndex).toBeGreaterThan(0);
    expect(cancelIndex).toBeGreaterThan(lockIndex);
  });
});
