import { fetchJson } from '@/lib/http/fetchJson';

import type { OccasionDefinition } from '@reserve/shared/occasions';

type OccasionListResponse = {
  occasions: OccasionDefinition[];
};

export interface OccasionService {
  listOccasions(): Promise<OccasionDefinition[]>;
}

export type OccasionServiceFactory = () => OccasionService;

class DefaultOccasionService implements OccasionService {
  async listOccasions(): Promise<OccasionDefinition[]> {
    const response = await fetchJson<OccasionListResponse>('/api/ops/occasions');
    return response.occasions;
  }
}

class NotImplementedOccasionService implements OccasionService {
  listOccasions(): Promise<OccasionDefinition[]> {
    throw new Error('[ops][occasionService] not implemented');
  }
}

export function createOccasionService(factory?: OccasionServiceFactory): OccasionService {
  if (factory) {
    try {
      return factory();
    } catch (error) {
      console.error('[ops][occasionService] failed to instantiate custom factory', error);
      return new NotImplementedOccasionService();
    }
  }
  return new DefaultOccasionService();
}
