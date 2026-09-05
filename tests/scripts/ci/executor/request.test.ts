import { describe, expect, it } from 'vitest';

import {
  CiRequestError,
  ciJobId,
  parseCiRequest,
  parseRequestEnvelope,
} from '@/scripts/ci/executor/request';

import { mainRequest, prRequest, REPOSITORY_ID, SHA_BASE, SHA_HEAD } from './helpers';

describe('parseCiRequest', () => {
  it('accepts a well-formed pr tuple and freezes it', () => {
    const parsed = parseCiRequest(prRequest(), REPOSITORY_ID);
    expect(parsed).toEqual(prRequest());
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it('rejects unknown fields so PR-controlled docker flags cannot be smuggled', () => {
    expect(() =>
      parseCiRequest({ ...prRequest(), dockerArgs: ['--privileged'] }, REPOSITORY_ID),
    ).toThrow(/dockerArgs/u);
    expect(() => parseCiRequest({ ...prRequest(), env: { X: '1' } }, REPOSITORY_ID)).toThrow(
      CiRequestError,
    );
  });

  it('rejects flag-looking or shell-looking version tokens', () => {
    for (const bad of ['--privileged', '-v', '1.0.0;rm', '1.0.0 --cap-add=ALL', '`id`']) {
      expect(() => parseCiRequest(prRequest({ controllerVersion: bad }), REPOSITORY_ID)).toThrow(
        CiRequestError,
      );
    }
  });

  it('rejects a repository id that is not the configured one', () => {
    expect(() => parseCiRequest(prRequest(), REPOSITORY_ID + 1)).toThrow(/does not match/u);
    expect(() => parseCiRequest(prRequest({ repositoryId: 1 }), REPOSITORY_ID)).toThrow(
      /does not match/u,
    );
  });

  it('rejects malformed SHAs, digests and attempts', () => {
    expect(() => parseCiRequest(prRequest({ headSha: 'abc' }), REPOSITORY_ID)).toThrow(/headSha/u);
    expect(() =>
      parseCiRequest(prRequest({ headSha: SHA_HEAD.toUpperCase() }), REPOSITORY_ID),
    ).toThrow(/headSha/u);
    expect(() => parseCiRequest(prRequest({ imageDigest: 'REPLACE_ME' }), REPOSITORY_ID)).toThrow(
      /imageDigest/u,
    );
    expect(() => parseCiRequest(prRequest({ attempt: 0 }), REPOSITORY_ID)).toThrow(/attempt/u);
    expect(() => parseCiRequest(prRequest({ attempt: 99 }), REPOSITORY_ID)).toThrow(/attempt/u);
  });

  it('enforces the SHA tuple shape per profile', () => {
    expect(() => parseCiRequest(prRequest({ testedSha: SHA_HEAD }), REPOSITORY_ID)).toThrow(
      /testedSha/u,
    );
    expect(() => parseCiRequest(prRequest({ testedSha: SHA_BASE }), REPOSITORY_ID)).toThrow(
      /differ from baseSha/u,
    );
    expect(() => parseCiRequest(prRequest({ prNumber: undefined }), REPOSITORY_ID)).toThrow(
      /prNumber/u,
    );
    expect(() => parseCiRequest(mainRequest({ testedSha: SHA_BASE }), REPOSITORY_ID)).toThrow(
      /testedSha/u,
    );
    expect(() => parseCiRequest(mainRequest({ prNumber: 3 }), REPOSITORY_ID)).toThrow(/prNumber/u);
  });

  it('rejects non-object input', () => {
    expect(() => parseCiRequest('{}', REPOSITORY_ID)).toThrow(CiRequestError);
    expect(() => parseCiRequest([], REPOSITORY_ID)).toThrow(CiRequestError);
  });
});

describe('parseRequestEnvelope', () => {
  it('accepts a bare tuple', () => {
    expect(parseRequestEnvelope(mainRequest(), REPOSITORY_ID)).toEqual({
      request: mainRequest(),
      mode: null,
      allocation: null,
    });
  });

  it('accepts the controller envelope and validates the allocation', () => {
    const envelope = parseRequestEnvelope(
      { request: mainRequest(), mode: 'dedicated', allocation: { cpus: 4, memoryGiB: 8 } },
      REPOSITORY_ID,
    );
    expect(envelope.mode).toBe('dedicated');
    expect(envelope.allocation).toEqual({ cpus: 4, memoryGiB: 8 });
  });

  it('rejects unknown envelope fields, bad modes and bad allocations', () => {
    expect(() =>
      parseRequestEnvelope({ request: mainRequest(), extra: true }, REPOSITORY_ID),
    ).toThrow(/unknown envelope field/u);
    expect(() =>
      parseRequestEnvelope({ request: mainRequest(), mode: 'root' }, REPOSITORY_ID),
    ).toThrow(/mode/u);
    expect(() =>
      parseRequestEnvelope(
        { request: mainRequest(), allocation: { cpus: 0, memoryGiB: 8 } },
        REPOSITORY_ID,
      ),
    ).toThrow(/allocation/u);
    expect(() =>
      parseRequestEnvelope(
        { request: mainRequest(), allocation: { cpus: 2, memoryGiB: 8, flags: '--privileged' } },
        REPOSITORY_ID,
      ),
    ).toThrow(/allocation/u);
  });
});

describe('ciJobId', () => {
  it('derives a docker-safe id from the tuple', () => {
    expect(ciJobId(prRequest())).toBe(`ci-pr-${prRequest().testedSha.slice(0, 12)}-a1`);
    expect(ciJobId(mainRequest({ attempt: 3 }))).toMatch(/^ci-main-[0-9a-f]{12}-a3$/u);
  });
});
