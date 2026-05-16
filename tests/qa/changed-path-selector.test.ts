import { describe, expect, it } from 'vitest';

import { formatQaCommand, selectPrBaselineCommands } from '@/scripts/qa/changed-path-selector';

function idsFor(files: string[]): string[] {
  return selectPrBaselineCommands(files).commands.map((command) => command.id);
}

describe('PR baseline changed-path selector', () => {
  it('always includes the baseline build, reserve build, lint, and typecheck commands', () => {
    expect(idsFor([])).toEqual([
      'baseline:build',
      'baseline:reserve-build',
      'baseline:lint',
      'baseline:typecheck',
    ]);
  });

  it('selects targeted Prettier for docs, workflow, config, and QA test changes', () => {
    const selection = selectPrBaselineCommands([
      'docs/qa/pr-baseline.md',
      '.github/workflows/qa-foundation.yml',
      'tests/qa/changed-path-selector.test.ts',
    ]);
    const prettier = selection.commands.find((command) => command.id === 'changed:prettier');

    expect(prettier?.args).toEqual([
      'exec',
      'prettier',
      '--check',
      '.github/workflows/qa-foundation.yml',
      'docs/qa/pr-baseline.md',
      'tests/qa/changed-path-selector.test.ts',
    ]);
  });

  it('selects shadcn and Luma guards for UI changes', () => {
    const selected = idsFor(['src/components/features/dashboard/TableFloorPlan.tsx']);

    expect(selected).toContain('ui:shadcn-guard');
    expect(selected).toContain('ui:luma-guard');
  });

  it('selects guest/public shipped-route browser smoke for guest route changes', () => {
    const selection = selectPrBaselineCommands(['src/app/(public)/bookings/page.tsx']);

    expect(selection.commands.map((command) => command.id)).toContain('browser:guest-public-smoke');
    expect(
      formatQaCommand(
        selection.commands.find((command) => command.id === 'browser:guest-public-smoke')!,
      ),
    ).toContain('tests/e2e/guest-public-pages.spec.ts');
    expect(
      formatQaCommand(
        selection.commands.find((command) => command.id === 'browser:guest-public-smoke')!,
      ),
    ).toContain('tests/e2e/guest-booking.spec.ts');
  });

  it('selects ops app-host redirect and authenticated shipped-route smoke', () => {
    const selection = selectPrBaselineCommands(['src/app/app/(app)/dashboard/page.tsx']);
    const command = selection.commands.find((item) => item.id === 'browser:ops-shipped-smoke');

    expect(selection.commands.map((command) => command.id)).toContain('browser:ops-shipped-smoke');
    expect(formatQaCommand(command!)).toContain('tests/e2e/ops-app-host-redirects.spec.ts');
    expect(formatQaCommand(command!)).toContain('tests/e2e/ops-authenticated-app-host.spec.ts');
    expect(selection.notes).toEqual([]);
  });

  it('selects API smoke tests for route and server changes', () => {
    const selection = selectPrBaselineCommands([
      'src/app/api/bookings/route.ts',
      'server/bookings/manage-url.ts',
    ]);
    const apiSmoke = selection.commands.find((command) => command.id === 'api:smoke');

    expect(apiSmoke?.args).toEqual([
      'exec',
      'vitest',
      'tests/server/security-request.test.ts',
      'tests/server/csrf-protected-mutations.test.ts',
      'tests/server/qa-restaurant-fixtures.test.ts',
      'tests/server/availability-route-query-params.test.ts',
      'tests/server/public-bookings-route.test.ts',
      'tests/server/public-booking-delete-route.test.ts',
      'tests/server/public-booking-manage-token.test.ts',
      'tests/server/public-booking-update-route.test.ts',
      'tests/server/guest-bookings-list-route.test.ts',
      'tests/server/ops-bookings-create-route.test.ts',
      'tests/server/ops-bookings-list-route.test.ts',
      'tests/server/ops-booking-route.test.ts',
      'tests/server/ops-booking-checkout-route.test.ts',
      'tests/server/ops-booking-lifecycle-route-context.test.ts',
      'tests/server/ops-booking-lifecycle-routes.test.ts',
    ]);
  });

  it('selects guest profile API coverage for profile route changes', () => {
    const selection = selectPrBaselineCommands(['src/app/api/profile/route.ts']);
    const apiSmoke = selection.commands.find((command) => command.id === 'api:smoke');

    expect(apiSmoke?.args).toEqual([
      'exec',
      'vitest',
      'tests/server/security-request.test.ts',
      'tests/server/csrf-protected-mutations.test.ts',
      'tests/server/guest-profile-route.test.ts',
      'tests/server/profile-route-idempotency.test.ts',
    ]);
  });
});
