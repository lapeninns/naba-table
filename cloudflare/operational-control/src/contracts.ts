export const SERVICE_NAME = 'operational-control';

/** GitHub Actions' own GitHub App id. Check runs created by hosted workflows carry it. */
export const GITHUB_ACTIONS_APP_ID = 15368;

export const REQUIRED_PROTECTED_REF = 'refs/heads/main';

export const CI_PROFILES = ['pr', 'main', 'nightly'] as const;
export type CiProfile = (typeof CI_PROFILES)[number];

export const LOCAL_CHECK_NAME_PREFIX = 'Local CI / ';
/**
 * Prefix of the deterministic tuple key the Mac controller publishes as the local check run's
 * `external_id` (`nabatable-ci/v1:<repositoryId>:<profile>:<prNumber|none>:<headSha>:<baseSha>:
 * <testedSha>:<policyVersion>:<imageDigest>:<controllerVersion>:<attempt>`). Mirrors
 * `TUPLE_KEY_PREFIX` in scripts/ci/gate/tuple.ts and scripts/ci/controller/github/evidence-document.ts.
 */
export const TUPLE_KEY_PREFIX = 'nabatable-ci/v1';
export const GATE_CHECK_NAME = 'Release gate';

export const ALLOWED_WEBHOOK_EVENTS = [
  'check_run',
  'check_suite',
  'pull_request',
  'push',
  'workflow_run',
] as const;
export type WebhookEventType = (typeof ALLOWED_WEBHOOK_EVENTS)[number];

/**
 * Hosted workflows that must complete for a candidate before the release gate is dispatched.
 *
 * Mirrors `requiredHostedWorkflows` in config/ci/policy.json (the gate's authority):
 * the trusted hosted lanes that run for every pull request head and every push to
 * main. Every candidate, pr and main alike, waits for these runs on its head SHA,
 * so a workflow that does not run on push (the legacy PR-only suites) must never be
 * listed here or main candidates stay pending forever.
 * tests/scripts/ci/phase1/lane-contracts.test.ts keeps this list in lock-step with
 * the policy file and the real workflow triggers.
 */
export const DEFAULT_REQUIRED_HOSTED_WORKFLOWS = [
  '.github/workflows/security-guards.yml',
  '.github/workflows/codeql.yml',
] as const;

export const ACTIVE_RUNTIME = 'node22';
export const CANDIDATE_RUNTIME = 'node24';
export const RUNTIMES = [ACTIVE_RUNTIME, CANDIDATE_RUNTIME] as const;
export type Runtime = (typeof RUNTIMES)[number];

export const WEBHOOK_MAX_BYTES = 512 * 1024;
export const HEARTBEAT_MAX_BYTES = 8 * 1024;
/** Deliveries whose embedded timestamp is older than this are rejected as replays. */
export const WEBHOOK_REPLAY_WINDOW_MS = 60 * 60 * 1000;
/** Tolerated clock skew for timestamps that appear to be in the future. */
export const WEBHOOK_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const DELIVERY_DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

export const HEARTBEAT_SKEW_MS = 5 * 60 * 1000;
export const HEARTBEAT_ALERT_AFTER_MS = 15 * 60 * 1000;
export const HEARTBEAT_FALLBACK_AFTER_MS = 60 * 60 * 1000;

export const INCIDENT_ESCALATION_AFTER_MS = 15 * 60 * 1000;
export const INCIDENT_RESOLVE_HEALTHY_STREAK = 3;

export const EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const EVIDENCE_MAX_OBJECT_BYTES = 64 * 1024;
/** Bucket lifecycle rule (configured out of band) is assumed to expire objects after this many days. */
export const EVIDENCE_RETENTION_DAYS = 14;
export const EVIDENCE_PREFIX = 'evidence';
export const EVIDENCE_LATEST_KEY = 'evidence/latest.json';

export const PROBE_TIMEOUT_MS = 5_000;
export const MAX_PROBE_TARGETS = 10;
export const READY_CHECK_TIMEOUT_MS = 2_000;
export const UPTIME_PING_TIMEOUT_MS = 5_000;

/** Bounded exponential backoff for gate-dispatch transport failures (ms between attempts). */
export const DISPATCH_RETRY_SCHEDULE_MS = [30_000, 60_000, 120_000, 240_000, 480_000] as const;
export const DISPATCH_MAX_ATTEMPTS = DISPATCH_RETRY_SCHEDULE_MS.length + 1;

export const SHA_PATTERN = /^[0-9a-f]{40}$/u;
export const IMAGE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._+-]{1,64}$/u;
export const NUMERIC_ID_PATTERN = /^[1-9][0-9]{0,18}$/u;
/** Matches `REPLACE_ME_*` vars/secrets and lowercase `replace-me-*` resource names (R2 requires lowercase). */
export const PLACEHOLDER_PATTERN = /replace[-_]me/iu;

export type CiRequestTuple = {
  readonly repositoryId: string;
  readonly profile: CiProfile;
  readonly prNumber?: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly testedSha: string;
  readonly policyVersion: string;
  readonly imageDigest: string;
  readonly controllerVersion: string;
  readonly attempt: number;
};

export type CheckStatus = 'queued' | 'in_progress' | 'completed';
export type CheckConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | 'stale'
  | 'skipped';

export type LocalCheckEvent = {
  readonly type: 'local_check';
  readonly tuple: CiRequestTuple;
  readonly checkRunId: number;
  readonly name: string;
  readonly status: CheckStatus;
  readonly conclusion: CheckConclusion | null;
  readonly occurredAt: string;
};

export type HostedRunEvent = {
  readonly type: 'hosted_run';
  readonly headSha: string;
  readonly workflowPath: string;
  readonly workflowId: number;
  readonly runId: number;
  readonly runAttempt: number;
  readonly status: CheckStatus;
  readonly conclusion: CheckConclusion | null;
  readonly occurredAt: string;
};

export type PullRequestEvent = {
  readonly type: 'pull_request';
  readonly action: string;
  readonly prNumber: number;
  readonly headSha: string;
  readonly occurredAt: string;
};

export type PushEvent = {
  readonly type: 'push';
  readonly ref: string;
  readonly afterSha: string;
  readonly occurredAt: string;
};

export type ObservedEvent = {
  readonly type: 'observed';
  readonly kind: 'hosted_check' | 'check_suite';
  readonly headSha: string;
  readonly occurredAt: string;
};

export type NormalizedEvent =
  | LocalCheckEvent
  | HostedRunEvent
  | PullRequestEvent
  | PushEvent
  | ObservedEvent;

export type WebhookDelivery = {
  readonly deliveryId: string;
  readonly eventType: WebhookEventType;
  readonly event: NormalizedEvent;
};

export type ControllerStatus = 'idle' | 'busy' | 'draining';

export type ControllerHeartbeat = {
  readonly controllerId: string;
  readonly controllerVersion: string;
  readonly imageDigest: string;
  readonly activeRuntime: Runtime;
  readonly candidateRuntime: Runtime;
  readonly status: ControllerStatus;
  readonly sentAt: string;
  readonly queueDepth: number;
  readonly running: number;
  readonly maxConcurrent: number;
  readonly lastCompletedAt?: string;
};

export type HeartbeatState = 'unknown' | 'fresh' | 'alert' | 'fallback_eligible';

export type ProbeEnvironment = 'staging' | 'production';

export type ProbeTarget = {
  readonly name: string;
  readonly environment: ProbeEnvironment;
  readonly url: string;
};

export type HealthObservation = {
  readonly service: string;
  readonly environment: string;
  readonly failureClass: string;
  readonly healthy: boolean;
};

export type IncidentStatus = 'open' | 'escalated' | 'resolved';

export type IncidentSummary = {
  readonly id: string;
  readonly service: string;
  readonly environment: string;
  readonly failureClass: string;
  readonly status: IncidentStatus;
  readonly openedAt: string;
  readonly lastSeenAt: string;
  readonly escalatedAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly resolvedAt: string | null;
  readonly healthyStreak: number;
};

export type CandidateState = 'pending' | 'ready' | 'dispatched' | 'rejected' | 'closed' | 'failed';

export type CoordinatorStatus = {
  readonly heartbeat: {
    readonly state: HeartbeatState;
    readonly lastSeenAt: string | null;
    readonly ageMs: number | null;
    readonly controllerId: string | null;
    readonly controllerVersion: string | null;
    readonly activeRuntime: Runtime | null;
    readonly candidateRuntime: Runtime | null;
  };
  readonly candidates: Readonly<Record<CandidateState, number>>;
  readonly retryQueue: { readonly depth: number; readonly nextRunAt: string | null };
  readonly incidents: { readonly active: readonly IncidentSummary[] };
  readonly deliveries: { readonly tracked: number };
};

export type VersionMetadata = {
  readonly id: string;
  readonly tag: string;
  readonly timestamp: string;
};

export type EvidenceBucket = {
  put(
    key: string,
    value: string,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  head(key: string): Promise<{ uploaded: Date; size: number } | null>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
};

export type CoordinatorStubLike = {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
};

export type CoordinatorObjectId = { toString(): string };

export type CoordinatorNamespace = {
  idFromName(name: string): CoordinatorObjectId;
  get(id: CoordinatorObjectId): CoordinatorStubLike;
};

export type OperationalControlEnv = {
  readonly COORDINATOR?: CoordinatorNamespace;
  readonly EVIDENCE_BUCKET?: EvidenceBucket;
  readonly GITHUB_WEBHOOK_SECRET?: string;
  readonly GITHUB_DISPATCH_APP_ID?: string;
  readonly GITHUB_DISPATCH_APP_PRIVATE_KEY?: string;
  readonly GITHUB_DISPATCH_INSTALLATION_ID?: string;
  readonly HEARTBEAT_TOKEN?: string;
  readonly MONITORING_TOKEN?: string;
  readonly VERCEL_AUTOMATION_BYPASS_SECRET?: string;
  readonly VERCEL_AUTOMATION_BYPASS_ORIGIN?: string;
  readonly INCIDENT_ACKNOWLEDGEMENT_TOKEN?: string;
  readonly UPTIME_HEARTBEAT_URL?: string;
  readonly REPOSITORY_ID?: string;
  readonly LOCAL_CI_APP_ID?: string;
  readonly GATE_WORKFLOW_ID?: string;
  readonly FALLBACK_WORKFLOW_ID?: string;
  readonly SCHEDULED_VALIDATION_WORKFLOW_ID?: string;
  readonly PROTECTED_REF?: string;
  readonly TARGETS_JSON?: string;
  readonly REQUIRED_HOSTED_WORKFLOWS?: string;
  readonly GITHUB_API_BASE_URL?: string;
  readonly DEPLOY_SHA?: string;
  readonly ERROR_INSIGHT_TOKEN?: string;
  readonly ERROR_INSIGHT_WEBHOOK_URL?: string;
  readonly POSTHOG_PROJECT_API_KEY?: string;
  readonly POSTHOG_HOST?: string;
  readonly CF_VERSION_METADATA?: VersionMetadata;
};
