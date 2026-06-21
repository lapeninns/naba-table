import { describe, expect, it } from 'vitest';

import {
  HoldPersistenceError,
  releaseTableHold,
  sweepExpiredHolds,
} from '@/server/capacity/holds';

type DeleteCall = { table: string };

type TableHoldsState = {
  // ids still present in table_holds after the manual delete; used by the
  // verify-after-delete read.
  remainingHoldIds: Set<string>;
};

/**
 * Builds a Supabase-like client stub covering the RPC + table operations used by
 * releaseTableHold / sweepExpiredHolds. `releaseReturn` controls the boolean
 * returned by the release_hold_and_emit RPC.
 */
function createClient(options: {
  releaseReturn?: boolean | null;
  deleteCalls: DeleteCall[];
  holdsState?: TableHoldsState;
  sweepRows?: Array<{ id: string }>;
}) {
  const { releaseReturn = false, deleteCalls, holdsState, sweepRows = [] } = options;

  const rpc = async (name: string) => {
    if (name === 'is_holds_strict_conflicts_enabled') {
      return { data: true, error: null };
    }
    if (name === 'set_hold_conflict_enforcement') {
      return { data: null, error: null };
    }
    if (name === 'release_hold_and_emit') {
      return { data: releaseReturn, error: null };
    }
    return { data: null, error: null };
  };

  const from = (table: string) => {
    const builder: Record<string, unknown> = {};

    // Reads: table_holds verify-after-delete (.select().eq().maybeSingle()).
    builder.select = () => builder;
    builder.lte = () => builder;
    builder.order = () => builder;
    builder.limit = async () => ({ data: sweepRows, error: null });
    builder.eq = () => builder;
    builder.maybeSingle = async () => {
      if (table === 'table_holds') {
        const present = holdsState ? holdsState.remainingHoldIds.size > 0 : false;
        return { data: present ? { id: 'hold-1' } : null, error: null };
      }
      return { data: null, error: null };
    };

    // Writes: delete chains record the order of table deletions.
    builder.delete = () => {
      const deleteBuilder: Record<string, unknown> = {};
      const record = () => {
        deleteCalls.push({ table });
        return { error: null };
      };
      deleteBuilder.eq = async () => record();
      deleteBuilder.in = async () => record();
      return deleteBuilder;
    };

    return builder;
  };

  return { rpc, from } as never;
}

describe('hold release verification (#16)', () => {
  it('falls back to a verified manual delete when the RPC does not confirm deletion', async () => {
    const deleteCalls: DeleteCall[] = [];
    const client = createClient({
      releaseReturn: false,
      deleteCalls,
      holdsState: { remainingHoldIds: new Set() }, // row gone after manual delete
    });

    await expect(releaseTableHold({ holdId: 'hold-1', client })).resolves.toBeUndefined();

    // Manual delete must remove members and the hold row.
    expect(deleteCalls.map((call) => call.table)).toContain('table_hold_members');
    expect(deleteCalls.map((call) => call.table)).toContain('table_holds');
  });

  it('does NOT fall back when the RPC confirms deletion (returns true)', async () => {
    const deleteCalls: DeleteCall[] = [];
    const client = createClient({ releaseReturn: true, deleteCalls });

    await releaseTableHold({ holdId: 'hold-1', client });

    expect(deleteCalls).toHaveLength(0);
  });

  it('propagates a failure instead of reporting success on partial deletion', async () => {
    const deleteCalls: DeleteCall[] = [];
    const client = createClient({
      releaseReturn: false,
      deleteCalls,
      // The hold row is still present after the delete attempt -> verify fails.
      holdsState: { remainingHoldIds: new Set(['hold-1']) },
    });

    await expect(releaseTableHold({ holdId: 'hold-1', client })).rejects.toBeInstanceOf(
      HoldPersistenceError,
    );
  });
});

describe('sweepExpiredHolds non-atomic ordering (#22)', () => {
  it('deletes the parent hold rows before the members so no active-but-empty hold is observable', async () => {
    const deleteCalls: DeleteCall[] = [];
    const client = createClient({
      deleteCalls,
      sweepRows: [{ id: 'hold-1' }, { id: 'hold-2' }],
    });

    const result = await sweepExpiredHolds({ client });

    expect(result.total).toBe(2);
    expect(result.holdIds).toEqual(['hold-1', 'hold-2']);
    // Ordering is the fix: table_holds must be deleted before table_hold_members.
    const holdsIndex = deleteCalls.findIndex((call) => call.table === 'table_holds');
    const membersIndex = deleteCalls.findIndex((call) => call.table === 'table_hold_members');
    expect(holdsIndex).toBeGreaterThanOrEqual(0);
    expect(membersIndex).toBeGreaterThanOrEqual(0);
    expect(holdsIndex).toBeLessThan(membersIndex);
  });
});
