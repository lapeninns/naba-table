import { z } from 'zod';

import {
  IsoTimestampSchema,
  NonNegativeIntSchema,
  RuntimeIdSchema,
  SemverSchema,
  Sha256DigestSchema,
} from './primitives';
import { rejectCredentialLikeKeys } from './validation';

/**
 * Controller status as the operational-control Worker understands it
 * (`cloudflare/operational-control/src/heartbeat.ts` `validateHeartbeat`).
 */
export const CONTROLLER_STATUSES = ['idle', 'busy', 'draining'] as const;
export type ControllerStatus = (typeof CONTROLLER_STATUSES)[number];

/** Upper bounds mirrored from the Worker's heartbeat validator. */
export const HEARTBEAT_MAX_QUEUE_DEPTH = 10_000;
export const HEARTBEAT_MAX_CONCURRENT = 64;
export const HEARTBEAT_MAX_SKEW_MS = 5 * 60 * 1000;

/** Safe, single-line identifier for the controller id (hostname-like, no secrets). */
export const ControllerIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9._+-]{1,64}$/u, 'expected a short machine identifier');

/**
 * Published by the Mac controller (`scripts/ci/controller/heartbeat.ts`) to the
 * operational-control Worker's `POST /heartbeat`. Deliberately flat and strict:
 * the Worker rejects unknown keys, nested values and anything secret-shaped, so
 * this contract does the same. One shape, three consumers (controller, Worker,
 * monitoring).
 */
export const ControllerHeartbeatSchema = z
  .strictObject({
    controllerId: ControllerIdSchema,
    controllerVersion: SemverSchema,
    imageDigest: Sha256DigestSchema,
    activeRuntime: RuntimeIdSchema,
    candidateRuntime: RuntimeIdSchema,
    status: z.enum(CONTROLLER_STATUSES),
    sentAt: IsoTimestampSchema,
    queueDepth: NonNegativeIntSchema.max(HEARTBEAT_MAX_QUEUE_DEPTH),
    running: NonNegativeIntSchema.max(HEARTBEAT_MAX_CONCURRENT),
    maxConcurrent: z.number().int().min(1).max(HEARTBEAT_MAX_CONCURRENT),
    lastCompletedAt: IsoTimestampSchema.optional(),
  })
  .refine((heartbeat) => heartbeat.running <= heartbeat.maxConcurrent, {
    message: 'running must not exceed maxConcurrent',
    path: ['running'],
  })
  .superRefine(rejectCredentialLikeKeys);
export type ControllerHeartbeat = z.infer<typeof ControllerHeartbeatSchema>;

export function isHeartbeatStale(
  heartbeat: Pick<ControllerHeartbeat, 'sentAt'>,
  now: Date,
  alertAfterMinutes: number,
): boolean {
  const ageMs = now.getTime() - Date.parse(heartbeat.sentAt);
  return !Number.isFinite(ageMs) || ageMs > alertAfterMinutes * 60_000;
}

/** True when `sentAt` is within the Worker's accepted clock-skew window around `now`. */
export function isHeartbeatWithinSkew(
  heartbeat: Pick<ControllerHeartbeat, 'sentAt'>,
  now: Date,
): boolean {
  const skewMs = Math.abs(now.getTime() - Date.parse(heartbeat.sentAt));
  return Number.isFinite(skewMs) && skewMs <= HEARTBEAT_MAX_SKEW_MS;
}
