import { describe, expect, it } from 'vitest';

import { createFakeBucket, NOW_MS } from './helpers/fixtures';
import { EVIDENCE_LATEST_KEY, EVIDENCE_MAX_OBJECT_BYTES } from '../src/contracts';
import { checkEvidenceFreshness, evidenceObjectKey, writeEvidence } from '../src/evidence';

describe('evidence writes', () => {
  it('writes a redacted JSON object under a UTC date prefix and updates the latest pointer', async () => {
    const bucket = createFakeBucket();
    const result = await writeEvidence({
      bucket,
      kind: 'webhook',
      id: 'delivery-1',
      payload: {
        eventType: 'check_run',
        token: 'should-not-persist',
        contact: 'guest@example.com',
        nested: { authorization: 'Bearer abc', ok: true },
      },
      now: new Date(NOW_MS),
    });
    expect(result).toEqual({
      ok: true,
      key: 'evidence/2026/09/04/webhook/delivery-1.json',
      bytes: expect.any(Number),
    });
    const stored = JSON.parse(
      bucket.objects.get('evidence/2026/09/04/webhook/delivery-1.json') ?? '',
    );
    expect(stored.retentionDays).toBe(14);
    expect(stored.payload.token).toBe('[REDACTED]');
    expect(stored.payload.contact).toBe('[REDACTED]');
    expect(stored.payload.nested.authorization).toBe('[REDACTED]');
    expect(stored.payload.nested.ok).toBe(true);
    expect(JSON.stringify(stored)).not.toContain('should-not-persist');
    const latest = JSON.parse(bucket.objects.get(EVIDENCE_LATEST_KEY) ?? '');
    expect(latest).toEqual({
      key: 'evidence/2026/09/04/webhook/delivery-1.json',
      kind: 'webhook',
      writtenAt: new Date(NOW_MS).toISOString(),
    });
    expect(evidenceObjectKey('cycle', 'c1', new Date('2026-01-05T23:59:59Z'))).toBe(
      'evidence/2026/01/05/cycle/c1.json',
    );
  });

  it('fails closed on missing bucket, invalid ids, oversized payloads and storage errors', async () => {
    const now = new Date(NOW_MS);
    await expect(
      writeEvidence({ bucket: undefined, kind: 'cycle', id: 'x', payload: {}, now }),
    ).resolves.toEqual({ ok: false, reason: 'unconfigured' });
    const bucket = createFakeBucket();
    await expect(
      writeEvidence({ bucket, kind: 'cycle', id: '../escape', payload: {}, now }),
    ).resolves.toEqual({ ok: false, reason: 'invalid_id' });
    await expect(
      writeEvidence({
        bucket,
        kind: 'cycle',
        id: 'big',
        payload: { blob: 'x'.repeat(EVIDENCE_MAX_OBJECT_BYTES) },
        now,
      }),
    ).resolves.toEqual({ ok: false, reason: 'too_large' });
    expect(bucket.objects.size).toBe(0);
    bucket.failPut = true;
    await expect(
      writeEvidence({ bucket, kind: 'cycle', id: 'c', payload: {}, now }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });
});

describe('evidence freshness', () => {
  it('reads only the latest pointer and classifies missing, unreadable, stale and fresh state', async () => {
    await expect(checkEvidenceFreshness({ bucket: undefined, nowMs: NOW_MS })).resolves.toEqual({
      ok: false,
      reason: 'unconfigured',
    });
    const bucket = createFakeBucket();
    await expect(checkEvidenceFreshness({ bucket, nowMs: NOW_MS })).resolves.toEqual({
      ok: false,
      reason: 'missing',
    });
    bucket.objects.set(EVIDENCE_LATEST_KEY, 'not json');
    await expect(checkEvidenceFreshness({ bucket, nowMs: NOW_MS })).resolves.toEqual({
      ok: false,
      reason: 'unreadable',
    });
    bucket.objects.set(EVIDENCE_LATEST_KEY, JSON.stringify({ writtenAt: 'x'.repeat(1100) }));
    await expect(checkEvidenceFreshness({ bucket, nowMs: NOW_MS })).resolves.toEqual({
      ok: false,
      reason: 'unreadable',
    });
    bucket.objects.set(EVIDENCE_LATEST_KEY, JSON.stringify({ writtenAt: 'soon' }));
    await expect(checkEvidenceFreshness({ bucket, nowMs: NOW_MS })).resolves.toEqual({
      ok: false,
      reason: 'unreadable',
    });
    const writtenAt = new Date(NOW_MS - 25 * 60 * 60 * 1000).toISOString();
    bucket.objects.set(EVIDENCE_LATEST_KEY, JSON.stringify({ writtenAt }));
    await expect(checkEvidenceFreshness({ bucket, nowMs: NOW_MS })).resolves.toEqual({
      ok: false,
      reason: 'stale',
    });
    bucket.objects.set(
      EVIDENCE_LATEST_KEY,
      JSON.stringify({ writtenAt: new Date(NOW_MS + 60_000).toISOString() }),
    );
    await expect(checkEvidenceFreshness({ bucket, nowMs: NOW_MS })).resolves.toEqual({
      ok: false,
      reason: 'stale',
    });
    const fresh = new Date(NOW_MS - 5 * 60_000).toISOString();
    bucket.objects.set(EVIDENCE_LATEST_KEY, JSON.stringify({ writtenAt: fresh }));
    await expect(checkEvidenceFreshness({ bucket, nowMs: NOW_MS })).resolves.toEqual({
      ok: true,
      writtenAt: fresh,
      ageMs: 5 * 60_000,
    });
    bucket.failGet = true;
    await expect(checkEvidenceFreshness({ bucket, nowMs: NOW_MS })).resolves.toEqual({
      ok: false,
      reason: 'unreadable',
    });
  });
});
