import {
  RestaurantsGridSection,
  RestaurantsHeroSection,
} from '@/components/restaurants/PublicSections';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

export const dynamic = 'force-dynamic';

type RestaurantsPageProps = {
  searchParams?: Promise<{
    fixture?: string;
  }>;
};

export default async function RestaurantsPage({ searchParams }: RestaurantsPageProps = {}) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const restaurants = await listRestaurants({
      fixture: resolvedSearchParams?.fixture,
    });

    return (
        <>
            <RestaurantsHeroSection totalRestaurants={restaurants.length} />
            <RestaurantsGridSection restaurants={restaurants} />
        </>
    );
}
