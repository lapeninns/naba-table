
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
  default: (props: ComponentProps<'img'>) => <img {...props} />,
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
        address: '1 High Street',
        logoUrl: null,
        capacity: 80,
      },
      {
        id: 'rest-2',
        slug: 'the-owl',
        name: 'The Owl',
        address: '2 High Street',
        logoUrl: null,
        capacity: 40,
      },
    ]);

    render(await RestaurantsPage());

    expect(screen.getByRole('heading', { name: 'Find the right table fast.' })).toBeInTheDocument();
    expect(screen.getByText('The Fox')).toBeInTheDocument();
    expect(screen.getByText('The Owl')).toBeInTheDocument();
  });

  it('shows empty state when no restaurants are available', async () => {
    listRestaurantsMock.mockResolvedValueOnce([]);

    render(await RestaurantsPage());

    expect(screen.getByText('No restaurants found')).toBeInTheDocument();
  });

  it('renders restaurant detail hero and contact info', async () => {
    getRestaurantBySlugMock.mockResolvedValueOnce({
      id: 'rest-1',
      slug: 'the-fox',
      name: 'The Fox',
      address: '1 High Street',
      contactEmail: 'hello@thefox.test',
      contactPhone: '+44 1234 567890',
      logoUrl: null,
    });

    render(await RestaurantPage({ params: Promise.resolve({ slug: 'the-fox' }) }));

    expect(screen.getByRole('heading', { name: 'The Fox' })).toBeInTheDocument();
    expect(screen.getByText('+44 1234 567890')).toBeInTheDocument();
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
