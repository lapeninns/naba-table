import {
    RestaurantsGridSection,
    RestaurantsHeroSection,
} from '@/components/restaurants/PublicSections';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

export const dynamic = 'force-dynamic';

export default async function RestaurantsPage() {
    const restaurants = await listRestaurants();

    return (
        <div className="guest-theme bg-slate-50/80">
            <RestaurantsHeroSection totalRestaurants={restaurants.length} />
            <RestaurantsGridSection restaurants={restaurants} />
        </div>
    );
}
