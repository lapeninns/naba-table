import { isRecord } from './http';

import type {
  ControllerHeartbeat,
  CoordinatorStatus,
  CoordinatorStubLike,
  HealthObservation,
  WebhookDelivery,
} from './contracts';

export const COORDINATOR_INTERNAL_ORIGIN = 'https://coordinator.internal';

export type DeliveryRecordResult = {
  readonly duplicate: boolean;
  readonly candidateKey: string | null;
  readonly candidateState: string | null;
};

export type ObservationRecordResult = {
  readonly transitions: readonly {
    readonly key: string;
    readonly transition: string;
    readonly incidentId: string | null;
  }[];
};

export type TickReport = {
  readonly processedJobs: number;
  readonly dispatched: number;
  readonly rejected: number;
  readonly retried: number;
  readonly failed: number;
  readonly escalated: number;
  readonly nextAlarmAt: string | null;
};

export type CoordinatorClient = {
  recordDelivery(input: {
    delivery: WebhookDelivery;
    receivedAt: string;
  }): Promise<DeliveryRecordResult>;
  recordHeartbeat(input: { heartbeat: ControllerHeartbeat; receivedAt: string }): Promise<void>;
  recordObservations(input: {
    observations: readonly HealthObservation[];
    now: string;
  }): Promise<ObservationRecordResult>;
  status(): Promise<CoordinatorStatus>;
  tick(now: string): Promise<TickReport>;
  acknowledgeIncident(id: string, now: string): Promise<boolean>;
};

export class CoordinatorError extends Error {
  override readonly name = 'CoordinatorError';
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(
  stub: CoordinatorStubLike,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  guard?: (value: unknown) => value is T,
): Promise<T> {
  const response = await stub.fetch(
    new Request(`${COORDINATOR_INTERNAL_ORIGIN}${path}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
  if (!response.ok) {
    throw new CoordinatorError(
      `Coordinator ${method} ${path} responded ${response.status}.`,
      response.status,
    );
  }
  const json: unknown = await response.json();
  if (guard && !guard(json)) {
    throw new CoordinatorError(`Coordinator ${method} ${path} returned an unexpected shape.`, 502);
  }
  return json as T;
}

const isStatusShape = (value: unknown): value is CoordinatorStatus =>
  isRecord(value) &&
  isRecord(value.heartbeat) &&
  isRecord(value.candidates) &&
  isRecord(value.incidents);

export function createCoordinatorClient(stub: CoordinatorStubLike): CoordinatorClient {
  return {
    recordDelivery: (input) => call<DeliveryRecordResult>(stub, '/deliveries', 'POST', input),
    async recordHeartbeat(input) {
      await call<unknown>(stub, '/heartbeat', 'POST', input);
    },
    recordObservations: (input) =>
      call<ObservationRecordResult>(stub, '/observations', 'POST', input),
    status: () => call<CoordinatorStatus>(stub, '/status', 'GET', undefined, isStatusShape),
    tick: (now) => call<TickReport>(stub, '/tick', 'POST', { now }),
    async acknowledgeIncident(id, now) {
      const result = await call<{ acknowledged: boolean }>(
        stub,
        `/incidents/${encodeURIComponent(id)}/acknowledge`,
        'POST',
        { now },
      );
      return result.acknowledged === true;
    },
  };
}
