import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const routeSource = readFileSync(join(process.cwd(), 'src/app/api/bookings/[id]/route.ts'), 'utf8');

describe('guest booking mutation source guards', () => {
  it('enforces the guest self-service lock on dashboard-shaped guest (token or session) updates', () => {
    expect(routeSource).toMatch(
      /handleDashboardUpdate\(\{[\s\S]*?actor: actorForAccess\(resolution\.access\),[\s\S]*?enforceGuestSelfServiceLock: true,[\s\S]*?\}\);/,
    );
  });

  it('checks the guest self-service lock before guest cancellation', () => {
    const lockIndex = routeSource.indexOf('const cancellationLock = evaluateGuestModificationLock');
    const cancelIndex = routeSource.indexOf('const cancellation = await softCancelBooking');

    expect(lockIndex).toBeGreaterThan(0);
    expect(cancelIndex).toBeGreaterThan(lockIndex);
  });
});
