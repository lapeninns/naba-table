import { createHash, createHmac } from 'node:crypto';

/**
 * AWS Signature Version 4 for S3-compatible object stores (Cloudflare R2),
 * implemented with node:crypto only. Header-based signing, single chunk,
 * `x-amz-content-sha256` always set to the real payload hash.
 */

export interface SigV4Credentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface SigV4Input {
  readonly method: 'GET' | 'PUT' | 'HEAD' | 'DELETE';
  readonly url: URL;
  /** Additional headers to sign. `host`, `x-amz-date`, `x-amz-content-sha256` are added. */
  readonly headers: Readonly<Record<string, string>>;
  /** Hex sha256 of the payload (empty-body hash for GET/HEAD). */
  readonly payloadSha256: string;
  readonly credentials: SigV4Credentials;
  readonly region: string;
  readonly service?: string;
  readonly now: Date;
}

export interface SigV4Output {
  readonly headers: Readonly<Record<string, string>>;
  readonly canonicalRequest: string;
  readonly stringToSign: string;
  readonly signature: string;
  readonly signedHeaders: string;
}

export const EMPTY_PAYLOAD_SHA256 = sha256Hex(Buffer.alloc(0));

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

export function amzDate(now: Date): { amz: string; date: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/gu, '');
  return { amz: iso, date: iso.slice(0, 8) };
}

/** RFC 3986 encoding as required by SigV4 (encodes everything except unreserved). */
export function uriEncode(value: string, encodeSlash: boolean): string {
  let out = '';
  for (const char of value) {
    if (/[A-Za-z0-9_.~-]/u.test(char) || (char === '/' && !encodeSlash)) {
      out += char;
      continue;
    }
    for (const byte of Buffer.from(char, 'utf8')) {
      out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return out;
}

function canonicalQuery(url: URL): string {
  const pairs: Array<[string, string]> = [];
  for (const [key, value] of url.searchParams.entries()) {
    pairs.push([uriEncode(key, true), uriEncode(value, true)]);
  }
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  return pairs.map(([key, value]) => `${key}=${value}`).join('&');
}

function normalizeHeaderValue(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function signS3Request(input: SigV4Input): SigV4Output {
  const service = input.service ?? 's3';
  const { amz, date } = amzDate(input.now);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.headers)) {
    headers[key.toLowerCase()] = normalizeHeaderValue(value);
  }
  headers.host = input.url.host;
  headers['x-amz-date'] = amz;
  headers['x-amz-content-sha256'] = input.payloadSha256;

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((key) => `${key}:${headers[key]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  // Path segments are encoded once; the URL class already percent-encodes, so
  // decode first to avoid double encoding of characters like `$`.
  const canonicalPath = uriEncode(decodeURIComponent(input.url.pathname) || '/', false);
  const canonicalRequest = [
    input.method,
    canonicalPath,
    canonicalQuery(input.url),
    canonicalHeaders,
    signedHeaders,
    input.payloadSha256,
  ].join('\n');

  const scope = `${date}/${input.region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${input.credentials.secretAccessKey}`, date);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: { ...headers, authorization },
    canonicalRequest,
    stringToSign,
    signature,
    signedHeaders,
  };
}
