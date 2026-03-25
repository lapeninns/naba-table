import {
  generateMetadata as bookingPageGenerateMetadata,
  GuestBookingDetailPage,
} from '../../../(public)/bookings/booking-page';

export const dynamic = "force-dynamic";
export const generateMetadata = bookingPageGenerateMetadata;

export default function GuestBookingDetailRoute(
  props: Parameters<typeof GuestBookingDetailPage>[0],
) {
  return <GuestBookingDetailPage {...props} />;
}
