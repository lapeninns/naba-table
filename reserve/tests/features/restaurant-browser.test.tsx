import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RestaurantBrowser } from '@/components/marketing/RestaurantBrowser';

import type { AnalyticsEvent } from '@/lib/analytics';
import type { RestaurantFilters, RestaurantSummary } from '@/lib/restaurants/types';

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

type RenderBrowserOptions = {
  initialData?: RestaurantSummary[];
  initialError?: boolean;
  fetchRestaurants?: (filters: RestaurantFilters) => Promise<RestaurantSummary[]>;
};

function renderBrowser(options: RenderBrowserOptions = {}) {
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

  const fetchRestaurants =
    options.fetchRestaurants ??
    (async () => {
      await Promise.resolve();
      return sampleRestaurants;
    });

  const initialData = options.initialData ?? sampleRestaurants;

  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>
      <RestaurantBrowser
        initialData={initialData}
        initialError={options.initialError}
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

  it('shows retry button on error, refetches on click, and logs analytics', async () => {
    const failingFetch = vi.fn().mockResolvedValue(sampleRestaurants);

    const { analytics, user, queryClient } = renderBrowser({
      initialData: [],
      initialError: true,
      fetchRestaurants: failingFetch,
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load restaurants right now.');

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(failingFetch).not.toHaveBeenCalled();

    await user.click(retryButton);

    await waitFor(() => {
      expect(failingFetch).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText('The Ivy London')).toBeInTheDocument();
    });

    expect(analytics).toContainEqual(expect.objectContaining({ name: 'restaurants_list_error' }));

    queryClient.clear();
  });

  it('shows contact support CTA and emits restaurants_empty analytics when no data', async () => {
    const emptyFetch = vi.fn().mockResolvedValue([]);

    const { analytics, queryClient } = renderBrowser({
      initialData: [],
      initialError: false,
      fetchRestaurants: emptyFetch,
    });

    const emptyHeading = await screen.findByText('No restaurants available');
    expect(emptyHeading).toBeInTheDocument();

    const contactLink = screen.getByRole('link', { name: /contact support/i });
    expect(contactLink).toHaveAttribute('href', 'mailto:support@example.com');

    expect(analytics).toContainEqual(expect.objectContaining({ name: 'restaurants_empty' }));

    queryClient.clear();
  });

  it('filters by minimum capacity', async () => {
    const { user, queryClient } = renderBrowser();

    const partySizeInput = screen.getByRole('spinbutton', { name: /minimum seats/i });
    await user.clear(partySizeInput);
    await user.type(partySizeInput, '80');

    await waitFor(() => {
      expect(screen.getByText('The Ivy London')).toBeInTheDocument();
      expect(screen.queryByText('Tokyo Diner')).not.toBeInTheDocument();
    });

    queryClient.clear();
  });
});
