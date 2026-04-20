import { ReservationThankYouCard } from '@/components/restaurants/PublicSections';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reservation Confirmed · Nab a Table',
  description: 'Your table has been reserved.',
};

export default function ReservationThankYouPage() {
  return <ReservationThankYouCard />;
}
