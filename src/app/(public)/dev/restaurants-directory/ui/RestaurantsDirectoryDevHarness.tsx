import {
  RestaurantDetailHero,
  RestaurantDetailsSection,
  RestaurantsHeroSection,
} from '@/components/restaurants/PublicSections';
import { RestaurantsDirectoryClient } from '@/components/restaurants/RestaurantsDirectoryClient';
import { enrichRestaurantDirectoryEntry } from '@src/data/restaurant-directory';

const MOCK_RESTAURANTS = [
  enrichRestaurantDirectoryEntry({
    id: 'dev-old-crown',
    slug: 'the-old-crown-girton',
    name: 'The Old Crown Girton',
    timezone: 'Europe/London',
    address: '89 High St, Girton, Cambridge CB3 0QD',
    contactEmail: 'oldcrown@lapeninns.com',
    contactPhone: '01223 277217',
    googleMapUrl: 'https://maps.google.com/?q=89+High+St+Girton+Cambridge+CB3+0QD',
    googleReviewUrl: 'https://www.google.com/search?q=The+Old+Crown+Girton+reviews',
    capacity: 140,
    logoUrl: null,
    bookingPolicy: 'Please call ahead for large garden groups or event-led Sundays.',
  }),
  enrichRestaurantDirectoryEntry({
    id: 'dev-river-house',
    slug: 'river-house-cambridge',
    name: 'River House Cambridge',
    timezone: 'Europe/London',
    address: 'Bridge Street, Cambridge CB2 1UF',
    contactEmail: 'hello@riverhouse.test',
    contactPhone: '01223 000111',
    googleMapUrl: 'https://maps.google.com/?q=Bridge+Street+Cambridge+CB2+1UF',
    capacity: 68,
    logoUrl: null,
    bookingPolicy: 'Online bookings remain the fastest route for standard dining times.',
  }),
];

const FEATURED_RESTAURANT = MOCK_RESTAURANTS[0];

export function RestaurantsDirectoryDevHarness() {
  return (
    <main className="guest-theme bg-muted pb-20">
      <RestaurantsHeroSection restaurants={MOCK_RESTAURANTS} />
      <RestaurantsDirectoryClient restaurants={MOCK_RESTAURANTS} />

      <section className="px-4 pt-8 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-[var(--guest-radius-xl)] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Featured detail surface for browser verification
        </div>
      </section>

      <div className="pt-6">
        <RestaurantDetailHero restaurant={FEATURED_RESTAURANT} />
        <RestaurantDetailsSection restaurant={FEATURED_RESTAURANT} />
      </div>
    </main>
  );
}
