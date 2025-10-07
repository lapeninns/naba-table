import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { RestaurantBrowser } from '@/components/marketing/RestaurantBrowser';

import type { AnalyticsEvent } from '@/lib/analytics';
import type { RestaurantSummary } from '@/lib/restaurants/types';

afterEach(() => {
  cleanup();
});

const sampleRestaurants: RestaurantSummary[] = [
  {
    id: 'rest-1',
    name: 'The Ivy London',
    slug: 'the-ivy-london',
    timezone: 'Europe/London',
    capacity: 120,
  },
  {
    id: 'rest-2',
    name: 'Tokyo Diner',
    slug: 'tokyo-diner',
    timezone: 'Asia/Tokyo',
    capacity: 42,
  },
];

function renderBrowser() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });

  const analytics: Array<{ name: AnalyticsEvent; props?: Record<string, unknown> }> = [];

  const fetchRestaurants = async () => sampleRestaurants;

  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>
      <RestaurantBrowser
        initialRestaurants={sampleRestaurants}
        fetchRestaurants={fetchRestaurants}
        analytics={(name, props) => analytics.push({ name, props })}
      />
    </QueryClientProvider>,
  );

  return { analytics, user, queryClient };
}

describe('<RestaurantBrowser />', () => {
  it('filters restaurants by search term', async () => {
    const { user, queryClient } = renderBrowser();

    const searchInput = screen.getByPlaceholderText('Search restaurants…');
    await user.clear(searchInput);
    await user.type(searchInput, 'ivy');

    await waitFor(() => {
      expect(screen.getByText('The Ivy London')).toBeInTheDocument();
      expect(screen.queryByText('Tokyo Diner')).not.toBeInTheDocument();
    });

    queryClient.clear();
  });

  it('tracks analytics when a restaurant CTA is clicked', async () => {
    const { analytics, user, queryClient } = renderBrowser();

    const ctas = await screen.findAllByText('Book this restaurant');
    await user.click(ctas[0]);

    expect(analytics).toContainEqual({
      name: 'restaurant_selected',
      props: { restaurantId: 'rest-1', position: 0 },
    });

    queryClient.clear();
  });
});
