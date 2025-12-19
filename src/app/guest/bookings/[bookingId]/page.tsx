import { generateMetadata as bookingPageGenerateMetadata, BookingDetailPage } from "../../../(public)/bookings/booking-page";

export const dynamic = "force-dynamic";
export const generateMetadata = bookingPageGenerateMetadata;

export default function GuestBookingDetailPage(props: Parameters<typeof BookingDetailPage>[0]) {
  return <BookingDetailPage {...props} pathPrefix="/guest/bookings" />;
}
