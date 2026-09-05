/**
 * Guest egress phase control.
 *
 * The job network is a single `--internal` Docker network inside the guest.
 * Whether a job can reach the proxy is decided by the nftables chain
 * `job_to_proxy` managed by infra/local-ci/network/egress.sh:
 *
 *   phase prep  -> chain contains `accept`: jobs may CONNECT to the proxy only
 *   phase test  -> chain is empty: every packet from the job subnet is dropped
 *                  (equivalent to `--network none`, but the container keeps its
 *                  interface so the switch needs no restart)
 *
 * Deny rules that hold in both phases (see egress.sh): no forwarding from or to
 * the job subnet, no DNS for jobs, no IPv6, no RFC1918/CGNAT/link-local/metadata
 * destinations, proxy limited to allowlisted hosts on 80/443.
 *
 * The executor flips the phase through `limactl shell` (root via sudo inside the
 * guest) and verifies the reported phase before continuing; a failed or
 * unverifiable switch to `test` aborts the job before any repository code runs.
 */

export type EgressPhase = 'prep' | 'test';

export interface GuestShell {
  shell(args: readonly string[], purpose: string, timeoutMs?: number): Promise<string>;
}

export class EgressPhaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EgressPhaseError';
  }
}

const SCRIPT_PATH_PATTERN = /^\/[A-Za-z0-9._/-]+$/u;

export function assertEgressScriptPath(scriptPath: string): void {
  if (!SCRIPT_PATH_PATTERN.test(scriptPath) || scriptPath.includes('..')) {
    throw new EgressPhaseError(
      `egress script path "${scriptPath}" is not a safe absolute guest path`,
    );
  }
}

export function egressPhaseCommand(scriptPath: string, phase: EgressPhase): readonly string[] {
  assertEgressScriptPath(scriptPath);
  return ['sudo', '-n', scriptPath, 'phase', phase];
}

export function egressStatusCommand(scriptPath: string): readonly string[] {
  assertEgressScriptPath(scriptPath);
  return ['sudo', '-n', scriptPath, 'status'];
}

/** Parses the first line of `egress.sh status` (`phase: prep|test`). */
export function parseEgressPhase(statusOutput: string): EgressPhase | null {
  const match = /^phase:\s*(prep|test)\s*$/mu.exec(statusOutput);
  return match ? (match[1] as EgressPhase) : null;
}

export async function setEgressPhase(
  guest: GuestShell,
  scriptPath: string,
  phase: EgressPhase,
): Promise<void> {
  await guest.shell(egressPhaseCommand(scriptPath, phase), `egress phase ${phase}`, 60_000);
  const status = await guest.shell(egressStatusCommand(scriptPath), 'egress status', 60_000);
  const reported = parseEgressPhase(status);
  if (reported !== phase) {
    throw new EgressPhaseError(
      `guest egress phase is ${reported ?? 'unknown'} after requesting ${phase}; refusing to continue`,
    );
  }
}
