/**
 * Authenticated readiness verification shared by the Vercel and Worker deploy scripts.
 *
 * Contract: GET <baseUrl><path> with `Authorization: Bearer <MONITORING_TOKEN>` returns
 * JSON whose `revision` (or `sourceRevision`) equals the immutable source SHA baked at
 * build time (NABATABLE_SOURCE_REVISION). `deploymentId` (NABATABLE_BUILD_ID) is recorded
 * when present. Anything else is a failed verification.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ReadinessCheck = {
  readonly baseUrl: string;
  readonly path: string;
  readonly expectedRevision: string;
  readonly monitoringToken: string;
  /** Extra request headers (e.g. Vercel deployment-protection bypass). Never logged. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImpl?: FetchLike;
  readonly attempts?: number;
  readonly delayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
};

export type ReadinessResult = {
  readonly ok: true;
  readonly url: string;
  readonly revision: string;
  readonly buildId: string | null;
  readonly attempts: number;
};

export class ReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadinessError';
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readRevision(payload: unknown): { revision: string | null; buildId: string | null } {
  if (typeof payload !== 'object' || payload === null) return { revision: null, buildId: null };
  const record = payload as Record<string, unknown>;
  const revisionValue = record.revision ?? record.sourceRevision;
  const buildValue = record.deploymentId ?? record.buildId;
  return {
    revision: typeof revisionValue === 'string' ? revisionValue : null,
    buildId: typeof buildValue === 'string' ? buildValue : null,
  };
}

export async function verifyReadiness(check: ReadinessCheck): Promise<ReadinessResult> {
  if (!check.monitoringToken) {
    throw new ReadinessError('MONITORING_TOKEN is not configured; readiness cannot be verified.');
  }
  if (!/^[0-9a-f]{40}$/u.test(check.expectedRevision)) {
    throw new ReadinessError('expectedRevision must be a 40-hex git SHA.');
  }
  const fetchImpl = check.fetchImpl ?? fetch;
  const attempts = Math.max(1, check.attempts ?? 5);
  const delayMs = check.delayMs ?? 3000;
  const sleep = check.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const url = new URL(check.path, check.baseUrl).toString();
  let lastFailure = 'no attempt made';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          ...check.headers,
          authorization: `Bearer ${check.monitoringToken}`,
          accept: 'application/json',
        },
        redirect: 'manual',
      });
      if (response.status !== 200) {
        lastFailure = `HTTP ${response.status}`;
      } else {
        const { revision, buildId } = readRevision(await response.json());
        if (revision === check.expectedRevision) {
          return { ok: true, url, revision, buildId, attempts: attempt };
        }
        lastFailure = revision
          ? `revision mismatch (expected ${check.expectedRevision}, got ${revision})`
          : 'response did not include a revision';
      }
    } catch (error) {
      lastFailure = describeError(error);
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  throw new ReadinessError(`Readiness verification failed for ${url}: ${lastFailure}`);
}
