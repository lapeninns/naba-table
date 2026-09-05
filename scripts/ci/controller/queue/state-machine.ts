/**
 * Attempt state machine.
 *
 *   queued -> leased -> running -> collected -> published
 *
 * Every non-terminal state may move to `failed`, `cancelled`, or `superseded`.
 * `published` is reachable only from `collected`, and `collected` is only
 * entered by the store when a complete `CiResult` is attached, so an attempt
 * that was interrupted (lease lost, process restart, executor crash) can never
 * become `published`.
 */
export const ATTEMPT_STATES = [
  'queued',
  'leased',
  'running',
  'collected',
  'published',
  'failed',
  'cancelled',
  'superseded',
] as const;

export type AttemptState = (typeof ATTEMPT_STATES)[number];

export const TERMINAL_ATTEMPT_STATES: readonly AttemptState[] = [
  'published',
  'failed',
  'cancelled',
  'superseded',
];

const ABORT_TARGETS: readonly AttemptState[] = ['failed', 'cancelled', 'superseded'];

const TRANSITIONS: Readonly<Record<AttemptState, readonly AttemptState[]>> = {
  queued: ['leased', ...ABORT_TARGETS],
  leased: ['running', ...ABORT_TARGETS],
  running: ['collected', ...ABORT_TARGETS],
  collected: ['published', ...ABORT_TARGETS],
  published: [],
  failed: [],
  cancelled: [],
  superseded: [],
};

export class InvalidAttemptTransitionError extends Error {
  constructor(
    readonly attemptId: string,
    readonly from: AttemptState,
    readonly to: AttemptState,
  ) {
    super(`Attempt ${attemptId}: illegal transition ${from} -> ${to}`);
    this.name = 'InvalidAttemptTransitionError';
  }
}

export function isTerminalAttemptState(state: AttemptState): boolean {
  return TERMINAL_ATTEMPT_STATES.includes(state);
}

export function canTransition(from: AttemptState, to: AttemptState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(attemptId: string, from: AttemptState, to: AttemptState): void {
  if (!canTransition(from, to)) {
    throw new InvalidAttemptTransitionError(attemptId, from, to);
  }
}
