/**
 * Controller-local types. Contract shapes (request, result, heartbeat, trust,
 * operating config) are imported from `scripts/ci/contracts`; this file only
 * adds the runner/admission shapes the controller needs and the runtime
 * qualification record.
 */
import {
  CiRequestSchema,
  CiResultSchema,
  GITHUB_APPS,
  GitShaSchema,
  localCheckName as contractCheckName,
  MAX_ATTEMPTS,
  PROFILE_NAMES,
  Sha256DigestSchema,
  type CiRequest as ContractCiRequest,
  type CiResult as ContractCiResult,
  type ProfileName,
  type RuntimeId,
} from '../contracts';

export type CiProfile = ProfileName;
export const CI_PROFILES = PROFILE_NAMES;

/** The CI request tuple shared by the controller, executor, and release gate. */
export type CiRequest = ContractCiRequest;

/** The executor's result document (contracts `CiResultSchema`). */
export type CiResult = ContractCiResult;

export const MAX_CONTROLLER_ATTEMPTS = MAX_ATTEMPTS;

export function isCiProfile(value: unknown): value is CiProfile {
  return typeof value === 'string' && (PROFILE_NAMES as readonly string[]).includes(value);
}

export function isCiRequest(value: unknown): value is CiRequest {
  return CiRequestSchema.safeParse(value).success;
}

/** Full lowercase 40-hex git object id. */
export function isGitSha(value: unknown): value is string {
  return GitShaSchema.safeParse(value).success;
}

/** `sha256:<64 hex>` content digest. */
export function isSha256Digest(value: unknown): value is string {
  return Sha256DigestSchema.safeParse(value).success;
}

/**
 * Structural completeness check for an executor result. The queue refuses to
 * move an attempt to `collected`/`published` unless the value passes this, so
 * a crash, an interrupted executor, or a partially written result file can
 * never turn into a success check on GitHub.
 */
export function isCompleteCiResult(value: unknown): value is CiResult {
  return CiResultSchema.safeParse(value).success;
}

export type AdmissionMode = 'normal' | 'dedicated';

export interface Allocation {
  readonly cpus: number;
  readonly memoryGiB: number;
}

export type StopSignal = 'continue' | 'preempt' | 'cancel';

/** What the controller hands to the injected runner for one attempt. */
export interface RunnerJob {
  readonly attemptId: string;
  readonly request: CiRequest;
  readonly mode: AdmissionMode;
  readonly allocation: Allocation;
  /**
   * Polled by the executor at safe boundaries (between suites). `preempt`
   * means "yield after the current suite; you will be re-queued"; `cancel`
   * means the request was superseded and its result will never be published
   * as success.
   */
  readonly stopSignal: () => StopSignal;
  /** Executors call this on progress so the controller can extend the lease. */
  readonly touch: () => void;
}

/**
 * Runs one attempt and resolves with whatever the executor produced. The
 * controller validates the value with `isCompleteCiResult`; the runner is not
 * trusted to do so.
 */
export type Runner = (job: RunnerJob) => Promise<unknown>;

export const LOCAL_CI_APP_SLUG = GITHUB_APPS.localCi.slug;
export const localCheckName = contractCheckName;

export const ACTIVE_RUNTIME: RuntimeId = 'node22';
export const CANDIDATE_RUNTIME: RuntimeId = 'node24';
export const RUNTIME_QUALIFICATION_NOTE =
  'Hosted workflows run Node 22 today; Node 24 (production Vercel) is a candidate runtime pending a controlled qualification run of the local profiles.';

export type ControllerHealth = 'idle' | 'busy' | 'draining';

/**
 * Flat heartbeat body accepted by the operational Worker (`POST /heartbeat`).
 * The Worker rejects unknown keys, nested values and anything credential
 * shaped, so this type is deliberately closed.
 */
export interface ControllerHeartbeatPayload {
  readonly controllerId: string;
  readonly controllerVersion: string;
  readonly imageDigest: string;
  readonly activeRuntime: RuntimeId;
  readonly candidateRuntime: RuntimeId;
  readonly status: ControllerHealth;
  readonly sentAt: string;
  readonly queueDepth: number;
  readonly running: number;
  readonly maxConcurrent: number;
  readonly lastCompletedAt?: string;
}
