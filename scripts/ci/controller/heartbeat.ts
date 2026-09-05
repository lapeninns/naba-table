import type { SecretProvider } from './keychain';
import { createSilentLogger, type ControllerLogger } from './log';
import type { ControllerHeartbeatPayload } from './types';

export type HeartbeatFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface HeartbeatEmitterOptions {
  readonly url: string;
  readonly token: SecretProvider;
  readonly fetch?: HeartbeatFetch;
  readonly timeoutMs?: number;
  readonly logger?: ControllerLogger;
}

export interface HeartbeatOutcome {
  readonly ok: boolean;
  readonly status: number | null;
  readonly error?: string;
}

export interface HeartbeatEmitter {
  emit(payload: ControllerHeartbeatPayload): Promise<HeartbeatOutcome>;
  describe(): { readonly url: string };
}

/**
 * Keys the operational Worker accepts. Anything else is rejected there, so
 * the emitter refuses to send it in the first place.
 */
export const HEARTBEAT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'controllerId',
  'controllerVersion',
  'imageDigest',
  'activeRuntime',
  'candidateRuntime',
  'status',
  'sentAt',
  'queueDepth',
  'running',
  'maxConcurrent',
  'lastCompletedAt',
]);

const FORBIDDEN_PAYLOAD_KEYS = /token|secret|authorization|private|key|password|bearer|jwt/iu;
const SECRET_SHAPED_VALUE = /-----BEGIN|\bgh[psou]_[A-Za-z0-9]{10,}|\beyJ[A-Za-z0-9_-]{10,}\./u;

/**
 * Refuses payloads that look like they carry credentials or that the Worker
 * would reject (unknown or nested keys). Defence in depth: the payload type is
 * already closed, but a runtime object could still be widened by a caller.
 */
export function assertHeartbeatPayloadSafe(payload: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.test(key)) {
      throw new Error(`Heartbeat payload must not contain credential-like field "${key}"`);
    }
    if (!HEARTBEAT_ALLOWED_KEYS.has(key)) {
      throw new Error(`Heartbeat payload field "${key}" is not accepted by the operational Worker`);
    }
    if (value !== null && typeof value === 'object') {
      throw new Error(`Heartbeat payload field "${key}" must be a primitive`);
    }
    if (typeof value === 'string' && SECRET_SHAPED_VALUE.test(value)) {
      throw new Error(`Heartbeat payload field "${key}" looks like a secret`);
    }
  }
}

export function createHeartbeatEmitter(options: HeartbeatEmitterOptions): HeartbeatEmitter {
  let url: URL;
  try {
    url = new URL(options.url);
  } catch {
    throw new Error('Heartbeat URL is not a valid URL');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('Heartbeat URL must use https (plain http is only allowed for localhost)');
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('Heartbeat URL must not embed credentials');
  }
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const logger = options.logger ?? createSilentLogger();
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    describe: () => ({ url: url.toString() }),
    emit: async (payload) => {
      try {
        assertHeartbeatPayloadSafe({ ...payload });
        const token = await options.token();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(url.toString(), {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          if (!response.ok) {
            logger.warn('heartbeat.rejected', { status: response.status });
            return { ok: false, status: response.status, error: `HTTP ${response.status}` };
          }
          return { ok: true, status: response.status };
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('heartbeat.failed', { error: message });
        return { ok: false, status: null, error: message };
      }
    },
  };
}
