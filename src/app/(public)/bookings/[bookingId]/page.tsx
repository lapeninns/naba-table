import {
  BookingDetailPage,
  generateMetadata as bookingPageGenerateMetadata,
} from '../booking-page';

export const dynamic = 'force-dynamic';
export const generateMetadata = bookingPageGenerateMetadata;

export default function PublicBookingDetailPage(props: Parameters<typeof BookingDetailPage>[0]) {
  return <BookingDetailPage {...props} pathPrefix="/bookings" />;
}
