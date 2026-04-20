import { redirect } from "next/navigation";

type Params = Promise<{ slug: string }>;

/**
 * Redirect /restaurants/[slug]/thank-you to /restaurants/[slug]/book/thank-you
 * This consolidates the thank-you paths to a single canonical location.
 */
export default async function RestaurantThankYouRedirect({ params }: { params: Params }) {
  const { slug } = await params;
  redirect(`/restaurants/${encodeURIComponent(slug)}/book/thank-you`);
}
