import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA UI regression command', () => {
  it('selects primitive guards, axe checks, keyboard checks, and visual route smoke', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['qa:ui-regression']).toBe(
      'pnpm run qa:ui-regression:guards && pnpm run qa:ui-regression:a11y && pnpm run qa:ui-regression:keyboard && pnpm run qa:ui-regression:visual',
    );
    expect(packageJson.scripts?.['qa:ui-regression:guards']).toBe(
      'pnpm run guard:no-shadcn:strict && pnpm run guard:luma:strict',
    );
    expect(packageJson.scripts?.['guard:luma:strict']).toBe(
      'node scripts/check-luma-compliance.mjs --fail-on=exception --baseline=config/qa/luma-baseline.json',
    );
    expect(packageJson.scripts?.['guard:luma:update-baseline']).toBe(
      'node scripts/check-luma-compliance.mjs --baseline=config/qa/luma-baseline.json --update-baseline',
    );

    const a11yCommand = packageJson.scripts?.['qa:ui-regression:a11y'];
    expect(a11yCommand).toContain('tests/a11y/bookingDialog.a11y.test.tsx');
    expect(a11yCommand).toContain('tests/a11y/planStepForm.a11y.test.tsx');
    expect(a11yCommand).toContain('tests/a11y/tableAssignmentPanel.a11y.test.tsx');

    const keyboardCommand = packageJson.scripts?.['qa:ui-regression:keyboard'];
    expect(keyboardCommand).toContain('tests/components/TableCardGrid.keyboard.test.tsx');
    expect(keyboardCommand).toContain('tests/components/VirtualizedAllTablesSection.test.tsx');
    expect(keyboardCommand).toContain('tests/components/OpsBookingCardActions.noShow.test.tsx');
    expect(keyboardCommand).toContain('tests/components/ButtonAndBadge.test.tsx');
    expect(keyboardCommand).toContain('tests/components/StaleBoundary.test.tsx');

    expect(packageJson.scripts?.['qa:ui-regression:visual']).toBe(
      'playwright test -c playwright.app.config.ts tests/e2e/ui-visual-routes.spec.ts tests/e2e/ops-authenticated-app-host.spec.ts',
    );
  });
});
