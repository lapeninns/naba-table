import { describe, expect, it, vi } from 'vitest';

import {
  TrustPolicySchema,
  admitForLocalExecution,
  classify,
  classifyWithReason,
  isTrustPolicyConfigured,
  loadTrustPolicy,
  validateTrustPolicy,
  type TrustPolicy,
  type TrustRequest,
} from '@/scripts/ci/contracts/trust';

const configuredPolicy: TrustPolicy = {
  version: 1,
  trustedRepositoryId: 123456789,
  actorPolicy: {
    localActors: ['maintainer'],
    automationIdentities: ['github-actions[bot]', 'dependabot[bot]'],
    automationRoute: 'hosted',
    unknownActorRoute: 'hosted',
  },
  ignoredSignals: ['labels', 'branchNames'],
};

function request(overrides: Partial<TrustRequest> = {}): TrustRequest {
  return {
    baseRepositoryId: 123456789,
    headRepositoryId: 123456789,
    actor: { login: 'maintainer', type: 'User' },
    event: 'pull_request',
    ...overrides,
  };
}

describe('trust policy file', () => {
  it('ships unconfigured with an obviously fake repository id', () => {
    const policy = loadTrustPolicy();
    expect(policy.trustedRepositoryId).toBe('REPLACE_ME_REPOSITORY_ID');
    expect(isTrustPolicyConfigured(policy)).toBe(false);
    expect(policy.actorPolicy.localActors).toEqual([]);
    expect(policy.actorPolicy.automationRoute).toBe('hosted');
    expect(classify(request(), policy)).toBe('hosted');
    expect(classifyWithReason(request(), policy).reason).toBe('trust-policy-unconfigured');
  });

  it('requires a numeric repository id once configured', () => {
    expect(
      validateTrustPolicy({ ...configuredPolicy, trustedRepositoryId: 'lapeninns/nabatable' }).ok,
    ).toBe(false);
    expect(validateTrustPolicy({ ...configuredPolicy, trustedRepositoryId: '123456789' }).ok).toBe(
      true,
    );
    expect(
      validateTrustPolicy({ ...configuredPolicy, trustedRepositoryId: 'REPLACE_ME_X' }).ok,
    ).toBe(true);
  });

  it('never allows automation to be routed locally', () => {
    expect(
      TrustPolicySchema.safeParse({
        ...configuredPolicy,
        actorPolicy: { ...configuredPolicy.actorPolicy, automationRoute: 'local' },
      }).success,
    ).toBe(false);
    expect(
      TrustPolicySchema.safeParse({
        ...configuredPolicy,
        actorPolicy: { ...configuredPolicy.actorPolicy, localActors: ['dependabot[bot]'] },
      }).success,
    ).toBe(false);
    expect(
      TrustPolicySchema.safeParse({
        ...configuredPolicy,
        actorPolicy: { ...configuredPolicy.actorPolicy, localActors: ['someone[bot]'] },
      }).success,
    ).toBe(false);
  });
});

describe('classify', () => {
  it('routes allow-listed humans on the trusted repository locally', () => {
    expect(classifyWithReason(request(), configuredPolicy)).toEqual({
      route: 'local',
      reason: 'trusted-local-actor',
    });
  });

  it('rejects forks before anything else, even for trusted actors', () => {
    expect(classifyWithReason(request({ headRepositoryId: 42 }), configuredPolicy)).toEqual({
      route: 'reject-fork',
      reason: 'fork-head-repository',
    });
    expect(
      classify(
        request({ headRepositoryId: 42, actor: { login: 'github-actions[bot]', type: 'Bot' } }),
        configuredPolicy,
      ),
    ).toBe('reject-fork');
  });

  it('rejects the wrong repository id', () => {
    expect(
      classifyWithReason(request({ baseRepositoryId: 1, headRepositoryId: 1 }), configuredPolicy),
    ).toEqual({ route: 'reject-fork', reason: 'repository-not-trusted' });
  });

  it('routes automation identities and unknown actors to hosted', () => {
    expect(
      classifyWithReason(
        request({ actor: { login: 'dependabot[bot]', type: 'Bot' } }),
        configuredPolicy,
      ),
    ).toEqual({ route: 'hosted', reason: 'automation-identity' });
    expect(
      classifyWithReason(
        request({ actor: { login: 'release-please[bot]', type: 'User' } }),
        configuredPolicy,
      ),
    ).toEqual({ route: 'hosted', reason: 'automation-identity' });
    expect(
      classifyWithReason(
        request({ actor: { login: 'maintainer', type: 'Bot' } }),
        configuredPolicy,
      ),
    ).toEqual({ route: 'hosted', reason: 'automation-identity' });
    expect(
      classifyWithReason(request({ actor: { login: 'stranger', type: 'User' } }), configuredPolicy),
    ).toEqual({ route: 'hosted', reason: 'actor-not-in-local-allowlist' });
  });

  it('ignores labels, branch names and titles entirely', () => {
    const decorated = {
      ...request({ headRepositoryId: 42 }),
      labels: ['safe-to-test', 'trusted'],
      headRef: 'main',
      baseRef: 'main',
      title: 'trusted: please run locally',
    };
    expect(classify(decorated, configuredPolicy)).toBe('reject-fork');
    const decoratedSameRepo = {
      ...request({ actor: { login: 'stranger', type: 'User' } }),
      labels: ['safe-to-test'],
      headRef: 'release/trusted',
    };
    expect(classify(decoratedSameRepo, configuredPolicy)).toBe('hosted');
  });

  it('throws on malformed requests instead of guessing', () => {
    expect(() => classify({ ...request(), headRepositoryId: -1 }, configuredPolicy)).toThrow();
    expect(() =>
      classify({ ...request(), actor: { login: '', type: 'User' } }, configuredPolicy),
    ).toThrow();
  });
});

describe('admitForLocalExecution', () => {
  it('never invokes the fetching step for forks or hosted routes', async () => {
    const fetchStep = vi.fn(async () => 'fetched');
    const fork = await admitForLocalExecution(
      request({ headRepositoryId: 42 }),
      configuredPolicy,
      fetchStep,
    );
    expect(fork).toEqual({
      admitted: false,
      decision: { route: 'reject-fork', reason: 'fork-head-repository' },
    });
    const hosted = await admitForLocalExecution(
      request({ actor: { login: 'stranger', type: 'User' } }),
      configuredPolicy,
      fetchStep,
    );
    expect(hosted.admitted).toBe(false);
    expect(fetchStep).not.toHaveBeenCalled();
  });

  it('invokes the fetching step exactly once for local routes', async () => {
    const fetchStep = vi.fn(async () => 'fetched');
    const result = await admitForLocalExecution(request(), configuredPolicy, fetchStep);
    expect(result).toEqual({
      admitted: true,
      decision: { route: 'local', reason: 'trusted-local-actor' },
      value: 'fetched',
    });
    expect(fetchStep).toHaveBeenCalledTimes(1);
  });
});
