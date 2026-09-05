import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadR2Credentials } from '@/scripts/ci/executor/r2/credentials';
import {
  amzDate,
  EMPTY_PAYLOAD_SHA256,
  sha256Hex,
  signS3Request,
  uriEncode,
} from '@/scripts/ci/executor/r2/sigv4';
import {
  evidenceObjectKey,
  R2UploadError,
  uploadEvidence,
  type FetchLike,
} from '@/scripts/ci/executor/r2/upload';

import { cleanupTempDirs, FakeRunner, makeTempDir, okResult, when } from './helpers';

afterEach(cleanupTempDirs);

describe('SigV4', () => {
  /**
   * AWS "Signature Calculations for the Authorization Header" example:
   * GET /test.txt on examplebucket with Range header, 2013-05-24.
   */
  it('reproduces the published AWS S3 GET Object signing vector', () => {
    const signed = signS3Request({
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      headers: { Range: 'bytes=0-9' },
      payloadSha256: EMPTY_PAYLOAD_SHA256,
      credentials: {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
      region: 'us-east-1',
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(signed.canonicalRequest).toBe(
      [
        'GET',
        '/test.txt',
        '',
        'host:examplebucket.s3.amazonaws.com',
        'range:bytes=0-9',
        'x-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'x-amz-date:20130524T000000Z',
        '',
        'host;range;x-amz-content-sha256;x-amz-date',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      ].join('\n'),
    );
    expect(signed.stringToSign).toBe(
      [
        'AWS4-HMAC-SHA256',
        '20130524T000000Z',
        '20130524/us-east-1/s3/aws4_request',
        '7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972',
      ].join('\n'),
    );
    expect(signed.signature).toBe(
      'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
    expect(signed.headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('encodes keys per RFC 3986 and formats dates', () => {
    expect(uriEncode('a b/c$d~e', false)).toBe('a%20b/c%24d~e');
    expect(uriEncode('a/b', true)).toBe('a%2Fb');
    expect(amzDate(new Date('2026-09-04T12:34:56.789Z'))).toEqual({
      amz: '20260904T123456Z',
      date: '20260904',
    });
    expect(sha256Hex('')).toBe(EMPTY_PAYLOAD_SHA256);
  });
});

const r2 = {
  endpoint: 'https://acct.r2.cloudflarestorage.com',
  bucket: 'nabatable-ci-evidence',
  keyPrefix: 'ci-evidence/ttl-14d',
  region: 'auto',
};
const credentials = {
  accessKeyId: 'AKIDEXAMPLE0000000000',
  secretAccessKey: 'secret-example-value-0000000000',
};
const NOW = new Date('2026-09-04T10:00:00Z');

describe('evidenceObjectKey', () => {
  it('prefixes objects with the day so lifecycle rules can expire them', () => {
    expect(
      evidenceObjectKey(r2, 'ci-pr-000000000000-a1', 'coverage/coverage-summary.json', NOW),
    ).toBe('ci-evidence/ttl-14d/2026/09/04/ci-pr-000000000000-a1/coverage/coverage-summary.json');
  });

  it('rejects traversal and unsafe key segments', () => {
    expect(() => evidenceObjectKey(r2, 'job', '../secret', NOW)).toThrow(R2UploadError);
    expect(() => evidenceObjectKey(r2, 'job', 'a//b', NOW)).toThrow(R2UploadError);
    expect(() => evidenceObjectKey(r2, 'job', 'a b.txt', NOW)).toThrow(R2UploadError);
  });
});

interface Captured {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: Uint8Array | null;
}

function fakeFetch(
  stored: Map<string, Uint8Array>,
  captured: Captured[],
  options: { headStatus?: number; putStatus?: number; lieAboutLength?: boolean } = {},
): FetchLike {
  return async (url, init) => {
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>),
    );
    const body = init.body instanceof Uint8Array ? init.body : null;
    captured.push({ method: init.method ?? 'GET', url, headers, body });
    if (init.method === 'PUT') {
      if (body) stored.set(url, body);
      return new Response(null, { status: options.putStatus ?? 200 });
    }
    const object = stored.get(url);
    if (!object || options.headStatus === 404) return new Response(null, { status: 404 });
    return new Response(null, {
      status: options.headStatus ?? 200,
      headers: {
        'content-length': String(options.lieAboutLength ? object.length + 1 : object.length),
        'x-amz-meta-sha256': createHash('sha256').update(object).digest('hex'),
        etag: `"${createHash('md5').update(object).digest('hex')}"`,
      },
    });
  };
}

function evidenceFile(dir: string, name: string, content: string) {
  const absolutePath = path.join(dir, name);
  writeFileSync(absolutePath, content);
  return {
    relativePath: name,
    absolutePath,
    sha256: createHash('sha256').update(content).digest('hex'),
    bytes: Buffer.byteLength(content),
  };
}

describe('uploadEvidence', () => {
  it('PUTs each file with a signed request and verifies it with a signed HEAD', async () => {
    const dir = makeTempDir();
    const stored = new Map<string, Uint8Array>();
    const captured: Captured[] = [];
    const files = [
      evidenceFile(dir, 'result.json', '{"ok":true}'),
      evidenceFile(dir, 'junit.xml', '<x/>'),
    ];
    const uploaded = await uploadEvidence(
      { config: r2, credentials, jobId: 'ci-main-000000000000-a1', files, now: () => NOW },
      { fetch: fakeFetch(stored, captured) },
    );
    expect(uploaded.map((object) => object.key)).toEqual([
      'ci-evidence/ttl-14d/2026/09/04/ci-main-000000000000-a1/result.json',
      'ci-evidence/ttl-14d/2026/09/04/ci-main-000000000000-a1/junit.xml',
    ]);
    expect(uploaded.every((object) => object.verified)).toBe(true);
    expect(captured.map((call) => call.method)).toEqual(['PUT', 'HEAD', 'PUT', 'HEAD']);
    for (const call of captured) {
      expect(
        call.url.startsWith(`${r2.endpoint}/${r2.bucket}/ci-evidence/ttl-14d/2026/09/04/`),
      ).toBe(true);
      expect(call.headers.authorization).toMatch(
        /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE0000000000\/20260904\/auto\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]*host;[a-z0-9;-]*x-amz-date[a-z0-9;-]*, Signature=[0-9a-f]{64}$/u,
      );
      expect(call.headers['x-amz-date']).toBe('20260904T100000Z');
      expect(JSON.stringify(call.headers)).not.toContain(credentials.secretAccessKey);
    }
    expect(captured[0].headers['x-amz-content-sha256']).toBe(files[0].sha256);
    expect(captured[0].headers['content-md5']).toBe(
      createHash('md5').update('{"ok":true}').digest('base64'),
    );
    expect(captured[1].headers['x-amz-content-sha256']).toBe(EMPTY_PAYLOAD_SHA256);
  });

  it('refuses when the HEAD verification disagrees or fails', async () => {
    const dir = makeTempDir();
    const files = [evidenceFile(dir, 'result.json', '{}')];
    const input = { config: r2, credentials, jobId: 'job', files, now: () => NOW };
    await expect(
      uploadEvidence(input, { fetch: fakeFetch(new Map(), [], { headStatus: 404 }) }),
    ).rejects.toThrow(/upload not verified/u);
    await expect(
      uploadEvidence(input, { fetch: fakeFetch(new Map(), [], { lieAboutLength: true }) }),
    ).rejects.toThrow(/reports 3 bytes, expected 2/u);
    await expect(
      uploadEvidence(input, { fetch: fakeFetch(new Map(), [], { putStatus: 403 }) }),
    ).rejects.toThrow(/PUT .* failed with HTTP 403/u);
  });

  it('refuses to upload a file that changed after collection', async () => {
    const dir = makeTempDir();
    const file = evidenceFile(dir, 'result.json', '{}');
    writeFileSync(file.absolutePath, '{"tampered":true}');
    await expect(
      uploadEvidence(
        { config: r2, credentials, jobId: 'job', files: [file], now: () => NOW },
        { fetch: fakeFetch(new Map(), []) },
      ),
    ).rejects.toThrow(/changed after collection/u);
  });
});

describe('loadR2Credentials', () => {
  const keychain = {
    account: 'nabatable-ci',
    r2AccessKeyIdService: 'nabatable-ci/r2/evidence/access-key-id',
    r2SecretAccessKeyService: 'nabatable-ci/r2/evidence/secret-access-key',
  };

  it('prefers env credentials and rejects placeholders', async () => {
    const env = {
      NABATABLE_CI_R2_ACCESS_KEY_ID: 'AKIDEXAMPLE0000000000',
      NABATABLE_CI_R2_SECRET_ACCESS_KEY: 'secret-example-value-0000000000',
    };
    const ok = await loadR2Credentials({ env, keychain });
    expect(ok).toEqual({ ok: true, source: 'env', credentials: credentials });
    const placeholder = await loadR2Credentials({
      env: { ...env, NABATABLE_CI_R2_SECRET_ACCESS_KEY: 'REPLACE_ME_R2_SECRET' },
      keychain,
    });
    expect(placeholder.ok).toBe(false);
  });

  it('falls back to the Keychain items named in the operating facts and never logs values', async () => {
    const runner = new FakeRunner([
      when(
        'security',
        ['find-generic-password', '-s', keychain.r2AccessKeyIdService],
        okResult({ stdout: 'AKIDKEYCHAIN000000000\n' }),
      ),
      when(
        'security',
        ['find-generic-password', '-s', keychain.r2SecretAccessKeyService],
        okResult({ stdout: 'keychain-secret-value-000000\n' }),
      ),
    ]);
    const result = await loadR2Credentials({ env: {}, keychain, runner, pathEnv: '/usr/bin' });
    expect(result).toEqual({
      ok: true,
      source: 'keychain',
      credentials: {
        accessKeyId: 'AKIDKEYCHAIN000000000',
        secretAccessKey: 'keychain-secret-value-000000',
      },
    });
    for (const call of runner.calls) {
      expect(call.args).toContain('-a');
      expect(call.args).toContain('nabatable-ci');
      expect(call.args).toContain('-w');
    }
  });

  it('reports unconfigured when nothing is available', async () => {
    const runner = new FakeRunner([
      when('security', [], okResult({ exitCode: 44, stderr: 'not found' })),
    ]);
    const result = await loadR2Credentials({ env: {}, keychain, runner });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unconfigured/u);
  });
});
