/**
 * Remote migration ledger comparison.
 *
 * `supabase migration list --linked` prints a table with LOCAL, REMOTE and TIME columns.
 * A promotion plan is only allowed when the remote ledger is a prefix-compatible view of the
 * local migration files: nothing applied remotely may be missing locally, and no pending
 * local file may sit behind the newest remotely applied version (that would require the
 * refused historical replay path).
 */

export type LedgerRow = {
  readonly local: string | null;
  readonly remote: string | null;
};

export type LedgerComparison = {
  readonly ok: boolean;
  readonly applied: readonly string[];
  readonly pending: readonly string[];
  readonly remoteOnly: readonly string[];
  readonly outOfOrderPending: readonly string[];
  readonly unlistedLocal: readonly string[];
  readonly messages: readonly string[];
};

const VERSION_PATTERN = /^\d{8,14}$/;

function normalizeCell(cell: string): string | null {
  const trimmed = cell.trim();
  return VERSION_PATTERN.test(trimmed) ? trimmed : null;
}

export function parseMigrationList(output: string): readonly LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (!/\d{8,14}/.test(line)) {
      continue;
    }
    const cells = line.split(/[│|]/);
    if (cells.length < 2) {
      continue;
    }
    const local = normalizeCell(cells[0]);
    const remote = normalizeCell(cells[1]);
    if (local === null && remote === null) {
      continue;
    }
    rows.push({ local, remote });
  }
  return rows;
}

export function migrationVersionFromFileName(fileName: string): string | null {
  const match = fileName.match(/^(\d{8,14})_.+\.sql$/);
  return match ? match[1] : null;
}

export function compareLedger(
  rows: readonly LedgerRow[],
  localVersions: readonly string[],
): LedgerComparison {
  const applied: string[] = [];
  const pending: string[] = [];
  const remoteOnly: string[] = [];
  const listedLocal = new Set<string>();

  for (const row of rows) {
    if (row.local !== null) {
      listedLocal.add(row.local);
    }
    if (row.local !== null && row.remote !== null) {
      applied.push(row.remote);
    } else if (row.local !== null) {
      pending.push(row.local);
    } else if (row.remote !== null) {
      remoteOnly.push(row.remote);
    }
  }

  const newestApplied = applied.reduce<string | null>(
    (newest, version) => (newest === null || version > newest ? version : newest),
    null,
  );
  const outOfOrderPending = pending.filter(
    (version) => newestApplied !== null && version < newestApplied,
  );
  const unlistedLocal = localVersions.filter((version) => !listedLocal.has(version));

  const messages: string[] = [];
  if (rows.length === 0) {
    messages.push('Remote migration ledger is empty or unparseable; refusing to plan blind.');
  }
  if (remoteOnly.length > 0) {
    messages.push(
      `Remote ledger contains versions with no local file (${remoteOnly.join(', ')}); migration repair is refused, reconcile the source tree first.`,
    );
  }
  if (outOfOrderPending.length > 0) {
    messages.push(
      `Pending local migrations sit behind the newest applied version ${newestApplied ?? 'unknown'} (${outOfOrderPending.join(', ')}); historical replay is refused.`,
    );
  }
  if (unlistedLocal.length > 0) {
    messages.push(
      `Local migration files are absent from the CLI ledger view (${unlistedLocal.join(', ')}); the isolated workdir does not match the source tree.`,
    );
  }

  return {
    ok: messages.length === 0,
    applied,
    pending,
    remoteOnly,
    outOfOrderPending,
    unlistedLocal,
    messages,
  };
}
