import { describe, expect, it } from 'vitest';

import { evaluateReleaseGate } from '@/scripts/ci/gate/evaluate-core';
import { publishGateDecision, renderDecisionText } from '@/scripts/ci/gate/publish';

import {
  HEAD_SHA,
  MERGE_SHA,
  NOW,
  OTHER_REPO_ID,
  configuredPolicy,
  localResult,
  prRequest,
  prTuple,
  prWorld,
  suiteResults,
} from './helpers';

describe('publishGateDecision', () => {
  it('publishes the gate and every compatibility check on head and merge commits', async () => {
    const api = prWorld();
    const policy = configuredPolicy();
    const decision = await evaluateReleaseGate({
      api,
      policy,
      request: prRequest(),
      mode: 'merge',
      now: () => NOW,
    });
    const published = await publishGateDecision(api, policy.policy, decision);
    // 2 commits x (Release gate + 8 compatibility checks)
    expect(published).toHaveLength(18);
    expect(new Set(published.map((check) => check.headSha))).toEqual(
      new Set([HEAD_SHA, MERGE_SHA]),
    );
    expect(published.filter((check) => check.name === 'Release gate')).toHaveLength(2);
    expect(published.every((check) => check.conclusion === 'success')).toBe(true);
    const created = api.state.created[0];
    expect(created.externalId).toBe(decision.tupleKey);
    expect(created.text).toContain('Evidence source: local');
    expect(created.detailsUrl).toBe('https://evidence.example/1');
  });

  it('fails every compatibility check closed when the gate refuses', async () => {
    const api = prWorld({
      evidence: localResult(prTuple(), {
        coverage: { status: 'failed', evidenceDigest: `sha256:${'9'.repeat(64)}` },
      }),
    });
    const policy = configuredPolicy();
    const decision = await evaluateReleaseGate({
      api,
      policy,
      request: prRequest(),
      mode: 'merge',
      now: () => NOW,
    });
    const published = await publishGateDecision(api, policy.policy, decision);
    expect(published.every((check) => check.conclusion === 'failure')).toBe(true);
    expect(api.state.created[0].title).toBe('Release gate refused');
    expect(api.state.created[0].text).toContain('[coverage-failed]');
  });

  it('publishes a skipped conditional suite as success and a skipped required suite as failure', async () => {
    const api = prWorld({
      evidence: localResult(prTuple(), {
        suites: suiteResults({ 'shuffle-seed-20260715': { status: 'skipped' } }),
      }),
    });
    const policy = configuredPolicy();
    const decision = await evaluateReleaseGate({
      api,
      policy,
      request: prRequest(),
      mode: 'merge',
      now: () => NOW,
    });
    expect(decision.ok).toBe(true);
    const published = await publishGateDecision(api, policy.policy, decision);
    const shuffle = published.filter((check) => check.name === 'Shuffle seed 20260715');
    expect(shuffle.map((check) => check.conclusion)).toEqual(['success', 'success']);
    const summary = api.state.created.find((input) => input.name === 'Shuffle seed 20260715');
    expect(summary?.summary).toContain('skipped by its changed-path rule');
  });

  it('publishes nothing for foundational refusals', async () => {
    const api = prWorld();
    const policy = configuredPolicy();
    const decision = await evaluateReleaseGate({
      api,
      policy,
      request: prRequest({ repositoryId: OTHER_REPO_ID }),
      mode: 'merge',
      now: () => NOW,
    });
    expect(decision.publishable).toBe(false);
    expect(await publishGateDecision(api, policy.policy, decision)).toEqual([]);
    expect(api.state.created).toEqual([]);
  });

  it('renders a bounded, secret-free decision text', async () => {
    const api = prWorld();
    const decision = await evaluateReleaseGate({
      api,
      policy: configuredPolicy(),
      request: prRequest(),
      mode: 'merge',
      now: () => NOW,
    });
    const text = renderDecisionText(decision);
    expect(text).toContain(`Head: ${HEAD_SHA}`);
    expect(text).toContain('Refusals:\nNo refusals.');
    expect(text.length).toBeLessThanOrEqual(60_000);
  });
});
