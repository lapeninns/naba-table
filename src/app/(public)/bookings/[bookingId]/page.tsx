import { generateMetadata as bookingPageGenerateMetadata, BookingDetailPage } from "../booking-page";

export const dynamic = "force-dynamic";
export const generateMetadata = bookingPageGenerateMetadata;

export default function BookingDetailPageRoute(props: Parameters<typeof BookingDetailPage>[0]) {
  return <BookingDetailPage {...props} pathPrefix="/bookings" />;
}
