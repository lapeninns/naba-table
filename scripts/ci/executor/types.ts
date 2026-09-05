import type { ProfileName, RuntimeId } from '../contracts/primitives';
import type { CiRequest as ContractCiRequest } from '../contracts/request';
import type {
  CiResult as ContractCiResult,
  SupervisorOutcome as ContractSupervisorOutcome,
} from '../contracts/result';

/**
 * Executor-local types. The request tuple and the result document are the
 * shared contracts from `scripts/ci/contracts`; everything else here is the
 * richer, executor-private shape that is written next to the contract result as
 * `executor-report.json`.
 */

export type CiProfileName = ProfileName;
export type CiRequest = ContractCiRequest;
export type CiResult = ContractCiResult;
export type ContractOutcome = ContractSupervisorOutcome;

export type StopSignal = 'continue' | 'preempt' | 'cancel';

/**
 * Controller envelope: passed via `--request-file`, or assembled from a bare
 * `--request @tuple.json` plus `$NABATABLE_CI_ALLOCATION_FILE` (the side-channel
 * scripts/ci/controller/runner.ts writes).
 */
export interface RequestEnvelope {
  readonly request: CiRequest;
  readonly mode: 'normal' | 'dedicated' | null;
  readonly allocation: { readonly cpus: number; readonly memoryGiB: number } | null;
}

export type StepPhase = 'prepare' | 'test';

export interface ExecutorStep {
  /** Stable identifier, also used as the log file stem. */
  readonly id: string;
  /** Suite the step belongs to (profile suite id, or `prepare`). */
  readonly suiteId: string;
  /** argv executed inside the job container (never shell-interpreted). */
  readonly command: readonly string[];
  readonly timeoutMs: number;
  /**
   * `prepare` steps run while the guest egress policy is in phase `prep` (proxy
   * reachable) and receive the proxy env. `test` steps run in phase `test`.
   */
  readonly phase: StepPhase;
  /** Sanitized environment for this step (profile env plus the command overlay). */
  readonly env: Readonly<Record<string, string>>;
}

export interface ExecutorSuite {
  readonly id: string;
  readonly displayName: string;
  readonly kind: 'prepare' | 'static' | 'db' | 'vitest' | 'browser' | 'stability';
  readonly stepIds: readonly string[];
  readonly hardLimitMs: number;
  readonly p95BudgetMs: number;
}

export interface SkippedSuite {
  readonly suiteId: string;
  readonly displayName: string;
  readonly reason: string;
}

export interface ExecutorResources {
  readonly cpus: number;
  /** Docker memory string, e.g. `8g`. */
  readonly memory: string;
  readonly pidsLimit: number;
  /** tmpfs size string for /tmp, e.g. `2g`. */
  readonly tmpfsSize: string;
  /** /dev/shm size for Chromium, e.g. `1g`. */
  readonly shmSize: string;
}

export interface ExecutorRuntime {
  readonly activeRuntime: RuntimeId;
  readonly candidateRuntime: RuntimeId;
  readonly pnpm: string;
  readonly qualificationNote: string;
}

export interface ExecutorProfile {
  readonly name: CiProfileName;
  readonly policyVersion: string;
  /** Digest the profile pins for the job image, or null while it is a placeholder. */
  readonly jobImageDigest: string | null;
  readonly steps: readonly ExecutorStep[];
  readonly suites: readonly ExecutorSuite[];
  readonly skippedSuites: readonly SkippedSuite[];
  readonly profileTimeoutMs: number;
  /** Sanitized profile environment. Only these keys (plus overlays) ever reach the container. */
  readonly env: Readonly<Record<string, string>>;
  /** Workspace-relative paths that the evidence collector is allowed to copy out. */
  readonly artefactPaths: readonly string[];
  readonly resources: ExecutorResources;
  readonly runtime: ExecutorRuntime;
  readonly changedPathsProvided: boolean;
}

export type StepOutcome =
  | 'passed'
  | 'failed'
  | 'timeout'
  | 'oom'
  | 'crashed'
  | 'storage-exhausted'
  | 'infrastructure-error'
  | 'cancelled'
  | 'not-run';

export type SupervisorOutcome = Exclude<StepOutcome, 'not-run'>;

export interface StepResult {
  readonly id: string;
  readonly suiteId: string;
  readonly phase: StepPhase;
  readonly outcome: StepOutcome;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly stdoutLog: string;
  readonly stderrLog: string;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;
}

export interface SupervisorResult {
  /** Fixed before the first step starts; container output can never change it. */
  readonly profile: CiProfileName;
  readonly outcome: SupervisorOutcome;
  readonly steps: readonly StepResult[];
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly profileTimeoutMs: number;
  /** Last controller stop signal observed at a suite boundary. */
  readonly stopSignal: StopSignal;
  /** Human-readable reason when the outcome is not `passed`. */
  readonly reason: string | null;
}

export interface EvidenceFile {
  /** Path relative to the job evidence directory. */
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly kind: 'json' | 'xml' | 'txt' | 'log' | 'html-inert' | 'png';
  readonly redacted: boolean;
}

export interface EvidenceRejection {
  readonly path: string;
  readonly reason:
    | 'path-traversal'
    | 'symlink'
    | 'per-file-size'
    | 'total-size'
    | 'extension'
    | 'object-key'
    | 'not-allowed-root'
    | 'special-file';
}

export interface TestInventoryDetail {
  readonly discovered: number;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly skipped: number;
  /** Sorted, unique, capped list of discovered test ids. */
  readonly ids: readonly string[];
  readonly idsTruncated: boolean;
  readonly junitFiles: readonly string[];
}

export interface CoverageDetail {
  readonly lines: number;
  readonly statements: number;
  readonly functions: number;
  readonly branches: number;
  readonly source: string;
}

export interface ProbedRuntime {
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
}

export interface RuntimeRecord extends ExecutorRuntime {
  readonly probed: ProbedRuntime | null;
}

/** Executor-private companion to the contract result (`executor-report.json`). */
export interface ExecutorReport {
  readonly schemaVersion: 1;
  readonly jobId: string;
  readonly request: CiRequest;
  readonly profile: CiProfileName;
  readonly policyVersion: string;
  readonly outcome: SupervisorOutcome;
  readonly contractOutcome: ContractOutcome;
  readonly reason: string | null;
  readonly supervisor: SupervisorResult;
  readonly skippedSuites: readonly SkippedSuite[];
  readonly tests: TestInventoryDetail;
  readonly coverage: CoverageDetail | null;
  readonly evidence: {
    readonly files: readonly EvidenceFile[];
    readonly totalBytes: number;
    readonly rejected: readonly EvidenceRejection[];
  };
  readonly runtime: RuntimeRecord;
  /** sha256 hex over the canonical JSON of everything above. */
  readonly reportDigest: string;
}

export const EXECUTOR_RUNTIME_NOTE =
  'Hosted workflows run Node 22 today; Node 24 (production Vercel runtime) is a candidate pending a green nightly profile on the node24 job image. Do not flip package engines or workflow node-version until qualified.';

/** Maps the executor's fine-grained outcome onto the contract's coarse one. */
export function toContractOutcome(outcome: SupervisorOutcome): ContractOutcome {
  switch (outcome) {
    case 'passed':
      return 'passed';
    case 'failed':
    case 'oom':
    case 'crashed':
      return 'failed';
    case 'timeout':
      return 'timed-out';
    case 'cancelled':
      return 'cancelled';
    case 'storage-exhausted':
    case 'infrastructure-error':
      return 'infrastructure-error';
  }
}
