import { permanentRedirect } from "next/navigation";

export const revalidate = 0;

export default function RestaurantPartnersPage() {
  permanentRedirect("/");
}
