#!/usr/bin/env tsx
/**
 * Minimal single-booking assignment test with diagnostics.
 *
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/test-single-assignment.ts \
 *     --booking=BOOKING_UUID
 *
 * Debug envs:
 *   CAPACITY_DEBUG=1                         # enable detailed allocator logs
 *   CAPACITY_DISABLE_TIME_PRUNING=1          # force-disable time pruning
 *   CAPACITY_DISABLE_LOOKAHEAD=1             # force-disable lookahead
 */

import { quoteTablesForBooking, confirmHoldAssignment } from '@/server/capacity/tables'
import {
  isPlannerTimePruningEnabled,
  isSelectorLookaheadEnabled,
  isHoldsEnabled,
  isCombinationPlannerEnabled,
  getAllocatorAdjacencyMinPartySize,
  isAllocatorAdjacencyRequired,
} from '@/server/feature-flags'
import { getServiceSupabaseClient } from '@/server/supabase'

function parseArgs(): { bookingId: string } {
  const raw = process.argv.slice(2)
  const arg = raw.find((x) => x.startsWith('--booking='))
  const bookingId = arg ? arg.split('=')[1] : ''
  if (!bookingId) {
    console.error('Usage: pnpm tsx -r tsconfig-paths/register scripts/test-single-assignment.ts --booking=<BOOKING_UUID>')
    process.exit(1)
  }
  return { bookingId }
}

async function main() {
  const { bookingId } = parseArgs()
  const supabase = getServiceSupabaseClient()

  console.log('[debug] Feature flags:', {
    timePruning: isPlannerTimePruningEnabled(),
    lookahead: isSelectorLookaheadEnabled(),
    holdsEnabled: isHoldsEnabled(),
    combinationEnabled: isCombinationPlannerEnabled(),
    adjacencyRequired: isAllocatorAdjacencyRequired(),
    adjacencyMinPartySize: getAllocatorAdjacencyMinPartySize(),
    env: {
      CAPACITY_DEBUG: process.env.CAPACITY_DEBUG,
      CAPACITY_DISABLE_TIME_PRUNING: process.env.CAPACITY_DISABLE_TIME_PRUNING,
      CAPACITY_DISABLE_LOOKAHEAD: process.env.CAPACITY_DISABLE_LOOKAHEAD,
    }
  })

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, end_time, party_size, restaurant_id')
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !booking) {
    console.error('[test] Failed to load booking', { error })
    process.exit(1)
  }

  console.log('[test] Booking:', {
    bookingId,
    date: booking.booking_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    party_size: booking.party_size,
  })

  const t0 = Date.now()
  const quote = await quoteTablesForBooking({
    bookingId,
    createdBy: 'test-single-assignment',
    holdTtlSeconds: 180,
    client: supabase,
  })
  const dt = Date.now() - t0

  console.log('[test] Quote result:', {
    hasHold: !!quote.hold,
    alternates: (quote.alternates ?? []).length,
    reason: quote.reason,
    latencyMs: dt,
  })

  if (quote.hold) {
    console.log('[test] Confirming hold...', { holdId: quote.hold.id })
    await confirmHoldAssignment({ holdId: quote.hold.id, bookingId, idempotencyKey: `test-${bookingId}`, assignedBy: null })
    console.log('[test] Confirmed!')
  } else {
    console.log('[test] No hold created; reason above')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
