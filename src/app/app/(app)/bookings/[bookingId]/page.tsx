import { redirect } from 'next/navigation';

import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';

export default async function OpsBookingDetailRedirect({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const target = `/bookings?focus=${encodeURIComponent(bookingId)}`;
  redirect(withRedirectedFrom(target, target));
}
