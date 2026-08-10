import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { PLAUSIBLE_EXCLUDED_PATHS } from '@/src/app/layout';

vi.mock('next/font/google', () => ({
  Geist_Mono: () => ({ variable: 'font-mono' }),
  Inter: () => ({ variable: 'font-body' }),
  Merriweather: () => ({ variable: 'font-display' }),
}));
vi.mock('../../src/app/globals.css', () => ({}));
vi.mock('next/script', () => ({ default: () => null }));
vi.mock('../../components/LayoutClient', () => ({ default: () => null }));
vi.mock('@/src/app/providers', () => ({ AppProviders: () => null }));
vi.mock('@/config', () => ({
  default: { colors: { main: '#000000' }, domainName: 'nabatable.example', locale: 'en' },
}));
vi.mock('@/libs/seo', () => ({ getSEOTags: () => ({}) }));
vi.mock('@/lib/theme/documentTheme', () => ({ APP_THEME_PATH_PATTERN: '^/app' }));

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function plausiblePatternMatchesPath(pattern: string, pathname: string): boolean {
  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**', '\u0000')
    .replaceAll('*', '[^/]*')
    .replaceAll('\u0000', '.*');
  return new RegExp(`^${escapedPattern}$`).test(pathname);
}

describe('DeepSec final remediation source guards', () => {
  it('keeps hold overlap prevention on the fixed runtime policy and away from legacy fallback', () => {
    const runtimePolicySource = readSource('server/runtime-policy.ts');
    const holdsSource = readSource('server/capacity/holds.ts');
    const findHoldConflictsBody = holdsSource.slice(
      holdsSource.indexOf('export async function findHoldConflicts('),
      holdsSource.indexOf('async function findHoldConflictsLegacy('),
    );

    expect(runtimePolicySource).toContain(
      'export function isHoldStrictConflictsEnabled(): boolean',
    );
    expect(runtimePolicySource).toContain('return true;');
    expect(holdsSource).toContain('const enabled = true;');
    expect(holdsSource).toContain(
      'Strict hold conflict enforcement requires an RPC-capable client',
    );
    expect(holdsSource).toContain('Strict hold conflict enforcement not honored by server');
    expect(holdsSource).not.toContain('isHoldStrictConflictsEnabled');
    expect(findHoldConflictsBody).not.toContain('findHoldConflictsLegacy');
    expect(findHoldConflictsBody).not.toContain('return [] as HoldConflictInfo[]');
  });

  it('keeps strategic config reads protected by access checks before data access', () => {
    const strategicSource = readSource('src/app/api/ops/settings/strategic-config/route.ts');
    const strategicGetSource = strategicSource.slice(
      strategicSource.indexOf('export async function GET'),
      strategicSource.indexOf('export async function POST'),
    );

    expect(strategicGetSource.indexOf('getQuerySchema.safeParse')).toBeLessThan(
      strategicGetSource.indexOf('await getRouteHandlerSupabaseClient'),
    );
    expect(strategicGetSource.indexOf('await requireMembershipForRestaurant')).toBeLessThan(
      strategicGetSource.indexOf('getStrategicConfigSnapshot'),
    );
  });

  it('routes dual-sync failure webhooks through the validated https env getter', () => {
    const schemaSource = readSource('config/env.schema.ts');
    const envSource = readSource('lib/env.ts');
    const notificationsSource = readSource('server/dual-sync/notifications/index.ts');

    expect(schemaSource).toContain(
      "DUAL_SYNC_FAILURE_WEBHOOK_URL: z.string().url().startsWith('https://').optional()",
    );
    expect(envSource).toContain('get dualSync()');
    expect(envSource).toContain('failureWebhookUrl: parsed.DUAL_SYNC_FAILURE_WEBHOOK_URL ?? null');
    expect(notificationsSource).toContain("import { env } from '@/lib/env'");
    expect(notificationsSource).toContain('env.dualSync.failureWebhookUrl');
    expect(notificationsSource).not.toContain('process.env.DUAL_SYNC_FAILURE_WEBHOOK_URL');
  });

  it('pins the shadcn primitive workflow actions and limits token scope', () => {
    const workflowSource = readSource('.github/workflows/shadcn-primitives.yml');

    expect(workflowSource).toContain('permissions:\n  contents: read');
    expect(workflowSource).toContain('persist-credentials: false');
    expect(workflowSource).toMatch(/uses: actions\/checkout@[0-9a-f]{40}/);
    expect(workflowSource).toMatch(/uses: actions\/setup-node@[0-9a-f]{40}/);
    expect(workflowSource).not.toMatch(/uses: actions\/(?:checkout|setup-node)@v\d+/);
  });

  it('excludes invite and GBP state paths from automatic Plausible pageviews', () => {
    const patterns = PLAUSIBLE_EXCLUDED_PATHS.split(',');
    const isExcluded = (pathname: string) =>
      patterns.some((pattern) => plausiblePatternMatchesPath(pattern, pathname));

    expect(
      [
        '/invite/signed-bearer-token',
        '/app/settings/restaurant/google-business-profile',
        '/app/settings/restaurant/google-business-profile/menus',
        '/app/settings/restaurant/dual-sync/jobs/123',
        '/app/settings/restaurant/gbp/candidates',
      ].every(isExcluded),
    ).toBe(true);
    expect(isExcluded('/app/settings/restaurant/details')).toBe(false);
  });

  it('forces fresh occasion validation for booking writes', () => {
    const validationSource = readSource('server/occasions/validateBookingType.ts');

    expect(validationSource).toContain('getOccasionCatalog({ forceRefresh: true })');
    expect(validationSource).not.toContain('getCachedOccasionCatalog');
  });
});
