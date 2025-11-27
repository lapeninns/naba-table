import { fetchJson } from '@/lib/http/fetchJson';

import type { OccasionDefinition } from '@reserve/shared/occasions';

export type OpsOccasion = OccasionDefinition & {
  isBuiltin?: boolean;
  deletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

type OccasionListResponse = {
  occasions: OpsOccasion[];
};

type OccasionResponse = {
  occasion: OpsOccasion;
};

export interface OccasionService {
  listOccasions(): Promise<OpsOccasion[]>;
  createOccasion(input: CreateOccasionInput): Promise<OpsOccasion>;
  updateOccasion(key: string, input: UpdateOccasionInput): Promise<OpsOccasion>;
  deleteOccasion(key: string): Promise<void>;
}

export type CreateOccasionInput = {
  key: string;
  label: string;
  shortLabel?: string;
  description?: string | null;
  availability?: unknown[];
  defaultDurationMinutes?: number;
  displayOrder?: number;
  isActive?: boolean;
};

// Updates may be partial; backend treats missing fields as unchanged.
export type UpdateOccasionInput = Partial<Omit<CreateOccasionInput, 'key'>>;

export type OccasionServiceFactory = () => OccasionService;

class DefaultOccasionService implements OccasionService {
  async listOccasions(): Promise<OpsOccasion[]> {
    const response = await fetchJson<OccasionListResponse>('/api/occasions');
    return response.occasions;
  }

  async createOccasion(input: CreateOccasionInput): Promise<OpsOccasion> {
    const response = await fetchJson<OccasionResponse>('/api/occasions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.occasion;
  }

  async updateOccasion(key: string, input: UpdateOccasionInput): Promise<OpsOccasion> {
    const response = await fetchJson<OccasionResponse>(`/api/occasions/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return response.occasion;
  }

  async deleteOccasion(key: string): Promise<void> {
    await fetchJson<{ success: boolean }>(`/api/occasions/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }
}

class NotImplementedOccasionService implements OccasionService {
  listOccasions(): Promise<OpsOccasion[]> {
    throw new Error('[ops][occasionService] not implemented');
  }

  createOccasion(): Promise<OpsOccasion> {
    throw new Error('[ops][occasionService] not implemented');
  }

  updateOccasion(): Promise<OpsOccasion> {
    throw new Error('[ops][occasionService] not implemented');
  }

  deleteOccasion(): Promise<void> {
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
