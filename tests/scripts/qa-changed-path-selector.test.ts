import { describe, expect, it } from 'vitest';

import {
  formatQaCommand,
  selectPrBaselineCommands,
  type QaCommand,
  type QaPrBaselineSelection,
} from '@/scripts/qa/changed-path-selector';

/**
 * Behavioral pins for scripts/qa/changed-path-selector.ts
 * (MS-foundation-qa-harness-self-tests): representative diffs must keep selecting the
 * same PR-baseline commands.
 */

const BASELINE_IDS = [
  'baseline:build',
  'baseline:reserve-build',
  'baseline:lint',
  'baseline:typecheck',
];

function ids(selection: QaPrBaselineSelection): string[] {
  return selection.commands.map((command) => command.id);
}

function commandById(selection: QaPrBaselineSelection, id: string): QaCommand {
  const command = selection.commands.find((entry) => entry.id === id);
  if (!command) {
    throw new Error(`Expected selection to include command "${id}".`);
  }
  return command;
}

describe('selectPrBaselineCommands', () => {
  it('always selects the four baseline commands, even for an empty diff @contract @local-only', () => {
    const selection = selectPrBaselineCommands([]);

    expect(ids(selection)).toEqual(BASELINE_IDS);
    expect(selection.changedFiles).toEqual([]);
    expect(selection.notes).toEqual([]);
  });

  it('routes docs-only diffs to targeted Prettier and nothing else @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['docs/qa/foundation.md', 'tasks/notes.md']);

    expect(ids(selection)).toEqual([...BASELINE_IDS, 'changed:prettier']);
    const prettier = commandById(selection, 'changed:prettier');
    expect(prettier.args).toEqual([
      'exec',
      'prettier',
      '--check',
      'docs/qa/foundation.md',
      'tasks/notes.md',
    ]);
    expect(prettier.phase).toBe('format');
  });

  it('treats workflows, config, package.json, and QA infrastructure as Prettier targets @contract @local-only', () => {
    const selection = selectPrBaselineCommands([
      '.github/workflows/qa-pr-baseline.yml',
      '.github/workflows/deploy.sh',
      'docs/diagram.png',
      'package.json',
      'scripts/qa/environment.ts',
      'tests/qa/example.test.ts',
      'vitest.config.ts',
    ]);

    const prettier = commandById(selection, 'changed:prettier');
    expect(prettier.args.slice(3)).toEqual([
      '.github/workflows/qa-pr-baseline.yml',
      'package.json',
      'scripts/qa/environment.ts',
      'tests/qa/example.test.ts',
      'vitest.config.ts',
    ]);
  });

  it('routes ops UI changes to the UI guards and ops browser smoke @contract @local-only', () => {
    const selection = selectPrBaselineCommands([
      'src/components/features/floorplan/FloorPlanShell.tsx',
    ]);

    expect(ids(selection)).toEqual([
      ...BASELINE_IDS,
      'ui:shadcn-guard',
      'ui:luma-guard',
      'browser:ops-shipped-smoke',
    ]);
    expect(commandById(selection, 'ui:shadcn-guard').defaultFailureClass).toBe('baseline-debt');
    const smoke = commandById(selection, 'browser:ops-shipped-smoke');
    expect(smoke.phase).toBe('browser-smoke');
    expect(smoke.args).toContain('tests/e2e/ops-app-host-redirects.spec.ts');
  });

  it('routes guest/public UI changes to the guest browser smoke @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['src/app/(public)/reserve/page.tsx']);

    expect(ids(selection)).toEqual([
      ...BASELINE_IDS,
      'ui:shadcn-guard',
      'ui:luma-guard',
      'browser:guest-public-smoke',
    ]);
    const smoke = commandById(selection, 'browser:guest-public-smoke');
    expect(smoke.args).toContain('tests/e2e/guest-public-pages.spec.ts');
    expect(smoke.args).toContain('tests/e2e/guest-booking.spec.ts');
    expect(smoke.defaultFailureClass).toBe('product');
  });

  it('fans shared components/ui changes out to both browser smokes @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['components/ui/button.tsx']);

    expect(ids(selection)).toContain('browser:guest-public-smoke');
    expect(ids(selection)).toContain('browser:ops-shipped-smoke');
    expect(ids(selection)).toContain('ui:shadcn-guard');
  });

  it('routes server/API changes to the vitest security smoke @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['server/email/sender.ts']);

    expect(ids(selection)).toEqual([...BASELINE_IDS, 'api:smoke']);
    const smoke = commandById(selection, 'api:smoke');
    expect(smoke.args).toEqual([
      'exec',
      'vitest',
      'tests/server/security-request.test.ts',
      'tests/server/csrf-protected-mutations.test.ts',
    ]);
    expect(smoke.phase).toBe('api-smoke');
  });

  it('detects API surfaces across route files and lib auth/security roots @contract @local-only', () => {
    for (const file of [
      'src/app/api/health/route.ts',
      'lib/api/client.ts',
      'lib/auth/session.ts',
      'lib/security/csrf.ts',
    ]) {
      expect(ids(selectPrBaselineCommands([file]))).toContain('api:smoke');
    }
  });

  it('expands the API smoke for bookings changes @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['src/app/api/bookings/route.ts']);

    const smoke = commandById(selection, 'api:smoke');
    expect(smoke.args).toContain('tests/server/public-bookings-route.test.ts');
    expect(smoke.args).toContain('tests/server/ops-booking-lifecycle-routes.test.ts');
    expect(smoke.args).toContain('tests/server/availability-route-query-params.test.ts');
    // 'exec' + 'vitest' + 2 security smokes + 13 bookings-specific suites.
    expect(smoke.args).toHaveLength(17);
  });

  it('expands the API smoke for profile changes @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['lib/api/profile-server.ts']);

    const smoke = commandById(selection, 'api:smoke');
    expect(smoke.args).toContain('tests/server/guest-profile-route.test.ts');
    expect(smoke.args).toContain('tests/server/profile-route-idempotency.test.ts');
    expect(smoke.args).not.toContain('tests/server/public-bookings-route.test.ts');
  });

  it('expands bookings coverage when any changed path mentions bookings alongside an API file @contract @local-only', () => {
    // The expansion trigger is a substring check across ALL changed files, not just the
    // API files themselves: a docs path mentioning bookings widens the API smoke.
    // Conservative over-selection, pinned as current behavior.
    const selection = selectPrBaselineCommands([
      'server/email/sender.ts',
      'docs/bookings-guide.md',
    ]);

    expect(commandById(selection, 'api:smoke').args).toContain(
      'tests/server/public-bookings-route.test.ts',
    );
  });

  it('classifies a route file under a public app segment as both UI and API @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['src/app/(public)/api-preview/route.ts']);

    expect(ids(selection)).toContain('browser:guest-public-smoke');
    expect(ids(selection)).toContain('api:smoke');
  });

  it('normalizes, dedupes, sorts, and drops out-of-repo paths @contract @local-only', () => {
    const selection = selectPrBaselineCommands([
      'src\\components\\ui\\button.tsx',
      'docs/a.md',
      'docs/a.md',
      '  ',
      '../outside/file.ts',
      '/absolute/file.ts',
    ]);

    expect(selection.changedFiles).toEqual(['docs/a.md', 'src/components/ui/button.tsx']);
    expect(ids(selection)).toContain('browser:ops-shipped-smoke');
  });

  it('omits the baseline commands when includeBaseline is false @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['docs/a.md'], { includeBaseline: false });

    expect(ids(selection)).toEqual(['changed:prettier']);
  });

  it('does not treat non-UI extensions under component roots as UI @contract @local-only', () => {
    const selection = selectPrBaselineCommands(['src/components/features/README.md']);

    expect(ids(selection)).toEqual(BASELINE_IDS);
  });
});

describe('formatQaCommand', () => {
  it('formats commands as pnpm invocations, quoting spaced arguments @contract @local-only', () => {
    const selection = selectPrBaselineCommands([]);
    expect(formatQaCommand(commandById(selection, 'baseline:build'))).toBe('pnpm run build');

    const spaced = selectPrBaselineCommands(['docs/release notes.md'], { includeBaseline: false });
    expect(formatQaCommand(commandById(spaced, 'changed:prettier'))).toBe(
      'pnpm exec prettier --check "docs/release notes.md"',
    );
  });
});
