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
    googleBusinessProfile: {
      title: 'The Old Crown Girton',
      description:
        'Historic thatched village pub with Nepalese favourites, a large family garden, and all-day hospitality from lunch through relaxed evening drinks.',
      primaryCategory: 'Pub',
      additionalCategories: ['Nepalese restaurant', 'Beer garden'],
      addressText: '89 High St, Girton, Cambridge CB3 0QD',
      locality: 'Girton',
      regionCode: 'GB',
      postalCode: 'CB3 0QD',
      primaryPhone: '01223 277217',
      additionalPhones: [],
      websiteUri: 'https://www.oldcrowngirton.example',
      mapsUri: 'https://maps.google.com/?cid=old-crown-girton',
      reviewUri: 'https://g.page/r/old-crown-girton/review',
      regularHoursSummary: [
        'MONDAY 12:00 - MONDAY 22:00',
        'TUESDAY 12:00 - TUESDAY 22:00',
        'WEDNESDAY 12:00 - WEDNESDAY 22:00',
      ],
      specialHoursSummary: [],
      attributeLabels: ['Outdoor seating: Yes', 'Dog friendly', 'Wheelchair accessible entrance'],
      rating: 4.5,
      reviewCount: 412,
      reviewSnippets: [
        {
          reviewId: 'old-crown-review-1',
          starRating: 'FIVE',
          comment: 'Fantastic garden for families, and the momo starter is worth the trip on its own.',
          reviewerDisplayName: 'Alex P',
          createTime: '2026-03-22T18:12:00Z',
          updateTime: '2026-03-22T18:12:00Z',
        },
      ],
      media: [
        {
          name: 'media/old-crown-front',
          category: 'EXTERIOR',
          format: 'PHOTO',
          sourceUrl: null,
          googleUrl: 'https://lh3.googleusercontent.com/old-crown-front',
          thumbnailUrl: 'https://lh3.googleusercontent.com/old-crown-front-thumb',
          description: 'Front garden and pub exterior',
        },
      ],
      metrics30d: [
        {
          metric: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
          total: 1840,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
        },
      ],
    },
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
    googleBusinessProfile: {
      title: 'River House Cambridge',
      description:
        'Riverside dining spot for easy city-centre meetups, with a compact dining room and a clear online booking path.',
      primaryCategory: 'Restaurant',
      additionalCategories: ['Riverside dining'],
      addressText: 'Bridge Street, Cambridge CB2 1UF',
      locality: 'Cambridge',
      regionCode: 'GB',
      postalCode: 'CB2 1UF',
      primaryPhone: '01223 000111',
      additionalPhones: [],
      websiteUri: 'https://www.riverhouse.example',
      mapsUri: 'https://maps.google.com/?cid=river-house-cambridge',
      reviewUri: 'https://g.page/r/river-house-cambridge/review',
      regularHoursSummary: ['FRIDAY 12:00 - FRIDAY 22:30'],
      specialHoursSummary: [],
      attributeLabels: ['Serves cocktails', 'Reservable'],
      rating: 4.2,
      reviewCount: 126,
      reviewSnippets: [],
      media: [],
      metrics30d: [],
    },
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
