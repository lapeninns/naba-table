import type { MetadataRoute } from 'next';

export type GuestFacingPageCategoryId = 'discover' | 'book' | 'account' | 'support';
export type GuestFacingPageAccess =
  | 'public'
  | 'public with optional sign-in'
  | 'recovery link or sign-in'
  | 'signed-in guest';
export type GuestFacingPageRouteType = 'page' | 'pattern' | 'alias' | 'redirect';
export type GuestFacingPageSeo = 'indexed' | 'pattern-indexed' | 'excluded';

export type GuestFacingPageCategory = {
  id: GuestFacingPageCategoryId;
  title: string;
  description: string;
};

export type GuestFacingPage = {
  title: string;
  href: string;
  description: string;
  categoryId: GuestFacingPageCategoryId;
  access: GuestFacingPageAccess;
  routeType: GuestFacingPageRouteType;
  seo: GuestFacingPageSeo;
  note?: string;
  sitemap?: {
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
    priority: number;
  };
};

export const guestFacingPageCategories: GuestFacingPageCategory[] = [
  {
    id: 'discover',
    title: 'Discovery',
    description: 'Public pages guests use to learn about Nab a Table and browse restaurants.',
  },
  {
    id: 'book',
    title: 'Booking journey',
    description: 'Routes that help guests create, confirm, review, or recover bookings.',
  },
  {
    id: 'account',
    title: 'Guest account',
    description: 'Sign-in and self-service pages used after a guest starts managing bookings.',
  },
  {
    id: 'support',
    title: 'Support and trust',
    description: 'Reference pages that help guests orient themselves and trust the platform.',
  },
];

export const guestFacingPages: GuestFacingPage[] = [
  {
    title: 'Home',
    href: '/',
    description:
      'Marketing landing page that introduces the product and funnels guests into booking.',
    categoryId: 'discover',
    access: 'public',
    routeType: 'page',
    seo: 'indexed',
    sitemap: { changeFrequency: 'weekly', priority: 1 },
  },
  {
    title: 'Restaurant directory',
    href: '/restaurants',
    description: 'Public restaurant listing used to start discovery and booking.',
    categoryId: 'discover',
    access: 'public',
    routeType: 'page',
    seo: 'indexed',
    sitemap: { changeFrequency: 'weekly', priority: 0.9 },
  },
  {
    title: 'Restaurant detail',
    href: '/restaurants/[slug]',
    description: 'Per-restaurant landing page with venue details before the booking flow starts.',
    categoryId: 'discover',
    access: 'public',
    routeType: 'pattern',
    seo: 'pattern-indexed',
    note: 'Concrete restaurant slugs should be crawlable, but the placeholder pattern itself is not emitted in the XML sitemap.',
  },
  {
    title: 'Bookings hub',
    href: '/bookings',
    description: 'Entry page for booking a new table or jumping into guest self-service.',
    categoryId: 'book',
    access: 'public',
    routeType: 'page',
    seo: 'indexed',
    sitemap: { changeFrequency: 'monthly', priority: 0.7 },
  },
  {
    title: 'Restaurant booking flow',
    href: '/restaurants/[slug]/book',
    description: 'Live-availability reservation flow for a chosen restaurant.',
    categoryId: 'book',
    access: 'public',
    routeType: 'pattern',
    seo: 'excluded',
  },
  {
    title: 'Restaurant booking thank-you',
    href: '/restaurants/[slug]/book/thank-you',
    description: 'Post-booking confirmation screen shown after a successful reservation.',
    categoryId: 'book',
    access: 'public',
    routeType: 'pattern',
    seo: 'excluded',
  },
  {
    title: 'Restaurant thank-you legacy route',
    href: '/restaurants/[slug]/thank-you',
    description: 'Legacy route that permanently redirects to the canonical booking thank-you page.',
    categoryId: 'book',
    access: 'public',
    routeType: 'redirect',
    seo: 'excluded',
  },
  {
    title: 'Public booking detail',
    href: '/bookings/[bookingId]',
    description: 'Booking detail view for guests arriving via sign-in or a valid recovery path.',
    categoryId: 'book',
    access: 'recovery link or sign-in',
    routeType: 'pattern',
    seo: 'excluded',
  },
  {
    title: 'Public manage alias',
    href: '/bookings/[bookingId]/manage',
    description: 'Legacy helper route that redirects to the canonical public booking detail page.',
    categoryId: 'book',
    access: 'recovery link or sign-in',
    routeType: 'redirect',
    seo: 'excluded',
  },
  {
    title: 'Public thank-you alias',
    href: '/bookings/[bookingId]/thank-you',
    description: 'Legacy thank-you route that redirects to the canonical guest receipt page.',
    categoryId: 'book',
    access: 'recovery link or sign-in',
    routeType: 'redirect',
    seo: 'excluded',
  },
  {
    title: 'Booking recovery error',
    href: '/bookings/recover/error',
    description: 'Explains why a recovery link cannot be used and how a guest can recover access.',
    categoryId: 'book',
    access: 'public',
    routeType: 'page',
    seo: 'excluded',
  },
  {
    title: 'Role selection',
    href: '/auth',
    description: 'Guest or operator entry point used before sign-in.',
    categoryId: 'account',
    access: 'public',
    routeType: 'page',
    seo: 'excluded',
  },
  {
    title: 'Guest sign-in',
    href: '/auth/signin',
    description: 'Primary guest authentication page with redirected return-path support.',
    categoryId: 'account',
    access: 'public',
    routeType: 'page',
    seo: 'excluded',
  },
  {
    title: 'Guest sign-up',
    href: '/auth/signup',
    description: 'Guest account creation page.',
    categoryId: 'account',
    access: 'public',
    routeType: 'page',
    seo: 'excluded',
  },
  {
    title: 'Guest portal entry',
    href: '/guest',
    description: 'Alias route that resolves to the guest dashboard content.',
    categoryId: 'account',
    access: 'signed-in guest',
    routeType: 'alias',
    seo: 'excluded',
  },
  {
    title: 'Guest dashboard',
    href: '/guest/dashboard',
    description: 'Primary signed-in dashboard for upcoming reservations and guest context.',
    categoryId: 'account',
    access: 'signed-in guest',
    routeType: 'page',
    seo: 'excluded',
  },
  {
    title: 'Guest bookings',
    href: '/guest/bookings',
    description: 'Signed-in list view of upcoming and past reservations.',
    categoryId: 'account',
    access: 'signed-in guest',
    routeType: 'page',
    seo: 'excluded',
  },
  {
    title: 'Guest booking detail',
    href: '/guest/bookings/[bookingId]',
    description: 'Signed-in booking detail page inside the guest portal.',
    categoryId: 'account',
    access: 'signed-in guest',
    routeType: 'pattern',
    seo: 'excluded',
  },
  {
    title: 'Guest booking receipt',
    href: '/guest/bookings/[bookingId]/receipt',
    description: 'Receipt-style confirmation page for a specific guest booking.',
    categoryId: 'account',
    access: 'signed-in guest',
    routeType: 'pattern',
    seo: 'excluded',
  },
  {
    title: 'Guest profile',
    href: '/guest/profile',
    description: 'Signed-in profile management page for personal and dining details.',
    categoryId: 'account',
    access: 'signed-in guest',
    routeType: 'page',
    seo: 'excluded',
  },
  {
    title: 'Guest thank-you legacy route',
    href: '/guest/thank-you',
    description: 'Deprecated helper route that redirects guests back to the dashboard.',
    categoryId: 'account',
    access: 'signed-in guest',
    routeType: 'redirect',
    seo: 'excluded',
  },
  {
    title: 'Contact',
    href: '/contact',
    description: 'Public contact page for sales and rollout questions.',
    categoryId: 'support',
    access: 'public',
    routeType: 'page',
    seo: 'indexed',
    sitemap: { changeFrequency: 'yearly', priority: 0.5 },
  },
  {
    title: 'Privacy policy',
    href: '/privacy',
    description: 'Explains how guest and booking data are collected, used, and protected.',
    categoryId: 'support',
    access: 'public',
    routeType: 'page',
    seo: 'indexed',
    sitemap: { changeFrequency: 'yearly', priority: 0.4 },
  },
  {
    title: 'Guest page directory',
    href: '/site-map',
    description: 'Human-readable directory of the guest-facing surface area.',
    categoryId: 'support',
    access: 'public',
    routeType: 'page',
    seo: 'indexed',
    sitemap: { changeFrequency: 'monthly', priority: 0.4 },
  },
];

export const guestFacingPagesByCategory = guestFacingPageCategories.map((category) => ({
  ...category,
  pages: guestFacingPages.filter((page) => page.categoryId === category.id),
}));

export const guestFacingPageSummary = {
  total: guestFacingPages.length,
  primaryPages: guestFacingPages.filter((page) => page.routeType === 'page').length,
  indexedStaticPages: guestFacingPages.filter((page) => page.seo === 'indexed').length,
  signedInGuestPages: guestFacingPages.filter((page) => page.access === 'signed-in guest').length,
};

export const guestFacingSitemapEntries = guestFacingPages
  .filter((page) => page.seo === 'indexed' && page.sitemap)
  .map((page) => ({
    href: page.href,
    changeFrequency: page.sitemap!.changeFrequency,
    priority: page.sitemap!.priority,
  }));
