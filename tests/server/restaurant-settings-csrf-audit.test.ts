import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const guardedMutationFiles = [
  {
    file: 'src/app/api/ops/restaurants/[id]/details/route.ts',
    checks: [
      'export async function PUT',
      'export async function POST',
      'withCsrfProtectedMutation',
    ],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/hours/route.ts',
    checks: [
      'export async function PUT',
      'export async function POST',
      'withCsrfProtectedMutation',
    ],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/service-periods/route.ts',
    checks: [
      'export async function PUT',
      'export async function POST',
      'withCsrfProtectedMutation',
    ],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/business-context/route.ts',
    checks: [
      'export async function PUT',
      'ensureRestaurantAdminAccess(',
      "'restaurant-business-context'",
      'request,',
    ],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/menus/_shared.ts',
    checks: ['ensureRestaurantAdminAccess(restaurantId,', 'req);'],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/dual-sync/control/route.ts',
    checks: ['export async function PATCH', "'dual-sync-control', req"],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/dual-sync/publish/preview/route.ts',
    checks: ['export async function POST', "'dual-sync-publish-preview', req"],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/dual-sync/candidates/[candidateId]/cancel/route.ts',
    checks: ['export async function POST', "'dual-sync-candidate-cancel'", '_req,'],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/dual-sync/jobs/[jobId]/retry/route.ts',
    checks: ['export async function POST', "'dual-sync-job-retry', _req"],
  },
  {
    file: 'src/app/api/ops/restaurants/[id]/google-business/route.ts',
    checks: ['export async function DELETE', 'requireGoogleBusinessAdminAccess(params, _req)'],
  },
] as const;

describe('restaurant settings CSRF guard audit', () => {
  it.each(guardedMutationFiles)('$file protects unsafe settings mutations', ({ file, checks }) => {
    const source = readFileSync(file, 'utf8');

    for (const check of checks) {
      expect(source).toContain(check);
    }
  });
});
