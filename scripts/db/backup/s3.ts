import { createHash, createHmac } from 'node:crypto';

/**
 * Minimal S3-compatible client with AWS SigV4 signing, node built-ins only.
 *
 * Deliberately self-contained: the backup credential boundary must not share code or
 * configuration with CI evidence storage (scripts/ci/**). Path-style addressing is
 * used so the same code works against AWS S3, Cloudflare R2 and MinIO-like stores.
 */

export type S3Config = {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
};

export type S3ObjectSummary = {
  readonly key: string;
  readonly size: number;
  readonly lastModified: string;
  readonly etag: string;
};

export type S3HeadResult = {
  readonly size: number;
  readonly etag: string;
  readonly lastModified: string | null;
};

export type S3Client = {
  putObject(
    key: string,
    body: Buffer,
    options?: { readonly contentType?: string },
  ): Promise<{ readonly etag: string }>;
  getObject(key: string): Promise<Buffer | null>;
  headObject(key: string): Promise<S3HeadResult | null>;
  listObjects(prefix: string): Promise<readonly S3ObjectSummary[]>;
  deleteObject(key: string): Promise<void>;
};

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type S3ClientDeps = {
  readonly fetch: FetchLike;
  readonly now?: () => Date;
};

export class S3Error extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'S3Error';
  }
}

export const BACKUP_S3_ENV = {
  endpoint: 'BACKUP_S3_ENDPOINT',
  region: 'BACKUP_S3_REGION',
  accessKeyId: 'BACKUP_S3_ACCESS_KEY_ID',
  secretAccessKey: 'BACKUP_S3_SECRET_ACCESS_KEY',
  sessionToken: 'BACKUP_S3_SESSION_TOKEN',
} as const;

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

export function amzDate(now: Date): { readonly amzDate: string; readonly dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function encodeS3Key(key: string): string {
  return key.split('/').map(encodeRfc3986).join('/');
}

export type SignedRequest = {
  readonly url: string;
  readonly headers: Record<string, string>;
};

export type SignInput = {
  readonly method: 'GET' | 'PUT' | 'HEAD' | 'DELETE';
  readonly path: string; // already encoded, starts with '/'
  readonly query: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly payloadHash: string;
  readonly now: Date;
};

/** Pure SigV4 signer (exported for tests). */
export function signS3Request(config: S3Config, input: SignInput): SignedRequest {
  const endpoint = new URL(config.endpoint);
  const host = endpoint.host;
  const { amzDate: amz, dateStamp } = amzDate(input.now);

  const headers: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(input.headers).map(([name, value]) => [name.toLowerCase(), value.trim()]),
    ),
    host,
    'x-amz-content-sha256': input.payloadHash,
    'x-amz-date': amz,
  };
  if (config.sessionToken) headers['x-amz-security-token'] = config.sessionToken;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalQuery = Object.keys(input.query)
    .sort()
    .map((name) => `${encodeRfc3986(name)}=${encodeRfc3986(input.query[name] ?? '')}`)
    .join('&');
  const canonicalRequest = [
    input.method,
    input.path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const base = `${endpoint.protocol}//${host}${input.path}`;
  const url = canonicalQuery ? `${base}?${canonicalQuery}` : base;
  const outboundHeaders = Object.fromEntries(
    Object.entries(headers).filter(([name]) => name !== 'host'),
  );
  return { url, headers: outboundHeaders };
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Tiny ListObjectsV2 parser; enough for our own well-formed keys. */
export function parseListObjectsXml(xml: string): {
  readonly objects: readonly S3ObjectSummary[];
  readonly nextToken: string | null;
} {
  const objects: S3ObjectSummary[] = [];
  const contentsPattern = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match: RegExpExecArray | null;
  while ((match = contentsPattern.exec(xml)) !== null) {
    const block = match[1] ?? '';
    const key = block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
    const size = block.match(/<Size>(\d+)<\/Size>/)?.[1];
    const lastModified = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1];
    const etag = block.match(/<ETag>([\s\S]*?)<\/ETag>/)?.[1];
    if (!key || size === undefined) continue;
    objects.push({
      key: decodeXmlEntities(key),
      size: Number.parseInt(size, 10),
      lastModified: lastModified ?? '',
      etag: decodeXmlEntities(etag ?? '').replace(/"/g, ''),
    });
  }
  const nextToken = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
  return { objects, nextToken: nextToken ? decodeXmlEntities(nextToken) : null };
}

export function createS3Client(config: S3Config, deps: S3ClientDeps): S3Client {
  const now = deps.now ?? (() => new Date());
  const bucketPath = `/${encodeRfc3986(config.bucket)}`;

  async function send(
    method: SignInput['method'],
    key: string | null,
    query: Readonly<Record<string, string>>,
    body: Buffer | null,
    headers: Readonly<Record<string, string>> = {},
  ): Promise<Response> {
    const path = key === null ? `${bucketPath}/` : `${bucketPath}/${encodeS3Key(key)}`;
    const payloadHash = sha256Hex(body ?? Buffer.alloc(0));
    const signed = signS3Request(config, {
      method,
      path,
      query,
      headers: body ? { ...headers, 'content-length': String(body.length) } : headers,
      payloadHash,
      now: now(),
    });
    const init: RequestInit = { method, headers: signed.headers };
    if (body) init.body = new Uint8Array(body);
    return deps.fetch(signed.url, init);
  }

  return {
    async putObject(key, body, options) {
      const response = await send('PUT', key, {}, body, {
        'content-type': options?.contentType ?? 'application/octet-stream',
      });
      if (!response.ok) {
        throw new S3Error(`PUT ${key} failed with status ${response.status}.`, response.status);
      }
      return { etag: (response.headers.get('etag') ?? '').replace(/"/g, '') };
    },
    async getObject(key) {
      const response = await send('GET', key, {}, null);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new S3Error(`GET ${key} failed with status ${response.status}.`, response.status);
      }
      return Buffer.from(await response.arrayBuffer());
    },
    async headObject(key) {
      const response = await send('HEAD', key, {}, null);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new S3Error(`HEAD ${key} failed with status ${response.status}.`, response.status);
      }
      return {
        size: Number.parseInt(response.headers.get('content-length') ?? '0', 10),
        etag: (response.headers.get('etag') ?? '').replace(/"/g, ''),
        lastModified: response.headers.get('last-modified'),
      };
    },
    async listObjects(prefix) {
      const all: S3ObjectSummary[] = [];
      let token: string | null = null;
      do {
        const query: Record<string, string> = { 'list-type': '2', prefix };
        if (token) query['continuation-token'] = token;
        const response: Response = await send('GET', null, query, null);
        if (!response.ok) {
          throw new S3Error(
            `LIST ${prefix} failed with status ${response.status}.`,
            response.status,
          );
        }
        const page = parseListObjectsXml(await response.text());
        all.push(...page.objects);
        token = page.nextToken;
      } while (token);
      return all;
    },
    async deleteObject(key) {
      const response = await send('DELETE', key, {}, null);
      if (!response.ok && response.status !== 404) {
        throw new S3Error(`DELETE ${key} failed with status ${response.status}.`, response.status);
      }
    },
  };
}

export type S3ConfigResolution =
  | { readonly kind: 'configured'; readonly config: S3Config }
  | { readonly kind: 'unconfigured'; readonly missing: readonly string[] };

/** Resolve backup bucket credentials from env. Reports missing keys rather than guessing. */
export function resolveS3ConfigFromEnv(env: NodeJS.ProcessEnv, bucket: string): S3ConfigResolution {
  const endpoint = env[BACKUP_S3_ENV.endpoint]?.trim() ?? '';
  const region = env[BACKUP_S3_ENV.region]?.trim() ?? '';
  const accessKeyId = env[BACKUP_S3_ENV.accessKeyId]?.trim() ?? '';
  const secretAccessKey = env[BACKUP_S3_ENV.secretAccessKey]?.trim() ?? '';
  const sessionToken = env[BACKUP_S3_ENV.sessionToken]?.trim() || undefined;
  const missing: string[] = [];
  if (!/^https:\/\//.test(endpoint)) missing.push(BACKUP_S3_ENV.endpoint);
  if (!region) missing.push(BACKUP_S3_ENV.region);
  if (!accessKeyId) missing.push(BACKUP_S3_ENV.accessKeyId);
  if (!secretAccessKey) missing.push(BACKUP_S3_ENV.secretAccessKey);
  if (missing.length > 0) return { kind: 'unconfigured', missing };
  const config: S3Config = { endpoint, region, bucket, accessKeyId, secretAccessKey };
  return { kind: 'configured', config: sessionToken ? { ...config, sessionToken } : config };
}
