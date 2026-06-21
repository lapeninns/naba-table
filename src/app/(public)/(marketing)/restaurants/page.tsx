import {
  RestaurantsGridSection,
  RestaurantsHeroSection,
} from '@/components/restaurants/PublicSections';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

type SearchParams = Promise<{ q?: string | string[] }>;

function normalizeQuery(value?: string | string[]) {
  return Array.isArray(value) ? (value[0]?.trim() ?? '') : (value?.trim() ?? '');
}

export default async function RestaurantsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const searchQuery = normalizeQuery(params.q);
  const restaurants = await listRestaurants(searchQuery ? { search: searchQuery } : {});

  return (
    <main className="guest-theme pg-page">
      <RestaurantsHeroSection totalRestaurants={restaurants.length} searchQuery={searchQuery} />
      <RestaurantsGridSection restaurants={restaurants} searchQuery={searchQuery} />
    </main>
  );
}
