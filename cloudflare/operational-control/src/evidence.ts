import {
  EVIDENCE_LATEST_KEY,
  EVIDENCE_MAX_AGE_MS,
  EVIDENCE_MAX_OBJECT_BYTES,
  EVIDENCE_PREFIX,
  EVIDENCE_RETENTION_DAYS,
  SERVICE_NAME,
} from './contracts';
import { redactLogFields } from '../../shared/redaction';

import type { EvidenceBucket } from './contracts';

export const EVIDENCE_KINDS = ['webhook', 'dispatch', 'cycle', 'incident'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

const EVIDENCE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/u;

export type EvidenceWriteResult =
  | { readonly ok: true; readonly key: string; readonly bytes: number }
  | {
      readonly ok: false;
      readonly reason: 'unconfigured' | 'invalid_id' | 'too_large' | 'write_failed';
    };

export type EvidenceFreshness =
  | { readonly ok: true; readonly writtenAt: string; readonly ageMs: number }
  | { readonly ok: false; readonly reason: 'unconfigured' | 'missing' | 'unreadable' | 'stale' };

export function evidenceObjectKey(kind: EvidenceKind, id: string, at: Date): string {
  const yyyy = at.getUTCFullYear().toString().padStart(4, '0');
  const mm = (at.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = at.getUTCDate().toString().padStart(2, '0');
  return `${EVIDENCE_PREFIX}/${yyyy}/${mm}/${dd}/${kind}/${id}.json`;
}

/**
 * Writes a redacted, size-capped JSON evidence object under a UTC date prefix.
 * Objects are expected to expire via a 14-day bucket lifecycle rule.
 */
export async function writeEvidence(input: {
  readonly bucket: EvidenceBucket | undefined;
  readonly kind: EvidenceKind;
  readonly id: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly now: Date;
}): Promise<EvidenceWriteResult> {
  if (!input.bucket) return { ok: false, reason: 'unconfigured' };
  if (!EVIDENCE_ID_PATTERN.test(input.id)) return { ok: false, reason: 'invalid_id' };
  const writtenAt = input.now.toISOString();
  const body = JSON.stringify({
    service: SERVICE_NAME,
    kind: input.kind,
    id: input.id,
    writtenAt,
    retentionDays: EVIDENCE_RETENTION_DAYS,
    payload: redactLogFields(input.payload),
  });
  const bytes = new TextEncoder().encode(body).byteLength;
  if (bytes > EVIDENCE_MAX_OBJECT_BYTES) return { ok: false, reason: 'too_large' };
  const key = evidenceObjectKey(input.kind, input.id, input.now);
  try {
    await input.bucket.put(key, body, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { kind: input.kind, writtenAt },
    });
    await input.bucket.put(
      EVIDENCE_LATEST_KEY,
      JSON.stringify({ key, kind: input.kind, writtenAt }),
      { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
    );
  } catch {
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true, key, bytes };
}

/** Reads only the small `latest` pointer; evidence payloads are never loaded here. */
export async function checkEvidenceFreshness(input: {
  readonly bucket: EvidenceBucket | undefined;
  readonly nowMs: number;
  readonly maxAgeMs?: number;
}): Promise<EvidenceFreshness> {
  if (!input.bucket) return { ok: false, reason: 'unconfigured' };
  let text: string;
  try {
    const object = await input.bucket.get(EVIDENCE_LATEST_KEY);
    if (!object) return { ok: false, reason: 'missing' };
    text = await object.text();
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (text.length > 1024) return { ok: false, reason: 'unreadable' };
  let writtenAtMs = Number.NaN;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && 'writtenAt' in parsed) {
      writtenAtMs = Date.parse(String((parsed as { writtenAt: unknown }).writtenAt));
    }
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (!Number.isFinite(writtenAtMs)) return { ok: false, reason: 'unreadable' };
  const ageMs = input.nowMs - writtenAtMs;
  if (ageMs < 0 || ageMs > (input.maxAgeMs ?? EVIDENCE_MAX_AGE_MS)) {
    return { ok: false, reason: 'stale' };
  }
  return { ok: true, writtenAt: new Date(writtenAtMs).toISOString(), ageMs };
}
