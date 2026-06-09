import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
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

  it('keeps rejection analytics backing API routes protected by access checks before data access', () => {
    const rejectionsSource = readSource('src/app/api/ops/dashboard/rejections/route.ts');
    const strategicSource = readSource('src/app/api/ops/settings/strategic-config/route.ts');
    const strategicGetSource = strategicSource.slice(
      strategicSource.indexOf('export async function GET'),
      strategicSource.indexOf('export async function POST'),
    );

    expect(rejectionsSource).not.toContain('isOpsRejectionAnalyticsEnabled');
    expect(strategicSource).not.toContain('isOpsRejectionAnalyticsEnabled');
    expect(rejectionsSource.indexOf('await requireDashboardAccess')).toBeLessThan(
      rejectionsSource.indexOf('getServiceSupabaseClient()'),
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

  it('keeps invite bearer tokens out of automatic Plausible pageviews', () => {
    const layoutSource = readSource('src/app/layout.tsx');

    expect(layoutSource).toContain("const PLAUSIBLE_EXCLUDED_PATHS = '/invite/**'");
    expect(layoutSource).toContain('exclude={PLAUSIBLE_EXCLUDED_PATHS}');
  });

  it('forces fresh occasion validation for booking writes', () => {
    const validationSource = readSource('server/occasions/validateBookingType.ts');

    expect(validationSource).toContain('getOccasionCatalog({ forceRefresh: true })');
    expect(validationSource).not.toContain('getCachedOccasionCatalog');
  });
});
