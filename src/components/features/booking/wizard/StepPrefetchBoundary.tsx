'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { prefetchIfStale } from '@/lib/prefetchers';

type Props = {
  nextStepKey: readonly unknown[]; // query key for upcoming step
  nextStepFetcher: () => Promise<unknown>;
  enabled?: boolean;
};

export function StepPrefetchBoundary({ nextStepKey, nextStepFetcher, enabled = true }: Props) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    void prefetchIfStale({
      queryClient,
      queryKey: nextStepKey,
      queryFn: nextStepFetcher,
    });
  }, [enabled, nextStepFetcher, nextStepKey, queryClient]);

  return null;
}
