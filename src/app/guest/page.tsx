import { permanentRedirect } from "next/navigation";

export default function GuestDashboardRedirect() {
  permanentRedirect("/guest/bookings");
}
