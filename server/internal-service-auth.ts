import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from 'node:crypto';

type InternalServiceClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  method: string;
  path: string;
  bodySha256: string;
};

export type VerifiedInternalServiceRequest = {
  issuer: string;
  subject: string;
  jwtId: string;
};

export type InternalServiceAuthConfig = {
  publicKeyPem: string;
  keyId: string;
  issuer: string;
  audience: string;
  now?: () => Date;
};

export class InternalServiceAuthError extends Error {
  readonly status = 401;

  constructor(message = 'Internal service authentication failed.') {
    super(message);
    this.name = 'InternalServiceAuthError';
  }
}

function decodeJsonSegment(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JWT segment is not an object.');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new InternalServiceAuthError();
  }
}

function readClaims(value: Record<string, unknown>): InternalServiceClaims {
  const audience = value.aud;
  const validAudience =
    typeof audience === 'string' ||
    (Array.isArray(audience) &&
      audience.every((entry) => typeof entry === 'string'));
  if (
    typeof value.iss !== 'string' ||
    !validAudience ||
    typeof value.sub !== 'string' ||
    typeof value.jti !== 'string' ||
    typeof value.iat !== 'number' ||
    typeof value.exp !== 'number' ||
    typeof value.method !== 'string' ||
    typeof value.path !== 'string' ||
    typeof value.bodySha256 !== 'string'
  ) {
    throw new InternalServiceAuthError();
  }
  return value as InternalServiceClaims;
}

function configuredAuth(): InternalServiceAuthConfig {
  const publicKeyPem = process.env.NABAPRESENCE_SERVICE_JWT_PUBLIC_KEY?.replaceAll(
    '\\n',
    '\n',
  );
  const keyId = process.env.NABAPRESENCE_SERVICE_JWT_KEY_ID;
  if (!publicKeyPem || !keyId) {
    throw new InternalServiceAuthError(
      'Internal service authentication is not configured.',
    );
  }
  return {
    publicKeyPem,
    keyId,
    issuer:
      process.env.NABAPRESENCE_SERVICE_JWT_ISSUER ?? 'nabapresence',
    audience: 'nabatable-internal',
  };
}

export async function verifyInternalServiceRequest(
  request: Request,
  config: InternalServiceAuthConfig = configuredAuth(),
): Promise<VerifiedInternalServiceRequest> {
  const authorization = request.headers.get('authorization');
  const token =
    authorization?.startsWith('Bearer ') === true
      ? authorization.slice('Bearer '.length)
      : null;
  if (!token) {
    throw new InternalServiceAuthError();
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new InternalServiceAuthError();
  }
  const [headerSegment, claimsSegment, signatureSegment] = segments;
  const header = decodeJsonSegment(headerSegment);
  const claims = readClaims(decodeJsonSegment(claimsSegment));
  if (
    header.alg !== 'EdDSA' ||
    header.typ !== 'JWT' ||
    header.kid !== config.keyId
  ) {
    throw new InternalServiceAuthError();
  }

  let signatureValid = false;
  try {
    signatureValid = verifySignature(
      null,
      Buffer.from(`${headerSegment}.${claimsSegment}`),
      createPublicKey(config.publicKeyPem),
      Buffer.from(signatureSegment, 'base64url'),
    );
  } catch {
    throw new InternalServiceAuthError();
  }
  if (!signatureValid) {
    throw new InternalServiceAuthError();
  }

  const nowSeconds = Math.floor((config.now?.() ?? new Date()).getTime() / 1000);
  const audienceMatches = Array.isArray(claims.aud)
    ? claims.aud.includes(config.audience)
    : claims.aud === config.audience;
  if (
    claims.iss !== config.issuer ||
    claims.sub !== 'nabapresence' ||
    !audienceMatches ||
    claims.iat > nowSeconds + 5 ||
    claims.exp <= nowSeconds - 5 ||
    claims.exp - claims.iat > 120
  ) {
    throw new InternalServiceAuthError();
  }

  const body = Buffer.from(await request.clone().arrayBuffer());
  const bodySha256 = createHash('sha256').update(body).digest('hex');
  const url = new URL(request.url);
  if (
    claims.method !== request.method.toUpperCase() ||
    claims.path !== url.pathname ||
    claims.bodySha256 !== bodySha256
  ) {
    throw new InternalServiceAuthError();
  }

  return {
    issuer: claims.iss,
    subject: claims.sub,
    jwtId: claims.jti,
  };
}
