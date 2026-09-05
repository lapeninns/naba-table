import { describe, expect, it } from 'vitest';

import {
  amzDate,
  createS3Client,
  encodeS3Key,
  parseListObjectsXml,
  resolveS3ConfigFromEnv,
  S3Error,
  signS3Request,
  type S3Config,
} from '../../scripts/db/backup/s3';

const CONFIG: S3Config = {
  endpoint: 'https://backups.example.invalid',
  region: 'auto',
  bucket: 'nabatable-backups',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
};

describe('SigV4 signer', () => {
  it('produces a stable canonical signature for the same input', () => {
    const now = new Date('2026-09-04T12:34:56.000Z');
    const signed = signS3Request(CONFIG, {
      method: 'PUT',
      path: '/nabatable-backups/backups/bk-1/core.dump.enc',
      query: {},
      headers: { 'content-type': 'application/octet-stream' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      now,
    });
    expect(amzDate(now)).toEqual({ amzDate: '20260904T123456Z', dateStamp: '20260904' });
    expect(signed.url).toBe(
      'https://backups.example.invalid/nabatable-backups/backups/bk-1/core.dump.enc',
    );
    expect(signed.headers['x-amz-date']).toBe('20260904T123456Z');
    expect(signed.headers.host).toBeUndefined();
    expect(signed.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20260904\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[a-f0-9]{64}$/,
    );
    const again = signS3Request(CONFIG, {
      method: 'PUT',
      path: '/nabatable-backups/backups/bk-1/core.dump.enc',
      query: {},
      headers: { 'content-type': 'application/octet-stream' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      now,
    });
    expect(again.headers.authorization).toBe(signed.headers.authorization);
    expect(signed.headers.authorization).not.toContain(CONFIG.secretAccessKey);
  });

  it('adds the session token to the signed headers when present', () => {
    const signed = signS3Request(
      { ...CONFIG, sessionToken: 'tok' },
      {
        method: 'GET',
        path: '/nabatable-backups/',
        query: { 'list-type': '2', prefix: 'backups/' },
        headers: {},
        payloadHash: 'x',
        now: new Date(0),
      },
    );
    expect(signed.headers['x-amz-security-token']).toBe('tok');
    expect(signed.url).toBe(
      'https://backups.example.invalid/nabatable-backups/?list-type=2&prefix=backups%2F',
    );
  });

  it('encodes keys per segment', () => {
    expect(encodeS3Key('backups/bk 1/a+b(c).enc')).toBe('backups/bk%201/a%2Bb%28c%29.enc');
  });
});

describe('S3 client', () => {
  it('parses ListObjectsV2 pages', () => {
    const page = parseListObjectsXml(
      '<ListBucketResult><Contents><Key>backups/bk-1/manifest.json</Key><Size>12</Size><LastModified>2026-09-04T00:00:00.000Z</LastModified><ETag>&quot;abc&quot;</ETag></Contents><NextContinuationToken>t&amp;2</NextContinuationToken></ListBucketResult>',
    );
    expect(page.objects).toEqual([
      {
        key: 'backups/bk-1/manifest.json',
        size: 12,
        lastModified: '2026-09-04T00:00:00.000Z',
        etag: 'abc',
      },
    ]);
    expect(page.nextToken).toBe('t&2');
  });

  it('signs every request, follows continuation tokens and surfaces failures', async () => {
    const calls: { url: string; method: string; auth: string }[] = [];
    const client = createS3Client(CONFIG, {
      now: () => new Date('2026-09-04T00:00:00Z'),
      fetch: async (url, init) => {
        const headers = init.headers as Record<string, string>;
        calls.push({ url, method: init.method ?? '', auth: headers.authorization ?? '' });
        if (init.method === 'GET' && url.includes('list-type')) {
          const second = url.includes('continuation-token');
          return new Response(
            second
              ? '<R><Contents><Key>backups/b</Key><Size>1</Size></Contents></R>'
              : '<R><Contents><Key>backups/a</Key><Size>1</Size></Contents><NextContinuationToken>n</NextContinuationToken></R>',
          );
        }
        if (init.method === 'HEAD') return new Response(null, { status: 404 });
        if (init.method === 'PUT') return new Response(null, { status: 403 });
        return new Response('body', { status: 200 });
      },
    });
    const listed = await client.listObjects('backups/');
    expect(listed.map((object) => object.key)).toEqual(['backups/a', 'backups/b']);
    expect(await client.headObject('backups/missing')).toBeNull();
    await expect(client.putObject('backups/x', Buffer.from('x'))).rejects.toThrow(S3Error);
    expect(calls.every((call) => call.auth.startsWith('AWS4-HMAC-SHA256'))).toBe(true);
  });

  it('reports missing env instead of guessing', () => {
    expect(resolveS3ConfigFromEnv({}, 'b')).toEqual({
      kind: 'unconfigured',
      missing: [
        'BACKUP_S3_ENDPOINT',
        'BACKUP_S3_REGION',
        'BACKUP_S3_ACCESS_KEY_ID',
        'BACKUP_S3_SECRET_ACCESS_KEY',
      ],
    });
    expect(
      resolveS3ConfigFromEnv(
        {
          BACKUP_S3_ENDPOINT: 'http://insecure',
          BACKUP_S3_REGION: 'auto',
          BACKUP_S3_ACCESS_KEY_ID: 'a',
          BACKUP_S3_SECRET_ACCESS_KEY: 'b',
        },
        'b',
      ),
    ).toEqual({
      kind: 'unconfigured',
      missing: ['BACKUP_S3_ENDPOINT'],
    });
    const configured = resolveS3ConfigFromEnv(
      {
        BACKUP_S3_ENDPOINT: 'https://r2.example.invalid',
        BACKUP_S3_REGION: 'auto',
        BACKUP_S3_ACCESS_KEY_ID: 'a',
        BACKUP_S3_SECRET_ACCESS_KEY: 'b',
      },
      'bucket',
    );
    expect(configured.kind).toBe('configured');
  });
});
