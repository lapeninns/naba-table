'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useOccasionService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import type { OccasionDefinition } from '@reserve/shared/occasions';
import type { HttpError } from '@/lib/http/errors';

export function useOpsOccasions(): UseQueryResult<OccasionDefinition[], HttpError | Error> {
  const occasionService = useOccasionService();

  return useQuery<OccasionDefinition[], HttpError | Error>({
    queryKey: queryKeys.opsOccasions.list(),
    queryFn: () => occasionService.listOccasions(),
    staleTime: 60_000,
  });
}
