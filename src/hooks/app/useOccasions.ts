'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useOccasionService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type { OpsOccasion } from '@/services/app/occasions';

export function useOpsOccasions(): UseQueryResult<OpsOccasion[], HttpError | Error> {
  const occasionService = useOccasionService();

  return useQuery<OpsOccasion[], HttpError | Error>({
    queryKey: queryKeys.opsOccasions.list(),
    queryFn: () => occasionService.listOccasions(),
    staleTime: 60_000,
  });
}
