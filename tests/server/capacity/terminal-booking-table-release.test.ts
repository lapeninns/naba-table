import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260808120000_release_terminal_booking_table_state.sql',
  ),
  'utf8',
)
  .replace(/\s+/g, ' ')
  .toLowerCase();

describe('terminal booking table-state release migration', () => {
  it('atomically releases active assignments when a booking enters a terminal status', () => {
    expect(migration).toContain('after update of status on public.bookings');
    expect(migration).toContain("new.status in ('cancelled', 'completed', 'no_show')");
    expect(migration).toContain(
      'perform public.release_booking_table_state(new.id, new.restaurant_id)',
    );
    expect(migration).toContain('delete from public.booking_table_assignments as assignment');
    expect(migration).toContain('delete from public.booking_assignment_idempotency as idempotency');
  });

  it('archives allocations before tenant-scoped active-state deletion', () => {
    const archivePosition = migration.indexOf('insert into public.allocations_archive');
    const deletePosition = migration.indexOf('delete from public.allocations as allocation');

    expect(archivePosition).toBeGreaterThan(-1);
    expect(deletePosition).toBeGreaterThan(archivePosition);
    expect(migration).toContain('allocation.restaurant_id = p_restaurant_id');
    expect(migration).toContain('booking.restaurant_id = p_restaurant_id');
  });

  it('cleans non-blocking status conflicts before both allocation and assignment inserts', () => {
    expect(migration).toContain(
      "booking.status in ('cancelled', 'completed', 'no_show', 'checked_in')",
    );
    expect(migration).toContain('before insert on public.allocations');
    expect(migration).toContain('before insert on public.booking_table_assignments');
  });

  it('keeps planner availability aligned with the blocking-status contract', () => {
    expect(migration).toContain("booking.status in ('pending', 'pending_allocation', 'confirmed')");
    expect(migration).not.toContain("booking.status in ('pending', 'confirmed', 'checked_in')");
  });

  it('exposes a service-role-only idempotent cancellation RPC', () => {
    expect(migration).toContain(
      'create or replace function public.cancel_booking_and_release_table_state',
    );
    expect(migration).toContain("changed := current_booking.status <> 'cancelled'");
    expect(migration).toContain(
      'perform public.release_booking_table_state(p_booking_id, p_restaurant_id)',
    );
    expect(migration).toContain(
      'grant execute on function public.cancel_booking_and_release_table_state(uuid, uuid) to service_role',
    );
  });
});
