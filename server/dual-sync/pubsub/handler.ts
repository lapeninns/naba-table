import { verifyGooglePubsubBearer } from './auth';
import {
  GOOGLE_PUBSUB_MAX_BODY_BYTES,
  GooglePubsubPushParseError,
  parseGoogleBusinessProfilePush,
} from './parser';

import type {
  GooglePubsubAuthenticationResult,
  GooglePubsubIngressConfig,
  GooglePubsubPersistencePort,
} from './types';

type HandlerDependencies = GooglePubsubPersistencePort & {
  readonly authenticate?: (
    authorization: string | null,
    config: GooglePubsubIngressConfig,
  ) => Promise<GooglePubsubAuthenticationResult>;
};

function response(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      Vary: 'Authorization',
    },
  });
}

export async function handleGoogleBusinessProfilePush(
  request: Request,
  config: GooglePubsubIngressConfig,
  dependencies: HandlerDependencies,
): Promise<Response> {
  if (!config.enabled) return response(404);

  const authentication = await (dependencies.authenticate ?? verifyGooglePubsubBearer)(
    request.headers.get('authorization'),
    config,
  );
  if (!authentication.ok) {
    const mismatch =
      authentication.reason === 'identity_mismatch' || authentication.reason === 'claim_mismatch';
    return response(mismatch ? 403 : 401);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > GOOGLE_PUBSUB_MAX_BODY_BYTES) {
    return response(413);
  }

  try {
    const parsed = await parseGoogleBusinessProfilePush(request, config.subscription);
    await dependencies.persist({ subscription: config.subscription, delivery: parsed });
    return response(204);
  } catch (error) {
    if (error instanceof GooglePubsubPushParseError) {
      if (error.code === 'body_too_large') return response(413);
      if (error.code === 'wrong_subscription') return response(403);
      return response(204);
    }
    return response(500);
  }
}
