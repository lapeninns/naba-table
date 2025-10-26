import { getInitialDetails, getInitialState } from '@features/reservations/wizard/model/reducer';

import type { Reservation } from '@entities/reservation/reservation.schema';
import type {
  ApiBooking,
  BookingDetails,
  State,
} from '@features/reservations/wizard/model/reducer';

export const wizardDetailsFixture = (overrides: Partial<BookingDetails> = {}): BookingDetails =>
  getInitialDetails(overrides);

export const wizardStateFixture = (overrides: Partial<BookingDetails> = {}): State =>
  getInitialState(overrides);

export const apiBookingFixture = (overrides: Partial<ApiBooking> = {}): ApiBooking => ({
  id: 'booking-123',
  restaurant_id: 'rest-1111-2222-3333-4444',
  customer_id: 'cust-123',
  booking_date: '2025-05-10',
  start_time: '18:00',
  end_time: '19:30',
  reference: 'SRX-ABC123',
  party_size: 2,
  booking_type: 'dinner',
  seating_preference: 'indoor',
  status: 'confirmed',
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '+441234567890',
  notes: null,
  source: 'app',
  marketing_opt_in: true,
  loyalty_points_awarded: 0,
  created_at: '2025-05-10T08:00:00Z',
  updated_at: '2025-05-10T08:10:00Z',
  ...overrides,
});

export const reservationFixture = (overrides: Partial<Reservation> = {}): Reservation => ({
  id: 'resv-1234567890abcdef1234567890abcdef',
  restaurantId: 'rest-1111-2222-3333-4444',
  restaurantName: 'Sajilo Kitchen',
  bookingDate: '2025-05-10',
  startTime: '18:00',
  endTime: '19:30',
  startAt: '2025-05-10T18:00:00Z',
  endAt: '2025-05-10T19:30:00Z',
  partySize: 2,
  bookingType: 'dinner',
  seatingPreference: 'indoor',
  status: 'confirmed',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  customerPhone: '+441234567890',
  marketingOptIn: true,
  notes: null,
  reference: 'SRX-RESV123',
  clientRequestId: null,
  idempotencyKey: null,
  pendingRef: null,
  metadata: null,
  createdAt: '2025-05-10T09:00:00Z',
  updatedAt: '2025-05-10T09:10:00Z',
  ...overrides,
});
