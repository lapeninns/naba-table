import { redirect } from 'next/navigation';

import { getRetiredRestaurantSettingsTarget } from '@/components/features/restaurant-settings/routes';

/** Retired URL: see RESTAURANT_SETTINGS_RETIRED_ROUTES. */
export default function LegacyOccasionsPage() {
  redirect(getRetiredRestaurantSettingsTarget('/app/settings/restaurant/occasions'));
}
