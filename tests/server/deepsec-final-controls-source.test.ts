import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('DeepSec final remediation source guards', () => {
  it('keeps hold overlap prevention independent of runtime flags and legacy fallback', () => {
    const featureFlagsSource = readSource('server/feature-flags.ts');
    const holdsSource = readSource('server/capacity/holds.ts');
    const findHoldConflictsBody = holdsSource.slice(
      holdsSource.indexOf('export async function findHoldConflicts('),
      holdsSource.indexOf('async function findHoldConflictsLegacy('),
    );

    expect(featureFlagsSource).toContain('export function isHoldStrictConflictsEnabled(): boolean');
    expect(featureFlagsSource).toContain('return true;');
    expect(holdsSource).toContain('const enabled = true;');
    expect(holdsSource).toContain(
      'Strict hold conflict enforcement requires an RPC-capable client',
    );
    expect(holdsSource).toContain('Strict hold conflict enforcement not honored by server');
    expect(holdsSource).not.toContain('isHoldStrictConflictsEnabled');
    expect(findHoldConflictsBody).not.toContain('findHoldConflictsLegacy');
    expect(findHoldConflictsBody).not.toContain('return [] as HoldConflictInfo[]');
  });

  it('enforces rejection analytics gates in backing API routes before data access', () => {
    const rejectionsSource = readSource('src/app/api/ops/dashboard/rejections/route.ts');
    const strategicSource = readSource('src/app/api/ops/settings/strategic-config/route.ts');

    const rejectionsGate = rejectionsSource.indexOf('if (!isOpsRejectionAnalyticsEnabled())');
    expect(rejectionsGate).toBeGreaterThan(0);
    expect(rejectionsGate).toBeLessThan(rejectionsSource.indexOf('parseQuery(request)'));
    expect(rejectionsGate).toBeLessThan(rejectionsSource.indexOf('await requireDashboardAccess'));
    expect(rejectionsGate).toBeLessThan(rejectionsSource.indexOf('getServiceSupabaseClient()'));

    const strategicGetGate = strategicSource.indexOf('if (!isOpsRejectionAnalyticsEnabled())');
    const strategicPostGate = strategicSource.lastIndexOf('if (!isOpsRejectionAnalyticsEnabled())');
    expect(strategicGetGate).toBeGreaterThan(0);
    expect(strategicPostGate).toBeGreaterThan(strategicGetGate);
    expect(strategicGetGate).toBeLessThan(strategicSource.indexOf('getQuerySchema.safeParse'));
    expect(strategicPostGate).toBeLessThan(strategicSource.indexOf('payloadSchema.safeParse'));
    expect(strategicGetGate).toBeLessThan(
      strategicSource.indexOf('await getRouteHandlerSupabaseClient'),
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
});
