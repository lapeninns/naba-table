import RouteScanner from '../../../route-scanner.js';

describe('Guard detection with subgroup overrides', () => {
  it('applies public override to clear inherited guards', () => {
    const scanner = new RouteScanner();
    const guards = scanner.detectGuards('(ops)/(public)/ops/login/page.tsx');
    expect(guards).toEqual([]);
    const conflict = scanner.meta.warnings.find((w: { type: string }) => w.type === 'guard_conflict');
    expect(conflict).toBeTruthy();
  });

  it('detects authed group', () => {
    const scanner = new RouteScanner();
    const guards = scanner.detectGuards('(authed)/my-bookings/page.tsx');
    expect(guards).toContain('auth');
  });

  it('detects ops group', () => {
    const scanner = new RouteScanner();
    const guards = scanner.detectGuards('(ops)/ops/dashboard/page.tsx');
    expect(guards).toContain('admin');
  });
});

