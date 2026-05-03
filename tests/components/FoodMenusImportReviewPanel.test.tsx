import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useOpsFoodMenusMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/ops/useOpsFoodMenus', () => ({
  useOpsFoodMenus: useOpsFoodMenusMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    info: toastInfoMock,
    error: toastErrorMock,
  },
}));

import { FoodMenusImportReviewPanel } from '@/components/features/restaurant-settings/dual-sync/FoodMenusImportReviewPanel';

import type { FoodMenusImportReviewRecord } from '@/server/google-business-profile/food-menus-storage';

const refreshMutateAsyncMock = vi.fn();
const decideMutateAsyncMock = vi.fn();

const baseReviewRow: FoodMenusImportReviewRecord = {
  id: 'review-1',
  restaurantId: 'rest-1',
  googleSnapshotId: 'google-snapshot-1',
  projectionSnapshotId: 'projection-snapshot-1',
  localItemId: 'item-1',
  externalItemId: 'starter-paneer',
  targetKind: 'food',
  googlePath: 'menus[0].sections[0].items[0]',
  googleSectionLabel: 'Starters',
  googleItemName: 'Chilli Paneer',
  matchStatus: 'matched',
  matchConfidence: 'previous_identity',
  suggestedPatch: {
    shortDescription: 'Google-side description',
    basePrice: 9.5,
    currency: 'GBP',
    spiceLevel: 'Hot',
    keyIngredients: ['Paneer', 'Chilli'],
    caloriesKcal: 450,
    proteinG: 17,
    sodiumMg: 850,
    servesNum: 2,
  },
  warnings: [],
  decisionStatus: 'pending',
  decisionAction: null,
  decidedByUserId: null,
  decidedAt: null,
  createdAt: '2026-05-02T18:00:00.000Z',
  updatedAt: '2026-05-02T18:00:00.000Z',
};

function mockHook({
  rows = [baseReviewRow],
  overrides = {},
}: {
  rows?: ReadonlyArray<FoodMenusImportReviewRecord>;
  overrides?: Record<string, unknown>;
} = {}) {
  useOpsFoodMenusMock.mockReturnValue({
    importReviewsQuery: {
      data: {
        rows,
        pendingCount: rows.length,
      },
      isLoading: false,
      isError: false,
      error: null,
    },
    refreshImportReviewMutation: {
      isPending: false,
      mutateAsync: refreshMutateAsyncMock,
    },
    decideImportReviewMutation: {
      isPending: false,
      mutateAsync: decideMutateAsyncMock,
    },
    ...overrides,
  });
}

describe('FoodMenusImportReviewPanel', () => {
  beforeEach(() => {
    useOpsFoodMenusMock.mockReset();
    refreshMutateAsyncMock.mockReset();
    decideMutateAsyncMock.mockReset();
    toastSuccessMock.mockReset();
    toastInfoMock.mockReset();
    toastErrorMock.mockReset();
    refreshMutateAsyncMock.mockResolvedValue({ rows: [] });
    decideMutateAsyncMock.mockResolvedValue({});
    mockHook();
  });

  it('renders pending Google menu suggestions with safe patch fields', () => {
    render(<FoodMenusImportReviewPanel restaurantId="rest-1" />);

    expect(screen.getByText('Review Google menu suggestions')).toBeInTheDocument();
    expect(screen.getByText('Bulk select')).toBeInTheDocument();
    expect(screen.getByText('Chilli Paneer')).toBeInTheDocument();
    expect(screen.getByText(/Price: GBP 9.50/)).toBeInTheDocument();
    expect(screen.getByText(/Spice: Hot/)).toBeInTheDocument();
    expect(screen.getByText(/Ingredients: Paneer, Chilli/)).toBeInTheDocument();
    expect(screen.getByText(/Nutrition: kcal 450, protein 17g, sodium 850mg/)).toBeInTheDocument();
    expect(screen.getByText(/Serves: 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply all safe \(1\)/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Apply selected/i })).toBeDisabled();
  });

  it('refreshes Google FoodMenus suggestions through the hook', async () => {
    const user = userEvent.setup();
    refreshMutateAsyncMock.mockResolvedValue({ rows: [{ id: 'review-1' }] });

    render(<FoodMenusImportReviewPanel restaurantId="rest-1" />);
    await user.click(screen.getByRole('button', { name: /Refresh Google menu/i }));

    expect(refreshMutateAsyncMock).toHaveBeenCalledWith({ persist: true });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('1 Google menu suggestion ready to review.');
    });
  });

  it('stages a row decision before applying selected suggestions', async () => {
    const user = userEvent.setup();

    render(<FoodMenusImportReviewPanel restaurantId="rest-1" />);
    await user.click(screen.getAllByRole('button', { name: /^Apply$/i })[0]!);

    expect(decideMutateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByText('Apply selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Apply selected \(1\)/i }));

    expect(decideMutateAsyncMock).toHaveBeenCalledWith({
      reviewId: 'review-1',
      action: 'apply_to_nabatable',
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('1 applied');
    });
  });

  it('bulk selects safe applies and skips unsafe rows', async () => {
    const user = userEvent.setup();
    mockHook({
      rows: [
        baseReviewRow,
        {
          ...baseReviewRow,
          id: 'review-2',
          localItemId: null,
          externalItemId: null,
          googlePath: 'menus[0].sections[0].items[1]',
          googleItemName: 'Unknown Google Item',
          matchStatus: 'unmatched',
          matchConfidence: 'none',
          suggestedPatch: null,
        },
      ],
    });

    render(<FoodMenusImportReviewPanel restaurantId="rest-1" />);
    await user.click(screen.getByRole('button', { name: /Apply all safe \(1\)/i }));
    await user.click(screen.getByRole('button', { name: /Apply selected \(1\)/i }));

    expect(decideMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(decideMutateAsyncMock).toHaveBeenCalledWith({
      reviewId: 'review-1',
      action: 'apply_to_nabatable',
    });
  });

  it('creates unmatched Google rows when a safe new-item patch is available', async () => {
    const user = userEvent.setup();
    mockHook({
      rows: [
        {
          ...baseReviewRow,
          id: 'review-new',
          localItemId: null,
          externalItemId: null,
          googlePath: 'menus[0].sections[1].items[0]',
          googleSectionLabel: 'Mains',
          googleItemName: 'Google Curry',
          matchStatus: 'unmatched',
          matchConfidence: 'none',
          suggestedPatch: {
            externalItemId: 'gbp-menus-0-sections-1-items-0',
            itemName: 'Google Curry',
            category: 'Mains',
            shortDescription: 'Google-side item',
            basePrice: 12.5,
            currency: 'GBP',
          },
        },
      ],
    });

    render(<FoodMenusImportReviewPanel restaurantId="rest-1" />);

    expect(screen.getByRole('button', { name: /Apply all safe \(1\)/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /^Create$/i }));
    await user.click(screen.getByRole('button', { name: /Apply selected \(1\)/i }));

    expect(decideMutateAsyncMock).toHaveBeenCalledWith({
      reviewId: 'review-new',
      action: 'create_new_item',
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('1 created');
    });
  });

  it('bulk selects ignore decisions for every pending suggestion', async () => {
    const user = userEvent.setup();
    mockHook({
      rows: [
        baseReviewRow,
        {
          ...baseReviewRow,
          id: 'review-2',
          googlePath: 'menus[0].sections[0].items[1]',
          googleItemName: 'Google Dessert',
        },
      ],
    });

    render(<FoodMenusImportReviewPanel restaurantId="rest-1" />);
    await user.click(screen.getByRole('button', { name: /Ignore all \(2\)/i }));
    await user.click(screen.getByRole('button', { name: /Apply selected \(2\)/i }));

    expect(decideMutateAsyncMock).toHaveBeenNthCalledWith(1, {
      reviewId: 'review-1',
      action: 'ignore_google_change',
    });
    expect(decideMutateAsyncMock).toHaveBeenNthCalledWith(2, {
      reviewId: 'review-2',
      action: 'ignore_google_change',
    });
  });
});
