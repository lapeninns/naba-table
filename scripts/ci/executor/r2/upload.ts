import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { isSafeEvidencePath } from '../../evidence/path';
import type { R2Config } from '../config';
import {
  EMPTY_PAYLOAD_SHA256,
  sha256Hex,
  signS3Request,
  uriEncode,
  type SigV4Credentials,
} from './sigv4';

/**
 * Upload CI evidence to a private R2 bucket with SigV4-signed PUTs (no SDK) and
 * verify each object with a signed HEAD. Keys are prefixed with the day so a
 * bucket lifecycle rule on `<keyPrefix>/` can expire them after 14 days.
 */

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface EvidenceUpload {
  /** Path relative to the job evidence dir; becomes the object key suffix. */
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface UploadInput {
  readonly config: R2Config;
  readonly credentials: SigV4Credentials;
  readonly jobId: string;
  readonly files: readonly EvidenceUpload[];
  readonly now: () => Date;
}

export interface UploadDeps {
  readonly fetch: FetchLike;
  readonly readFile?: (absolutePath: string) => Buffer;
}

export interface UploadedObject {
  readonly key: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly etag: string | null;
  readonly verified: true;
}

export class R2UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'R2UploadError';
  }
}

export function evidenceObjectKey(
  config: R2Config,
  jobId: string,
  relativePath: string,
  now: Date,
): string {
  if (!isSafeEvidencePath(relativePath)) {
    throw new R2UploadError(`evidence path "${relativePath}" is not a safe object key`);
  }
  const segments = relativePath.split('/');
  const day = now.toISOString().slice(0, 10).replace(/-/gu, '/');
  return `${config.keyPrefix}/${day}/${jobId}/${segments.join('/')}`;
}

function objectUrl(config: R2Config, key: string): URL {
  return new URL(`${config.endpoint}/${config.bucket}/${uriEncode(key, false)}`);
}

async function signedFetch(
  deps: UploadDeps,
  input: UploadInput,
  method: 'PUT' | 'HEAD',
  url: URL,
  headers: Readonly<Record<string, string>>,
  payload: Buffer | null,
): Promise<Response> {
  const payloadSha256 = payload ? sha256Hex(payload) : EMPTY_PAYLOAD_SHA256;
  const signed = signS3Request({
    method,
    url,
    headers,
    payloadSha256,
    credentials: input.credentials,
    region: input.config.region,
    now: input.now(),
  });
  return deps.fetch(url.toString(), {
    method,
    headers: signed.headers,
    ...(payload ? { body: new Uint8Array(payload) } : {}),
  });
}

export async function uploadEvidence(
  input: UploadInput,
  deps: UploadDeps,
): Promise<readonly UploadedObject[]> {
  const readFile = deps.readFile ?? ((absolutePath: string) => readFileSync(absolutePath));
  const uploaded: UploadedObject[] = [];
  const day = input.now();
  for (const file of input.files) {
    const key = evidenceObjectKey(input.config, input.jobId, file.relativePath, day);
    const url = objectUrl(input.config, key);
    const payload = readFile(file.absolutePath);
    const digest = sha256Hex(payload);
    if (digest !== file.sha256 || payload.length !== file.bytes) {
      throw new R2UploadError(
        `evidence file ${file.relativePath} changed after collection; refusing to upload`,
      );
    }
    const md5 = createHash('md5').update(payload).digest('base64');
    const put = await signedFetch(
      deps,
      input,
      'PUT',
      url,
      {
        'content-type': 'application/octet-stream',
        'content-length': String(payload.length),
        'content-md5': md5,
        'x-amz-meta-sha256': digest,
        'x-amz-meta-job-id': input.jobId,
      },
      payload,
    );
    if (put.status !== 200) {
      throw new R2UploadError(`PUT ${key} failed with HTTP ${put.status}`);
    }

    const head = await signedFetch(deps, input, 'HEAD', url, {}, null);
    if (head.status !== 200) {
      throw new R2UploadError(`HEAD ${key} failed with HTTP ${head.status}; upload not verified`);
    }
    const length = head.headers.get('content-length');
    if (length !== null && Number(length) !== payload.length) {
      throw new R2UploadError(`HEAD ${key} reports ${length} bytes, expected ${payload.length}`);
    }
    const metaDigest = head.headers.get('x-amz-meta-sha256');
    if (metaDigest !== null && metaDigest !== digest) {
      throw new R2UploadError(`HEAD ${key} reports a different sha256; upload not verified`);
    }
    const etag = head.headers.get('etag');
    const hexMd5 = createHash('md5').update(payload).digest('hex');
    if (etag !== null && !etag.includes('-') && etag.replace(/"/gu, '') !== hexMd5) {
      throw new R2UploadError(`HEAD ${key} ETag does not match the uploaded payload`);
    }
    uploaded.push({ key, bytes: payload.length, sha256: digest, etag, verified: true });
  }
  return uploaded;
}
