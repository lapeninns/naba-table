import {
    RestaurantsHeroSection,
} from '@/components/restaurants/PublicSections';
import { RestaurantsDirectoryClient } from '@/components/restaurants/RestaurantsDirectoryClient';
import { listRestaurants } from '@/server/restaurants/listRestaurants';
import { enrichRestaurantDirectoryEntry } from '@src/data/restaurant-directory';

export const dynamic = 'force-dynamic';

export default async function RestaurantsPage() {
    const restaurants = await listRestaurants();
    const directoryRestaurants = restaurants.map((restaurant) =>
        enrichRestaurantDirectoryEntry(restaurant),
    );

    return (
        <>
            <RestaurantsHeroSection restaurants={directoryRestaurants} />
            <RestaurantsDirectoryClient restaurants={directoryRestaurants} />
        </>
    );
}
