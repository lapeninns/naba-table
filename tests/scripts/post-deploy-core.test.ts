import { describe, expect, it, vi } from 'vitest';

import { observePostDeployment } from '../../cloudflare/shared/post-deploy';

const expectedSha = 'a'.repeat(40);
const inventory = {
  'nabatable-web': ['database', 'storage', 'email-gateway'],
  'booking-short-links': ['d1', 'kv-cache'],
  'email-queue-gateway': ['email-queue-state', 'capacity-version-state'],
  'sms-summary-gateway': ['daily-summary-queue', 'daily-summary-state'],
};
const targets = Object.keys(inventory).map((service) => ({
  service,
  url: `https://${service}.example.com${service === 'nabatable-web' ? '/api/ready' : '/ready'}`,
}));
const fetcher = vi.fn(async (url: string) => {
  const service = new URL(url).hostname.split('.')[0] as keyof typeof inventory;
  return Response.json({
    service,
    status: 'ok',
    revision: expectedSha,
    checks: inventory[service].map((name) => ({ name, status: 'ok' })),
  });
});
const deps = {
  expectedRepository: 'lapeninns/nabatable',
  expectedSha,
  targets,
  token: 'secret',
  fetcher,
  timeoutMs: 100,
};

describe('runtime-neutral post-deployment observer', () => {
  it('verifies four complete dependency inventories with explicit input', async () => {
    expect((await observePostDeployment(deps)).ok).toBe(true);
  });
  it.each([
    { expectedRepository: 'evil/repo' },
    { expectedSha: 'short' },
    { token: '' },
    { targets: targets.slice(1) },
    { targets: [...targets.slice(1), targets[1]!] },
    { targets: targets.map((t) => ({ ...t, url: 'https://user:secret@example.com/ready' })) },
    { targets: targets.map((t) => ({ ...t, url: 'https://example.com/ready?secret' })) },
    { targets: targets.map((t) => ({ ...t, url: 'https://example.com/other' })) },
  ])('rejects unsafe explicit input without requests %j', async (changes) => {
    const deniedFetch = vi.fn(fetcher);
    const result = await observePostDeployment({ ...deps, ...changes, fetcher: deniedFetch });
    expect(result.ok).toBe(false);
    expect(deniedFetch).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
