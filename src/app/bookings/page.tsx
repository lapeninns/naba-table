import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BookingsIndexRedirect() {
  permanentRedirect("/guest/account/bookings");
}

