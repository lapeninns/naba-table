#!/usr/bin/env tsx
/**
 * Debug a single table assignment to understand why it's failing
 */

import { createServerSupabaseClient } from '@/server/supabase'
import { assignTablesForBooking } from '@/server/capacity/tables'

const RESTAURANT_ID = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
const BOOKING_ID = '3c3c3c0a-9ab8-4a15-bc6d-3fe5d36b9eb8' // party of 2 at 12:00

async function debugSingleAssignment() {
  console.log('🔍 Debugging single table assignment...\n')
  
  const supabase = createServerSupabaseClient()
  
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
  
  // Try to assign
  console.log('\n⚡ Attempting table assignment...\n')
  
  try {
    const result = await assignTablesForBooking({
      bookingId: BOOKING_ID,
      restaurantId: RESTAURANT_ID,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      partySize: booking.party_size,
      seatingPreference: booking.seating_preference,
      bookingType: booking.booking_type
    })
    
    if (result.success) {
      console.log('✅ Assignment successful!')
      console.log('Tables assigned:', result.tables?.map(t => ({
        id: t.id.substring(0, 8),
        name: t.table_number,
        capacity: t.capacity
      })))
    } else {
      console.log('❌ Assignment failed')
      console.log('Reason:', result.error)
      console.log('Details:', result.details)
    }
  } catch (error) {
    console.error('💥 Exception during assignment:', error)
  }
}

debugSingleAssignment().catch(console.error)
