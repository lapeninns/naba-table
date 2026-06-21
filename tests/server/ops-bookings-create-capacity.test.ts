import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/ops/bookings/route.ts'),
  'utf8',
);

describe('ops booking create capacity enforcement', () => {
  it('routes walk-in creation through unified capacity enforcement without a legacy insert branch', () => {
    expect(routeSource).toContain('validationService.createWithEnforcement');
    expect(routeSource).not.toContain('insertBookingRecord');
    expect(routeSource).not.toContain('bookingValidationUnified');
  });
});
