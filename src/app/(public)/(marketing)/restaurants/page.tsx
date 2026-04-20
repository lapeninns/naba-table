import {
    RestaurantsGridSection,
    RestaurantsHeroSection,
} from '@/components/restaurants/PublicSections';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

export default async function RestaurantsPage() {
    const restaurants = await listRestaurants();

    return (
        <>
            <RestaurantsHeroSection totalRestaurants={restaurants.length} />
            <RestaurantsGridSection restaurants={restaurants} />
        </>
    );
}
