
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';
import { listRestaurants } from '@/server/restaurants/listRestaurants';
import BookingPage from '@src/app/(public)/(marketing)/restaurants/[slug]/book/page';
import RestaurantPage from '@src/app/(public)/(marketing)/restaurants/[slug]/page';
import RestaurantsPage from '@src/app/(public)/(marketing)/restaurants/page';

import type { ComponentProps, ReactNode } from 'react';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: ComponentProps<'img'>) => <img alt={props.alt ?? ''} {...props} />,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/server/restaurants/listRestaurants', () => ({ listRestaurants: vi.fn() }));
vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({ getRestaurantBySlug: vi.fn() }));
vi.mock('@/components/features/booking/wizard/ReservationWizardClient', () => ({
  ReservationWizardClient: ({ restaurant }: { restaurant?: { name?: string } }) => (
    <div>Wizard for {restaurant?.name}</div>
  ),
}));

const listRestaurantsMock = vi.mocked(listRestaurants);
const getRestaurantBySlugMock = vi.mocked(getRestaurantBySlug);

describe('public restaurant marketing pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders restaurant list and hero content', async () => {
    listRestaurantsMock.mockResolvedValueOnce([
      {
        id: 'rest-1',
        slug: 'the-fox',
        name: 'The Fox',
        timezone: 'Europe/London',
        address: '1 High Street',
        logoUrl: null,
        capacity: 80,
      },
      {
        id: 'rest-2',
        slug: 'the-owl',
        name: 'The Owl',
        timezone: 'Europe/London',
        address: '2 High Street',
        logoUrl: null,
        capacity: 40,
      },
    ]);

    render(await RestaurantsPage());

    expect(
      screen.getByRole('heading', { name: 'Find the right restaurant, not just the next available slot.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The Fox')).toBeInTheDocument();
    expect(screen.getByText('The Owl')).toBeInTheDocument();
    expect(screen.getByText('Compare venues with more context')).toBeInTheDocument();
  });

  it('shows empty state when no restaurants are available', async () => {
    listRestaurantsMock.mockResolvedValueOnce([]);

    render(await RestaurantsPage());

    expect(screen.getByText('No restaurants match those filters yet')).toBeInTheDocument();
  });

  it('renders restaurant detail hero and contact info', async () => {
    getRestaurantBySlugMock.mockResolvedValueOnce({
      id: 'rest-1',
      slug: 'the-fox',
      name: 'The Fox',
      timezone: 'Europe/London',
      address: '1 High Street',
      contactEmail: 'hello@thefox.test',
      contactPhone: '+44 1234 567890',
      logoUrl: null,
    });

    render(await RestaurantPage({ params: Promise.resolve({ slug: 'the-fox' }) }));

    expect(screen.getByRole('heading', { name: 'The Fox' })).toBeInTheDocument();
    expect(screen.getAllByText('+44 1234 567890')).not.toHaveLength(0);
    expect(screen.getByText('Why diners pick The Fox')).toBeInTheDocument();
  });

  it('renders curated directory content for The Old Crown Girton', async () => {
    getRestaurantBySlugMock.mockResolvedValueOnce({
      id: 'rest-3',
      slug: 'the-old-crown-girton',
      name: 'The Old Crown Girton',
      timezone: 'Europe/London',
      address: '89 High St, Girton, Cambridge CB3 0QD',
      contactEmail: 'oldcrown@lapeninns.com',
      contactPhone: '01223 277217',
      googleMapUrl: 'https://maps.example.com/old-crown',
      googleReviewUrl: 'https://reviews.example.com/old-crown',
      logoUrl: null,
      capacity: 140,
      bookingPolicy: 'Please call ahead for large garden groups.',
    });

    render(await RestaurantPage({ params: Promise.resolve({ slug: 'the-old-crown-girton' }) }));

    expect(screen.getByText('Landmark village pub')).toBeInTheDocument();
    expect(screen.getAllByText('Nepalese kitchen')).not.toHaveLength(0);
    expect(screen.getByText('What stands out on the table')).toBeInTheDocument();
  });

  it('returns notFound when restaurant detail is missing', async () => {
    getRestaurantBySlugMock.mockResolvedValueOnce(null);

    await expect(
      RestaurantPage({ params: Promise.resolve({ slug: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('renders booking wizard wrapper for a restaurant', async () => {
    getRestaurantBySlugMock.mockResolvedValueOnce({
      id: 'rest-1',
      slug: 'the-fox',
      name: 'The Fox',
      timezone: 'Europe/London',
      address: '1 High Street',
    });

    render(await BookingPage({ params: Promise.resolve({ slug: 'the-fox' }) }));

    expect(screen.getByText('Wizard for The Fox')).toBeInTheDocument();
  });

  it('returns notFound when booking restaurant is missing', async () => {
    getRestaurantBySlugMock.mockResolvedValueOnce(null);

    await expect(
      BookingPage({ params: Promise.resolve({ slug: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
