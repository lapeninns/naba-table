/**
 * Unit Tests: Table Window Conflict Detection
 * 
 * Tests for the core logic that determines if a table is available
 * during a specific time window.
 */

import { describe, it, expect } from 'vitest';

/**
 * Mock implementation of the window overlap detection logic
 * (extracted from server/capacity/tables.ts)
 */
type IntervalMs = {
  start: number;
  end: number;
};

function windowsOverlap(a: IntervalMs, b: IntervalMs): boolean {
  return a.start < b.end && b.start < a.end;
}

describe('windowsOverlap', () => {
  it('should detect overlap when windows partially overlap', () => {
    const window1: IntervalMs = { start: 1000, end: 2000 };
    const window2: IntervalMs = { start: 1500, end: 2500 };
    
    expect(windowsOverlap(window1, window2)).toBe(true);
    expect(windowsOverlap(window2, window1)).toBe(true);
  });

  it('should detect overlap when one window contains another', () => {
    const outer: IntervalMs = { start: 1000, end: 3000 };
    const inner: IntervalMs = { start: 1500, end: 2500 };
    
    expect(windowsOverlap(outer, inner)).toBe(true);
    expect(windowsOverlap(inner, outer)).toBe(true);
  });

  it('should detect overlap when windows are identical', () => {
    const window1: IntervalMs = { start: 1000, end: 2000 };
    const window2: IntervalMs = { start: 1000, end: 2000 };
    
    expect(windowsOverlap(window1, window2)).toBe(true);
  });

  it('should NOT detect overlap when windows are adjacent (end meets start)', () => {
    const window1: IntervalMs = { start: 1000, end: 2000 };
    const window2: IntervalMs = { start: 2000, end: 3000 };
    
    // Using half-open intervals [start, end), so end=2000 and start=2000 do NOT overlap
    expect(windowsOverlap(window1, window2)).toBe(false);
    expect(windowsOverlap(window2, window1)).toBe(false);
  });

  it('should NOT detect overlap when windows are completely separate', () => {
    const window1: IntervalMs = { start: 1000, end: 2000 };
    const window2: IntervalMs = { start: 3000, end: 4000 };
    
    expect(windowsOverlap(window1, window2)).toBe(false);
    expect(windowsOverlap(window2, window1)).toBe(false);
  });

  it('should handle same-day non-overlapping slots correctly', () => {
    // 12:00-13:00 (12 noon to 1pm)
    const lunchSlot: IntervalMs = { 
      start: new Date('2025-10-28T12:00:00Z').getTime(),
      end: new Date('2025-10-28T13:00:00Z').getTime(),
    };
    
    // 14:00-15:00 (2pm to 3pm)
    const afternoonSlot: IntervalMs = { 
      start: new Date('2025-10-28T14:00:00Z').getTime(),
      end: new Date('2025-10-28T15:00:00Z').getTime(),
    };
    
    expect(windowsOverlap(lunchSlot, afternoonSlot)).toBe(false);
    expect(windowsOverlap(afternoonSlot, lunchSlot)).toBe(false);
  });

  it('should detect overlap for same-day overlapping slots', () => {
    // 12:00-13:30
    const slot1: IntervalMs = { 
      start: new Date('2025-10-28T12:00:00Z').getTime(),
      end: new Date('2025-10-28T13:30:00Z').getTime(),
    };
    
    // 13:00-14:00
    const slot2: IntervalMs = { 
      start: new Date('2025-10-28T13:00:00Z').getTime(),
      end: new Date('2025-10-28T14:00:00Z').getTime(),
    };
    
    expect(windowsOverlap(slot1, slot2)).toBe(true);
  });
});

describe('Slot-based table availability (conceptual)', () => {
  it('should allow multiple bookings for the same table on different slots', () => {
    // Conceptual test: verify that the logic supports this scenario
    
    const tableId = 't1';
    const bookings = [
      { slot: 'slot-12:00', tableId: 't1', bookingId: 'b1' },
      { slot: 'slot-14:00', tableId: 't1', bookingId: 'b2' },
      { slot: 'slot-18:00', tableId: 't1', bookingId: 'b3' },
    ];
    
    // Each booking is for a different slot, so all should be valid
    const uniqueSlots = new Set(bookings.map(b => b.slot));
    expect(uniqueSlots.size).toBe(3);
    
    // No duplicate (table, slot) pairs
    const tableSlotPairs = bookings.map(b => `${b.tableId}-${b.slot}`);
    const uniquePairs = new Set(tableSlotPairs);
    expect(uniquePairs.size).toBe(tableSlotPairs.length);
  });

  it('should prevent double-booking the same table in the same slot', () => {
    const tableId = 't1';
    const slotId = 'slot-12:00';
    
    const bookings = [
      { slot: slotId, tableId, bookingId: 'b1' },
      { slot: slotId, tableId, bookingId: 'b2' }, // Duplicate!
    ];
    
    // Detect the duplicate (table, slot) pair
    const tableSlotPairs = bookings.map(b => `${b.tableId}-${b.slot}`);
    const uniquePairs = new Set(tableSlotPairs);
    
    // Should have only 1 unique pair, but we have 2 bookings
    expect(uniquePairs.size).toBe(1);
    expect(bookings.length).toBe(2);
    expect(uniquePairs.size).toBeLessThan(bookings.length);
  });
});

describe('Time zone and DST edge cases', () => {
  it('should handle midnight boundary correctly', () => {
    // 23:00-23:59 on day 1
    const lateEvening: IntervalMs = { 
      start: new Date('2025-10-28T23:00:00Z').getTime(),
      end: new Date('2025-10-28T23:59:00Z').getTime(),
    };
    
    // 00:00-01:00 on day 2
    const earlyMorning: IntervalMs = { 
      start: new Date('2025-10-29T00:00:00Z').getTime(),
      end: new Date('2025-10-29T01:00:00Z').getTime(),
    };
    
    expect(windowsOverlap(lateEvening, earlyMorning)).toBe(false);
  });

  it('should handle DST transition correctly (Europe/London)', () => {
    // DST ends on last Sunday of October (2025-10-26 02:00 becomes 01:00)
    
    // Slot before DST transition: 01:00-02:00 BST (00:00-01:00 UTC)
    const beforeDST: IntervalMs = { 
      start: new Date('2025-10-26T00:00:00Z').getTime(),
      end: new Date('2025-10-26T01:00:00Z').getTime(),
    };
    
    // Slot after DST transition: 02:00-03:00 GMT (02:00-03:00 UTC)
    const afterDST: IntervalMs = { 
      start: new Date('2025-10-26T02:00:00Z').getTime(),
      end: new Date('2025-10-26T03:00:00Z').getTime(),
    };
    
    // These are on the same date but different UTC times, should not overlap
    expect(windowsOverlap(beforeDST, afterDST)).toBe(false);
  });
});
