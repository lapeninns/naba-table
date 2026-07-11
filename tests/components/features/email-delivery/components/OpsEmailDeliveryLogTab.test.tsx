import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryLogTab } from '@/components/features/email-delivery/components/OpsEmailDeliveryLogTab';

import type { OpsEmailDeliveryState } from '@/components/features/email-delivery/useOpsEmailDeliveryState';

function restoreDesktopMatchMedia() {
  // vitest.config sets mockReset:true, which wipes the global matchMedia mock
  // implementation before each test. The delivery table reads useIsMobile, so
  // restore a working matchMedia and a desktop-width viewport for the table
  // variant to resolve (same pattern as tests/components/OpsEmailDeliveryTable.test.tsx).
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1280,
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

type FeedQueryOptions = Partial<{
  unavailable: boolean;
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  data: unknown;
}>;

type StateOptions = {
  feedQuery?: FeedQueryOptions;
  canInjectDeliveryLogError?: boolean;
  effectiveDeliveryLogErrorMessage?: string | null;
  shouldShowEmptyGuidance?: boolean;
  shouldShowPagination?: boolean;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
};

function makeState(options: StateOptions = {}) {
  const refetch = vi.fn();
  const handleNext = vi.fn();
  const handlePrev = vi.fn();
  const applyPageSize = vi.fn();

  const state = {
    canInjectDeliveryLogError: options.canInjectDeliveryLogError ?? false,
    DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID: 'msg-fault-injection',
    queryState: {
      searchField: 'recipientEmail',
      searchValue: '',
      setSearchField: vi.fn(),
      setSearchValue: vi.fn(),
      submitSearch: vi.fn(),
      range: '7d',
      applyRange: vi.fn(),
      templateType: null,
      applyTemplateType: vi.fn(),
      emailType: null,
      applyEmailType: vi.fn(),
      statuses: [],
      toggleStatus: vi.fn(),
      clearFilters: vi.fn(),
      pageSize: 25,
      applyPageSize,
    },
    dataState: {
      feedQuery: {
        unavailable: false,
        isLoading: false,
        isPending: false,
        isFetching: false,
        isPlaceholderData: false,
        data: { ok: true },
        refetch,
        ...options.feedQuery,
      },
      statusCounts: null,
      rows: [],
    },
    effectiveDeliveryLogErrorMessage: options.effectiveDeliveryLogErrorMessage ?? null,
    timezone: 'UTC',
    effectiveRestaurantId: 'rest-1',
    retryState: {
      retryingAttemptKey: null,
      pendingRetryRow: null,
      pendingRetryAttemptKey: null,
      handleRetryAttempt: vi.fn(),
      handleRetryDialogOpenChange: vi.fn(),
      handleConfirmRetry: vi.fn(),
    },
    shouldShowEmptyGuidance: options.shouldShowEmptyGuidance ?? false,
    shouldShowPagination: options.shouldShowPagination ?? false,
    startResult: 1,
    endResult: 25,
    totalResults: 120,
    currentPage: 1,
    currentPageSize: 25,
    handlePrev,
    handleNext,
    hasPrevPage: options.hasPrevPage ?? false,
    hasNextPage: options.hasNextPage ?? true,
  } as unknown as OpsEmailDeliveryState;

  return { state, refetch, handleNext, handlePrev, applyPageSize };
}

describe('OpsEmailDeliveryLogTab', () => {
  beforeEach(() => {
    restoreDesktopMatchMedia();
  });

  it('@contract renders the filter toolbar and delivery table on the happy path', () => {
    const { state } = makeState();
    render(<OpsEmailDeliveryLogTab state={state} />);

    expect(screen.getByRole('combobox', { name: 'Filter by template type' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Dev/test validation control')).not.toBeInTheDocument();
    expect(screen.queryByText('Delivery tracking unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('No email deliveries found')).not.toBeInTheDocument();
  });

  it('@contract shows the unavailable notice instead of the table when tracking is off', () => {
    const { state } = makeState({ feedQuery: { unavailable: true } });
    render(<OpsEmailDeliveryLogTab state={state} />);

    expect(screen.getByText('Delivery tracking unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(/not currently recording or exposing delivery events/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('@contract surfaces the load error with a retry action that refetches the feed', async () => {
    const user = userEvent.setup();
    const { state, refetch } = makeState({
      effectiveDeliveryLogErrorMessage: 'Delivery feed exploded',
    });
    render(<OpsEmailDeliveryLogTab state={state} />);

    expect(screen.getByText('Unable to load email delivery attempts')).toBeInTheDocument();
    expect(screen.getByText('Delivery feed exploded')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract explains the fault-injection control when dev error injection is enabled', () => {
    const { state } = makeState({ canInjectDeliveryLogError: true });
    render(<OpsEmailDeliveryLogTab state={state} />);

    expect(screen.getByText('Dev/test validation control')).toBeInTheDocument();
    expect(screen.getByText('messageId=msg-fault-injection')).toBeInTheDocument();
  });

  it('@contract shows the empty guidance when the feed has no results', () => {
    const { state } = makeState({ shouldShowEmptyGuidance: true });
    render(<OpsEmailDeliveryLogTab state={state} />);

    expect(screen.getByText('No email deliveries found')).toBeInTheDocument();
    expect(screen.getByText(/adjust the filters or try a wider date range/i)).toBeInTheDocument();
  });

  it('@contract @a11y pages and resizes through the pagination controls', async () => {
    const user = userEvent.setup();
    const { state, handleNext, applyPageSize } = makeState({
      shouldShowPagination: true,
      hasPrevPage: false,
      hasNextPage: true,
    });
    render(<OpsEmailDeliveryLogTab state={state} />);

    expect(screen.getByText('Showing 1-25 of 120 results')).toBeInTheDocument();
    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(handleNext).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
    await user.click(await screen.findByRole('option', { name: '50' }));
    expect(applyPageSize).toHaveBeenCalledWith(50);
  });
});
