import {
  BookingDetailPage,
  generateMetadata as bookingPageGenerateMetadata,
  type RouteParams,
  type SearchParams,
} from "../../../(public)/bookings/booking-page";

export const dynamic = "force-dynamic";
export const generateMetadata = bookingPageGenerateMetadata;

export default function GuestBookingDetailPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  return <BookingDetailPage params={params} searchParams={searchParams} pathPrefix="/guest/bookings" />;
}
