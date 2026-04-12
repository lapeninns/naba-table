import { BookingEntryPage } from '@/components/features/booking/ui/BookingEntryPage';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bookings · Nab a Table',
  description: 'Browse restaurants to book a table, or sign in to manage your bookings.',
};

export default function BookingsLandingPage() {
  return <BookingEntryPage />;
}
