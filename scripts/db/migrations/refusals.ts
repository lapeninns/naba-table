/**
 * Argument-level refusals for the remote database safe runner.
 *
 * These tokens are refused wherever they appear on the safe-run command line, before
 * environment validation and before any child process. They correspond to Supabase CLI
 * capabilities that must never run through the guarded path: migration history repair,
 * database resets, historical replay controls and destructive/forcing flags.
 */

export type RefusedArgument = {
  readonly token: string;
  readonly reason: string;
};

export const REFUSED_ARGUMENTS: readonly RefusedArgument[] = [
  { token: 'repair', reason: 'migration history repair rewrites the remote ledger' },
  { token: 'reset', reason: 'database reset is destructive' },
  { token: 'wipe', reason: 'wipe is destructive' },
  { token: 'squash', reason: 'squash rewrites migration history' },
  { token: 'revert', reason: 'revert of remote migration history is refused' },
  { token: '--force', reason: 'forcing flags bypass safety checks' },
  { token: '--include-roles', reason: 'role replay is not a governed workflow' },
  { token: '--include-seed', reason: 'seed replay against remote targets is refused' },
  { token: '--db-url', reason: 'ad-hoc connection strings bypass linked target validation' },
  { token: '--status', reason: 'historical status rewrites are refused' },
  { token: '--version', reason: 'explicit version replay is refused' },
];

export function findRefusedArgument(args: readonly string[]): RefusedArgument | null {
  for (const arg of args) {
    const normalized = arg.trim().toLowerCase();
    const bare = normalized.includes('=')
      ? normalized.slice(0, normalized.indexOf('='))
      : normalized;
    const refused = REFUSED_ARGUMENTS.find((entry) => entry.token === bare);
    if (refused) {
      return refused;
    }
  }
  return null;
}

export function renderRefusal(refused: RefusedArgument): string {
  return `Refused argument "${refused.token}": ${refused.reason}.`;
}
