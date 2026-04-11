import {
  DEFAULT_ALLOWED_DESTINATION_HOSTS,
  SHORT_LINK_PURPOSES,
  type CreateShortLinkRequest,
  type CreateShortLinkResponse,
  type ShortLinkRecord,
} from './contracts';

type RandomBytesFn = (length: number) => Uint8Array;

export type ShortLinkRepository = {
  findReusableLink(params: {
    bookingId: string;
    purpose: CreateShortLinkRequest['purpose'];
    createdBy: CreateShortLinkRequest['createdBy'];
    destinationUrl: string;
    nowIso: string;
  }): Promise<ShortLinkRecord | null>;
  insertLink(record: ShortLinkRecord): Promise<void>;
  getLinkByToken(token: string): Promise<ShortLinkRecord | null>;
  touchLink(token: string, accessedAt: string): Promise<void>;
};

function defaultRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toBase62(bytes: Uint8Array): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let value = BigInt(0);
  for (const byte of bytes) {
    value = (value << BigInt(8)) + BigInt(byte);
  }
  if (value === BigInt(0)) {
    return '0';
  }
  let output = '';
  while (value > BigInt(0)) {
    const index = Number(value % BigInt(alphabet.length));
    output = alphabet[index] + output;
    value /= BigInt(alphabet.length);
  }
  return output;
}

export function generateOpaqueToken(
  options?: {
    length?: number;
    randomBytes?: RandomBytesFn;
  },
): string {
  const targetLength = Math.max(8, Math.min(options?.length ?? 12, 24));
  const randomBytes = options?.randomBytes ?? defaultRandomBytes;
  let token = '';

  while (token.length < targetLength) {
    token += toBase62(randomBytes(8));
  }

  return token.slice(0, targetLength);
}

export function parseAllowedHosts(raw: string | null | undefined): string[] {
  const values = (raw ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return values.length > 0 ? values : [...DEFAULT_ALLOWED_DESTINATION_HOSTS];
}

export function validateShortLinkRequest(
  request: CreateShortLinkRequest,
  allowedHosts: string[],
): { ok: true; destinationUrl: URL } | { ok: false; error: string } {
  if (!SHORT_LINK_PURPOSES.includes(request.purpose)) {
    return { ok: false, error: 'Invalid purpose.' };
  }

  let destinationUrl: URL;
  try {
    destinationUrl = new URL(request.destinationUrl);
  } catch {
    return { ok: false, error: 'Destination URL is invalid.' };
  }

  if (!['https:', 'http:'].includes(destinationUrl.protocol)) {
    return { ok: false, error: 'Destination URL protocol is not allowed.' };
  }

  if (!allowedHosts.includes(destinationUrl.hostname.toLowerCase())) {
    return { ok: false, error: 'Destination host is not allowlisted.' };
  }

  const expiresAtMs = Date.parse(request.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return { ok: false, error: 'Expiry timestamp is invalid.' };
  }

  if (expiresAtMs <= Date.now()) {
    return { ok: false, error: 'Expiry timestamp must be in the future.' };
  }

  return { ok: true, destinationUrl };
}

export function buildShortUrl(baseUrl: string, token: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return `${normalized}/m/${token}`;
}

export function isLinkActive(record: ShortLinkRecord, now: Date): boolean {
  if (record.revokedAt) {
    return false;
  }

  const expiryMs = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return false;
  }

  return expiryMs > now.getTime();
}

export async function createBookingShortLink(params: {
  repository: ShortLinkRepository;
  request: CreateShortLinkRequest;
  shortBaseUrl: string;
  now?: Date;
  randomBytes?: RandomBytesFn;
}): Promise<CreateShortLinkResponse> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();

  const reusable = await params.repository.findReusableLink({
    bookingId: params.request.bookingId,
    purpose: params.request.purpose,
    createdBy: params.request.createdBy,
    destinationUrl: params.request.destinationUrl,
    nowIso,
  });

  if (reusable) {
    return {
      token: reusable.token,
      shortUrl: buildShortUrl(params.shortBaseUrl, reusable.token),
      expiresAt: reusable.expiresAt,
    };
  }

  const destination = new URL(params.request.destinationUrl);
  const randomBytes = params.randomBytes ?? defaultRandomBytes;

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateOpaqueToken({ randomBytes });
    const record: ShortLinkRecord = {
      token,
      destinationUrl: params.request.destinationUrl,
      destinationHost: destination.hostname.toLowerCase(),
      purpose: params.request.purpose,
      bookingId: params.request.bookingId,
      restaurantId: params.request.restaurantId,
      createdAt: nowIso,
      expiresAt: params.request.expiresAt,
      revokedAt: null,
      lastAccessedAt: null,
      createdBy: params.request.createdBy,
    };

    try {
      await params.repository.insertLink(record);
      return {
        token,
        shortUrl: buildShortUrl(params.shortBaseUrl, token),
        expiresAt: params.request.expiresAt,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to create short link.');
}

export async function resolveBookingShortLink(params: {
  repository: ShortLinkRepository;
  token: string;
  now?: Date;
}): Promise<
  | { status: 'redirect'; record: ShortLinkRecord }
  | { status: 'missing' }
  | { status: 'expired'; record: ShortLinkRecord }
> {
  const record = await params.repository.getLinkByToken(params.token);
  if (!record) {
    return { status: 'missing' };
  }

  const now = params.now ?? new Date();
  if (!isLinkActive(record, now)) {
    return { status: 'expired', record };
  }

  await params.repository.touchLink(record.token, now.toISOString());
  return { status: 'redirect', record };
}
