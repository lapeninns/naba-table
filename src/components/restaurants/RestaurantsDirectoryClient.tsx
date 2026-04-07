'use client';

import { Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import { RestaurantsGridSection } from '@/components/restaurants/PublicSections';
import { Input } from '@/components/ui/input';

import type { RestaurantDirectoryEntry } from '@src/data/restaurant-directory';

type RestaurantsDirectoryClientProps = {
  restaurants: RestaurantDirectoryEntry[];
};

export function RestaurantsDirectoryClient({ restaurants }: RestaurantsDirectoryClientProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const deferredSearch = useDeferredValue(search);

  const directoryCategories = restaurants.flatMap((restaurant) => restaurant.categories);
  const categories = ['All', ...new Set(directoryCategories)].slice(0, 9);

  const normalizedSearch = deferredSearch.trim().toLowerCase();

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      [
        restaurant.name,
        restaurant.address,
        restaurant.locality,
        restaurant.listingSummary,
        ...restaurant.categories,
        ...restaurant.vibeTags,
        ...restaurant.bestFor,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch));

    const matchesCategory =
      activeCategory === 'All' || restaurant.categories.includes(activeCategory);

    return matchesSearch && matchesCategory;
  });

  return (
    <section className="px-4 pb-6 sm:px-6" aria-labelledby="directory-controls-heading">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-[var(--guest-radius-xl)] border border-slate-200 bg-white/90 p-4 shadow-[var(--guest-shadow-sm)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p id="directory-controls-heading" className="text-sm font-medium text-blue-700">
                Directory controls
              </p>
              <h2 className="guest-heading-page text-[length:var(--guest-text-page)] font-semibold text-slate-900">
                Browse by atmosphere, fit, and booking context
              </h2>
              <p className="max-w-2xl text-sm text-slate-600">
                Search the cues diners actually use to choose a venue: locality, vibe, group fit,
                and whether a place feels right for the kind of meal you are planning.
              </p>
            </div>
            <div className="w-full max-w-md">
              <label className="sr-only" htmlFor="restaurant-directory-search">
                Search the restaurant directory
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  id="restaurant-directory-search"
                  name="restaurant-directory-search"
                  type="search"
                  placeholder="Search by place, cuisine, vibe, or use case"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 rounded-[var(--guest-radius-lg)] border-slate-200 bg-slate-50 pl-11"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Directory categories">
            {categories.map((category) => {
              const isActive = activeCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveCategory(category)}
                  className={[
                    'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700',
                  ].join(' ')}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        <RestaurantsGridSection restaurants={filteredRestaurants} />
      </div>
    </section>
  );
}
