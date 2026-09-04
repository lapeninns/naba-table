import { createHash } from 'node:crypto';
import { z } from 'zod';

import type { ParsedGoogleBusinessProfilePush } from './types';

export const GOOGLE_PUBSUB_MAX_BODY_BYTES = 64 * 1024;

const pushEnvelopeSchema = z
  .object({
    message: z
      .object({
        data: z.string().min(1),
        messageId: z.string().min(1).max(512),
        publishTime: z.iso.datetime({ offset: true }).optional(),
      })
      .passthrough(),
    subscription: z.string().min(1),
  })
  .passthrough();

const notificationMetadataSchema = z
  .object({
    type: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{0,99}$/)
      .optional(),
    accountName: z.string().max(500).optional(),
    locationName: z.string().max(500).optional(),
    reviewName: z.string().max(1000).optional(),
  })
  .passthrough();

export class GooglePubsubPushParseError extends Error {
  constructor(readonly code: 'body_too_large' | 'invalid_envelope' | 'wrong_subscription') {
    super(code);
    this.name = 'GooglePubsubPushParseError';
  }
}

function reviewId(value: string | undefined): string | null {
  if (!value) return null;
  const match = /(?:^|\/)reviews\/([^/]+)$/.exec(value);
  const id = match?.[1];
  return id && /^[A-Za-z0-9._~-]+$/.test(id) ? id : null;
}

function resourceId(value: string | undefined, resource: 'accounts' | 'locations'): string | null {
  if (!value) return null;
  const pattern =
    resource === 'accounts' ? /^accounts\/([^/]+)$/ : /^(?:accounts\/[^/]+\/)?locations\/([^/]+)$/;
  const match = pattern.exec(value);
  const id = match?.[1];
  return id && /^[A-Za-z0-9._~-]+$/.test(id) ? id : null;
}

function hash(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function decodeBase64(value: string): Uint8Array | null {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return null;
  }
  return Buffer.from(value, 'base64');
}

export async function parseGoogleBusinessProfilePush(
  request: Request,
  expectedSubscription: string,
): Promise<ParsedGoogleBusinessProfilePush> {
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > GOOGLE_PUBSUB_MAX_BODY_BYTES) {
    throw new GooglePubsubPushParseError('body_too_large');
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new GooglePubsubPushParseError('invalid_envelope');
  }
  const envelope = pushEnvelopeSchema.safeParse(json);
  if (!envelope.success) throw new GooglePubsubPushParseError('invalid_envelope');
  if (envelope.data.subscription !== expectedSubscription) {
    throw new GooglePubsubPushParseError('wrong_subscription');
  }

  const decoded = decodeBase64(envelope.data.message.data);
  if (!decoded) {
    return {
      kind: 'ignored',
      messageId: envelope.data.message.messageId,
      eventHash: hash(new TextEncoder().encode(envelope.data.message.data)),
      eventType: null,
      reason: 'malformed_notification',
      publishedAt: envelope.data.message.publishTime ?? null,
    };
  }
  const eventHash = hash(decoded);
  let notification: unknown;
  try {
    notification = JSON.parse(new TextDecoder().decode(decoded));
  } catch {
    notification = null;
  }
  const metadata = notificationMetadataSchema.safeParse(notification);
  if (!metadata.success || !metadata.data.type) {
    return {
      kind: 'ignored',
      messageId: envelope.data.message.messageId,
      eventHash,
      eventType: null,
      reason: 'malformed_notification',
      publishedAt: envelope.data.message.publishTime ?? null,
    };
  }
  const locationId = resourceId(metadata.data.locationName, 'locations');
  const accountId = resourceId(metadata.data.accountName, 'accounts');
  const isSupportedType = ['GOOGLE_UPDATE', 'NEW_REVIEW', 'UPDATED_REVIEW'].includes(
    metadata.data.type,
  );
  const externalReviewId = reviewId(metadata.data.reviewName);
  const reviewEventHasId = metadata.data.type === 'GOOGLE_UPDATE' || externalReviewId !== null;
  if (!isSupportedType || !locationId || !accountId || !reviewEventHasId) {
    return {
      kind: 'ignored',
      messageId: envelope.data.message.messageId,
      eventHash,
      eventType: metadata.data.type,
      reason: 'unsupported_event',
      publishedAt: envelope.data.message.publishTime ?? null,
    };
  }
  return {
    kind: 'supported',
    messageId: envelope.data.message.messageId,
    eventHash,
    eventType: metadata.data.type as 'GOOGLE_UPDATE' | 'NEW_REVIEW' | 'UPDATED_REVIEW',
    externalAccountId: accountId,
    externalLocationId: locationId,
    externalReviewId,
    publishedAt: envelope.data.message.publishTime ?? null,
  };
}
