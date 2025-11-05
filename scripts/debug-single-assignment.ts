#!/usr/bin/env tsx
/**
 * Debug a single table assignment to understand why it's failing
 */

import { getServiceSupabaseClient } from '@/server/supabase'
import { quoteTablesForBooking, assignTableToBooking } from '@/server/capacity/tables'

const RESTAURANT_ID = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
const BOOKING_ID = '3c3c3c0a-9ab8-4a15-bc6d-3fe5d36b9eb8' // party of 2 at 12:00

async function debugSingleAssignment() {
  console.log('🔍 Debugging single table assignment...\n')
  
  const supabase = getServiceSupabaseClient()
  
  // Fetch booking details
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', BOOKING_ID)
    .single()
  
  if (bookingError || !booking) {
    console.error('❌ Failed to fetch booking:', bookingError)
    return
  }
  
  console.log('📋 Booking details:', {
    id: booking.id.substring(0, 8),
    date: booking.booking_date,
    time: `${booking.start_time} - ${booking.end_time}`,
    party: booking.party_size,
    seating: booking.seating_preference,
    type: booking.booking_type,
    status: booking.status
  })
  
  // Fetch available tables
  const { data: tables, error: tablesError } = await supabase
    .from('table_inventory')
    .select('*')
    .eq('restaurant_id', RESTAURANT_ID)
    .gte('capacity', booking.party_size)
    .order('capacity', { ascending: true })
  
  if (tablesError) {
    console.error('❌ Failed to fetch tables:', tablesError)
    return
  }
  
  console.log(`\n📊 Available tables (capacity >= ${booking.party_size}):`, tables?.length || 0)
  if (tables && tables.length > 0) {
    console.log('Sample tables:', tables.slice(0, 5).map(t => ({
      id: t.id.substring(0, 8),
      capacity: t.capacity,
      category: t.category,
      seating: t.seating_type
    })))
  }
  
  // Check for conflicts (holds and assignments)
  const { data: holds, error: holdsError } = await supabase
    .from('table_holds')
    .select('*')
    .eq('restaurant_id', RESTAURANT_ID)
    .gt('expires_at', new Date().toISOString())
  
  console.log(`\n🔒 Active holds:`, holds?.length || 0)
  
  const { data: assignments, error: assignmentsError } = await supabase
    .from('booking_table_assignments')
    .select('*, bookings!inner(*)')
    .eq('bookings.restaurant_id', RESTAURANT_ID)
    .eq('bookings.booking_date', booking.booking_date)
  
  console.log(`📌 Existing assignments for ${booking.booking_date}:`, assignments?.length || 0)
  
  // Try to select and assign using V2 APIs
  console.log('\n⚡ Selecting candidate tables and attempting assignment...\n')

  try {
    const quote = await quoteTablesForBooking({
      bookingId: BOOKING_ID,
      createdBy: 'debug-script',
      // Keep defaults for adjacency, max tables; adjust as needed
    })

    if (!quote.candidate || quote.candidate.tableIds.length === 0) {
      console.log('❌ No suitable candidate tables found')
      console.log('Reason:', quote.reason)
      if (quote.alternates?.length) {
        console.log('Alternates:', quote.alternates.slice(0, 3))
      }
      return
    }

    const assignmentId = await assignTableToBooking(
      BOOKING_ID,
      quote.candidate.tableIds,
      'debug-script'
    )

    console.log('✅ Assignment successful!')
    console.log('Assignment ID:', assignmentId.substring(0, 8))
    console.log('Tables assigned:', quote.candidate.tableNumbers)
  } catch (error) {
    console.error('💥 Exception during assignment:', error)
  }
}

debugSingleAssignment().catch(console.error)
