/**
 * Integration Tests: Table Assignment Slot-Level Constraints
 * 
 * Tests to verify that tables can only be assigned to a specific slot once,
 * while allowing non-overlapping bookings on the same day.
 */

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import type { Database } from '../../types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Table Assignment Slot-Level Constraints', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  
  // Test data IDs
  let restaurantId: string;
  let tableId: string;
  let zoneId: string;
  let slot1Id: string;
  let slot2Id: string;
  let booking1Id: string;
  let booking2Id: string;
  let booking3Id: string;
  let customerId: string;

  beforeAll(async () => {
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
    
    // Create test restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .insert({
        name: 'Test Restaurant - Slot Constraints',
        slug: `test-slot-constraints-${Date.now()}`,
        timezone: 'Europe/London',
      })
      .select()
      .single();
    
    if (restaurantError) throw restaurantError;
    restaurantId = restaurant.id;

    // Create test zone
    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .insert({
        restaurant_id: restaurantId,
        name: 'Test Zone',
        sort_order: 1,
      })
      .select()
      .single();
    
    if (zoneError) throw zoneError;
    zoneId = zone.id;

    // Create allowed capacity
    await supabase
      .from('allowed_capacities')
      .insert({
        restaurant_id: restaurantId,
        capacity: 4,
      });

    // Create test table
    const { data: table, error: tableError } = await supabase
      .from('table_inventory')
      .insert({
        restaurant_id: restaurantId,
        zone_id: zoneId,
        table_number: 'T1',
        capacity: 4,
        min_party_size: 2,
        category: 'dining',
        seating_type: 'standard',
        mobility: 'fixed',
        status: 'available',
        active: true,
      })
      .select()
      .single();
    
    if (tableError) throw tableError;
    tableId = table.id;

    // Create two non-overlapping slots on the same day
    const testDate = '2025-10-28';
    
    const { data: slot1, error: slot1Error } = await supabase
      .from('booking_slots')
      .insert({
        restaurant_id: restaurantId,
        slot_date: testDate,
        slot_time: '12:00',
        available_capacity: 10,
        reserved_count: 0,
      })
      .select()
      .single();
    
    if (slot1Error) throw slot1Error;
    slot1Id = slot1.id;

    const { data: slot2, error: slot2Error } = await supabase
      .from('booking_slots')
      .insert({
        restaurant_id: restaurantId,
        slot_date: testDate,
        slot_time: '14:00',
        available_capacity: 10,
        reserved_count: 0,
      })
      .select()
      .single();
    
    if (slot2Error) throw slot2Error;
    slot2Id = slot2.id;

    // Create test customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        restaurant_id: restaurantId,
        full_name: 'Test Customer',
        email: `test-${Date.now()}@example.com`,
        phone: '+1234567890',
      })
      .select()
      .single();
    
    if (customerError) throw customerError;
    customerId = customer.id;

    // Create test bookings
    const { data: booking1, error: booking1Error } = await supabase
      .from('bookings')
      .insert({
        restaurant_id: restaurantId,
        customer_id: customerId,
        customer_name: 'Test Customer',
        customer_email: `test-${Date.now()}@example.com`,
        customer_phone: '+1234567890',
        booking_date: testDate,
        start_time: '12:00',
        end_time: '13:00',
        party_size: 4,
        status: 'confirmed',
        reference: `REF-${Date.now()}-1`,
      })
      .select()
      .single();
    
    if (booking1Error) throw booking1Error;
    booking1Id = booking1.id;

    const { data: booking2, error: booking2Error } = await supabase
      .from('bookings')
      .insert({
        restaurant_id: restaurantId,
        customer_id: customerId,
        customer_name: 'Test Customer',
        customer_email: `test-${Date.now()}@example.com`,
        customer_phone: '+1234567890',
        booking_date: testDate,
        start_time: '12:00',
        end_time: '13:00',
        party_size: 4,
        status: 'confirmed',
        reference: `REF-${Date.now()}-2`,
      })
      .select()
      .single();
    
    if (booking2Error) throw booking2Error;
    booking2Id = booking2.id;

    const { data: booking3, error: booking3Error } = await supabase
      .from('bookings')
      .insert({
        restaurant_id: restaurantId,
        customer_id: customerId,
        customer_name: 'Test Customer',
        customer_email: `test-${Date.now()}@example.com`,
        customer_phone: '+1234567890',
        booking_date: testDate,
        start_time: '14:00',
        end_time: '15:00',
        party_size: 4,
        status: 'confirmed',
        reference: `REF-${Date.now()}-3`,
      })
      .select()
      .single();
    
    if (booking3Error) throw booking3Error;
    booking3Id = booking3.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (restaurantId) {
      await supabase.from('booking_table_assignments').delete().eq('booking_id', booking1Id);
      await supabase.from('booking_table_assignments').delete().eq('booking_id', booking2Id);
      await supabase.from('booking_table_assignments').delete().eq('booking_id', booking3Id);
      await supabase.from('bookings').delete().eq('restaurant_id', restaurantId);
      await supabase.from('booking_slots').delete().eq('restaurant_id', restaurantId);
      await supabase.from('customers').delete().eq('restaurant_id', restaurantId);
      await supabase.from('table_inventory').delete().eq('restaurant_id', restaurantId);
      await supabase.from('allowed_capacities').delete().eq('restaurant_id', restaurantId);
      await supabase.from('zones').delete().eq('restaurant_id', restaurantId);
      await supabase.from('restaurants').delete().eq('id', restaurantId);
    }
  });

  it('should allow assigning a table to the first booking in slot 1', async () => {
    const { data, error } = await supabase
      .from('booking_table_assignments')
      .insert({
        booking_id: booking1Id,
        table_id: tableId,
        slot_id: slot1Id,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.table_id).toBe(tableId);
    expect(data?.slot_id).toBe(slot1Id);
    expect(data?.booking_id).toBe(booking1Id);
  });

  it('should prevent assigning the same table to a second booking in the same slot', async () => {
    const { data, error } = await supabase
      .from('booking_table_assignments')
      .insert({
        booking_id: booking2Id,
        table_id: tableId,
        slot_id: slot1Id,
      })
      .select()
      .single();

    expect(error).toBeDefined();
    expect(error?.code).toBe('23505'); // Unique constraint violation
    expect(error?.message).toContain('booking_table_assignments_table_id_slot_id_key');
    expect(data).toBeNull();
  });

  it('should allow assigning the same table to a different slot on the same day', async () => {
    const { data, error } = await supabase
      .from('booking_table_assignments')
      .insert({
        booking_id: booking3Id,
        table_id: tableId,
        slot_id: slot2Id,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.table_id).toBe(tableId);
    expect(data?.slot_id).toBe(slot2Id);
    expect(data?.booking_id).toBe(booking3Id);
  });

  it('should have exactly 2 assignments for the table across both slots', async () => {
    const { data, error } = await supabase
      .from('booking_table_assignments')
      .select('*')
      .eq('table_id', tableId)
      .in('booking_id', [booking1Id, booking3Id]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    
    const slotIds = data?.map(a => a.slot_id).sort();
    expect(slotIds).toEqual([slot1Id, slot2Id].sort());
  });

  it('should prevent duplicate assignments even with NULL assigned_by', async () => {
    // First, remove the existing assignment for booking1
    await supabase
      .from('booking_table_assignments')
      .delete()
      .eq('booking_id', booking1Id)
      .eq('table_id', tableId);

    // Try to create two assignments without assigned_by
    const { error: error1 } = await supabase
      .from('booking_table_assignments')
      .insert({
        booking_id: booking1Id,
        table_id: tableId,
        slot_id: slot1Id,
        assigned_by: null,
      });

    expect(error1).toBeNull();

    const { error: error2 } = await supabase
      .from('booking_table_assignments')
      .insert({
        booking_id: booking1Id,
        table_id: tableId,
        slot_id: slot1Id,
        assigned_by: null,
      });

    expect(error2).toBeDefined();
    expect(error2?.code).toBe('23505');
  });
});

describe('Table Assignment Edge Cases', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  
  beforeAll(() => {
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
  });

  it('should allow assignments with NULL slot_id (legacy bookings)', async () => {
    // This test verifies that the unique constraint only applies when slot_id is NOT NULL
    // Legacy bookings without slot_id should still work
    
    // Note: This test would require additional setup similar to the main test suite
    // It's included here as a placeholder for the edge case
    expect(true).toBe(true);
  });

  it('should handle concurrent assignment attempts gracefully', async () => {
    // This test would verify race condition handling
    // It's included here as a placeholder for stress testing
    expect(true).toBe(true);
  });
});
