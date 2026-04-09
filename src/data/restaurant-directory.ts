import type { RestaurantSummary } from '@/lib/restaurants/types';

type DirectoryHighlight = {
  label: string;
  value: string;
};

type RestaurantDirectoryOverride = {
  badge: string;
  locality?: string | null;
  listingSummary: string;
  detailSummary: string;
  categories: string[];
  vibeTags: string[];
  bestFor: string[];
  amenityTags: string[];
  highlights: DirectoryHighlight[];
  story: string[];
  foodHighlights: string[];
  bookingTips: string[];
};

export type RestaurantDirectoryEntry = RestaurantSummary & {
  badge: string;
  locality: string | null;
  listingSummary: string;
  detailSummary: string;
  categories: string[];
  vibeTags: string[];
  bestFor: string[];
  amenityTags: string[];
  highlights: DirectoryHighlight[];
  story: string[];
  foodHighlights: string[];
  bookingTips: string[];
};

const DIRECTORY_OVERRIDES: Record<string, RestaurantDirectoryOverride> = {
  'the-old-crown-girton': {
    badge: 'Landmark village pub',
    locality: 'Girton',
    listingSummary:
      'A thatched Girton landmark pairing Nepalese comfort cooking, cask ale, and a family-friendly garden that works for quick lunches or long Sunday gatherings.',
    detailSummary:
      'The Old Crown combines historic-pub character with a Nepalese-led kitchen, real ale, and a garden-led layout that suits families, groups, and relaxed catch-ups.',
    categories: ['Village pub', 'Nepalese kitchen', 'Real ale', 'Family-friendly'],
    vibeTags: ['Thatched landmark', 'Garden and deck', 'Casual celebrations', 'Local favourite'],
    bestFor: ['Sunny lunches', 'Family roasts', 'Drinks with friends', 'Group catch-ups'],
    amenityTags: ['Outdoor seating', 'Dog friendly', 'Play area', 'Wheelchair access', 'Free parking'],
    highlights: [
      { label: 'Atmosphere', value: 'Historic thatched pub with fireplaces and light-filled dining rooms' },
      { label: 'Food style', value: 'Nepalese signatures alongside British pub classics and grills' },
      { label: 'Drink cue', value: 'Rotating cask ales, lagers, and an easy-drinking pub list' },
      { label: 'Standout', value: 'Large deck and lawn space that stays useful for families and groups' },
    ],
    story: [
      'Girton locals know The Old Crown as a proper village landmark: a big thatched pub where the garden, dining rooms, and bar all feel active without becoming chaotic.',
      'The venue now leans into a Nepalese-led menu while keeping the warmth of a classic pub, so it works equally well for a pint, a curry night, or a family meal with children in tow.',
      'Multiple rooms, play-friendly outdoor space, and quick host contact make it easier to plan casual get-togethers than a typical pub directory listing suggests.',
    ],
    foodHighlights: [
      'Momos, samosa chaat, and Chicken Rum Rum are the clearest menu signatures.',
      'Mixed grills, burgers, and familiar pub comfort dishes keep mixed groups happy.',
      'Vegetarian, vegan, and gluten-aware options make it easier to book for varied dietary needs.',
    ],
    bookingTips: [
      'Best when you want a pub setting with more range than a standard ale-first listing.',
      'Useful for families and larger mixed groups because the garden, parking, and play space reduce arrival friction.',
      'Worth checking direct host details for busy Sunday or event-led services.',
    ],
  },
};

export function enrichRestaurantDirectoryEntry<T extends RestaurantSummary>(restaurant: T): T & RestaurantDirectoryEntry {
  const override = DIRECTORY_OVERRIDES[restaurant.slug] ?? null;
  const locality = override?.locality ?? deriveLocality(restaurant.address);
  const fallback = buildFallbackDirectoryContent(restaurant, locality);

  return {
    ...restaurant,
    locality,
    badge: override?.badge ?? fallback.badge,
    listingSummary: override?.listingSummary ?? fallback.listingSummary,
    detailSummary: override?.detailSummary ?? fallback.detailSummary,
    categories: override?.categories ?? fallback.categories,
    vibeTags: override?.vibeTags ?? fallback.vibeTags,
    bestFor: override?.bestFor ?? fallback.bestFor,
    amenityTags: override?.amenityTags ?? fallback.amenityTags,
    highlights: override?.highlights ?? fallback.highlights,
    story: override?.story ?? fallback.story,
    foodHighlights: override?.foodHighlights ?? fallback.foodHighlights,
    bookingTips: override?.bookingTips ?? fallback.bookingTips,
  };
}

function buildFallbackDirectoryContent(
  restaurant: RestaurantSummary,
  locality: string | null,
): Omit<RestaurantDirectoryEntry, keyof RestaurantSummary | 'locality'> {
  const google = restaurant.googleBusinessProfile ?? null;
  const groupTag = getGroupTag(restaurant.capacity);
  const capacityLine = getCapacityLine(restaurant.capacity);
  const locationLine = locality ? `${locality} dining` : 'Neighbourhood dining';
  const googleRatingLabel =
    typeof google?.rating === 'number' && typeof google?.reviewCount === 'number'
      ? `${google.rating.toFixed(1)} Google rating (${google.reviewCount} reviews)`
      : null;
  const googleCategoryLabels = [
    google?.primaryCategory ?? null,
    ...(google?.additionalCategories ?? []).slice(0, 2),
  ].filter((value): value is string => Boolean(value?.trim()));
  const googleStory = google?.description?.trim() ?? null;
  const openStatusLabel =
    google?.openStatus
      ?.toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') ?? null;
  const hoursLabel = google?.regularHoursSummary?.[0] ?? google?.moreHoursSummary?.[0] ?? null;

  return {
    badge: openStatusLabel ? `${openStatusLabel} on Google` : 'Bookable venue guide',
    listingSummary:
      googleStory ??
      `${restaurant.name} is a ${locationLine.toLowerCase()} option on Nab a Table with clear booking steps, direct contact details, and practical arrival context before you reserve.`,
    detailSummary:
      restaurant.bookingPolicy?.trim() ||
      googleStory ||
      `${restaurant.name} is set up for straightforward online reservations, with live booking access and venue details in one place.`,
    categories: dedupeStrings([
      locationLine,
      groupTag,
      ...googleCategoryLabels,
      restaurant.address ? 'Easy to locate' : null,
      'Online reservations',
    ]),
    vibeTags: dedupeStrings([
      googleRatingLabel,
      openStatusLabel,
      restaurant.address ? 'Map-ready arrival' : null,
      restaurant.contactPhone ? 'Direct host contact' : null,
      restaurant.capacity && restaurant.capacity >= 80 ? 'Works for larger groups' : 'Flexible party sizes',
    ]),
    bestFor: dedupeStrings([
      groupTag === 'Group dining' ? 'Bigger bookings' : 'Weeknight meals',
      restaurant.contactPhone ? 'Quick call-ahead plans' : null,
      restaurant.address ? 'Simple first visits' : null,
      'Online reservations',
    ]),
    amenityTags: dedupeStrings([
      restaurant.contactPhone ? 'Phone support' : null,
      restaurant.contactEmail ? 'Email contact' : null,
      ...(google?.attributeLabels ?? []).slice(0, 3),
      ...(google?.serviceItems ?? []).slice(0, 2),
      restaurant.address ? 'Directions available' : null,
      restaurant.bookingPolicy ? 'Booking notes shown' : 'Instant booking path',
    ]),
    highlights: [
      { label: 'Area', value: locality ?? 'Location shared once available' },
      { label: 'Booking', value: 'Reserve online through Nab a Table' },
      ...(google?.primaryCategory ? [{ label: 'Google category', value: google.primaryCategory }] : []),
      ...(googleRatingLabel ? [{ label: 'Google reviews', value: googleRatingLabel }] : []),
      ...(hoursLabel ? [{ label: 'Opening hours', value: hoursLabel }] : []),
      { label: 'Group fit', value: capacityLine },
      {
        label: 'Contact',
        value: restaurant.contactPhone ?? restaurant.contactEmail ?? 'Direct contact details available where provided',
      },
    ],
    story: [
      googleStory ??
        `${restaurant.name} is presented here as a practical venue guide first: where it is, how to book it, and whether it suits the kind of visit you are planning.`,
      'Even when a venue does not yet have a fully curated editorial profile, the directory should still help diners compare arrival ease, contact clarity, and group fit.',
      ...(google?.reviewSnippets[0]?.comment
        ? [`Recent guest signal: "${google.reviewSnippets[0].comment}"`]
        : []),
    ],
    foodHighlights: dedupeStrings([
      'Live booking path connected directly to the venue page.',
      ...(google?.primaryCategory ? [`Google categorises the venue as ${google.primaryCategory}.`] : []),
      restaurant.bookingPolicy?.trim()
        ? `Booking note: ${restaurant.bookingPolicy.trim()}`
        : 'Use the booking flow to confirm party size and preferred time quickly.',
      hoursLabel ? `Google hours snapshot: ${hoursLabel}.` : null,
      restaurant.address
        ? 'Address is shown clearly so first-time guests can compare venues without switching tabs.'
        : 'Contact details are kept close to the booking action to reduce guesswork.',
    ]),
    bookingTips: dedupeStrings([
      'Use this page to compare venue fit before opening the booking flow.',
      google?.mapsUri ? 'Google Maps directions are available for a quicker first visit.' : null,
      restaurant.contactPhone ? 'Call ahead if you need a quick answer on timing or access.' : null,
      restaurant.bookingPolicy ? 'Read the venue booking notes before confirming.' : null,
    ]),
  };
}

function deriveLocality(address?: string | null): string | null {
  if (!address) {
    return null;
  }

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[1];
  }

  return null;
}

function getGroupTag(capacity?: number | null): string {
  if (!capacity || !Number.isFinite(capacity)) {
    return 'Flexible dining';
  }

  if (capacity >= 90) {
    return 'Group dining';
  }

  if (capacity >= 50) {
    return 'Shared occasions';
  }

  return 'Smaller gatherings';
}

function getCapacityLine(capacity?: number | null): string {
  if (!capacity || !Number.isFinite(capacity)) {
    return 'Works for a range of party sizes';
  }

  if (capacity >= 90) {
    return `Can handle larger services with capacity for around ${capacity} guests`;
  }

  if (capacity >= 50) {
    return `Comfortable for everyday dining and group bookings up to ${capacity} guests`;
  }

  return `Best suited to smaller services and bookings up to ${capacity} guests`;
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}
