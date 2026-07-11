import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StepPrefetchBoundary } from '@/components/features/booking/wizard/StepPrefetchBoundary';

const { prefetchIfStaleMock } = vi.hoisted(() => ({
  prefetchIfStaleMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prefetchers', () => ({
  prefetchIfStale: prefetchIfStaleMock,
}));

function renderBoundary(props: {
  nextStepKey: readonly unknown[];
  nextStepFetcher: () => Promise<unknown>;
  enabled?: boolean;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <StepPrefetchBoundary {...props} />
    </QueryClientProvider>,
  );

  return { queryClient, ...view };
}

describe('StepPrefetchBoundary', () => {
  it('@contract renders nothing and prefetches the next step query on mount', async () => {
    prefetchIfStaleMock.mockClear();
    const nextStepKey = ['wizard', 'step-2'] as const;
    const nextStepFetcher = vi.fn().mockResolvedValue({ ok: true });

    const { queryClient, container } = renderBoundary({ nextStepKey, nextStepFetcher });

    expect(container).toBeEmptyDOMElement();

    await waitFor(() => {
      expect(prefetchIfStaleMock).toHaveBeenCalledTimes(1);
    });
    expect(prefetchIfStaleMock).toHaveBeenCalledWith({
      queryClient,
      queryKey: nextStepKey,
      queryFn: nextStepFetcher,
    });
  });

  it('@contract skips prefetching while disabled', async () => {
    prefetchIfStaleMock.mockClear();

    renderBoundary({
      nextStepKey: ['wizard', 'step-2'],
      nextStepFetcher: vi.fn(),
      enabled: false,
    });

    // The effect runs synchronously after mount; give it a microtask to settle.
    await Promise.resolve();
    expect(prefetchIfStaleMock).not.toHaveBeenCalled();
  });
});
