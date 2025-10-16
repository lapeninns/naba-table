import { fetchJson } from '@/lib/http/fetchJson';
import type { OpsServiceError } from '@/types/ops';

const OPS_CAPACITY_BASE = '/api/ops/capacity-rules';
const OPS_CAPACITY_RULE_DETAIL_BASE = '/api/ops/capacity-rules';
const OPS_CAPACITY_OVERRIDES_BASE = '/api/ops/capacity-overrides';
const OPS_CAPACITY_EXPORT_BASE = '/api/ops/capacity/overbooking-export';

type CapacityRuleDto = {
  id: string;
  restaurant_id: string;
  service_period_id: string | null;
  day_of_week: number | null;
  effective_date: string | null;
  max_covers: number | null;
  max_parties: number | null;
  notes: string | null;
  label: string | null;
  override_type: 'holiday' | 'event' | 'manual' | 'emergency' | null;
  restaurant_service_periods?: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
  } | null;
};

type CapacityRulesResponseDto = {
  rules: CapacityRuleDto[];
  count: number;
};

type UpsertCapacityRuleResponseDto = {
  rule: CapacityRuleDto;
  updated: boolean;
};

export type CapacityServicePeriod = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

export type CapacityRule = {
  id: string;
  restaurantId: string;
  servicePeriodId: string | null;
  dayOfWeek: number | null;
  effectiveDate: string | null;
  maxCovers: number | null;
  maxParties: number | null;
  notes: string | null;
  label: string | null;
  overrideType: CapacityRuleDto['override_type'];
  servicePeriod: CapacityServicePeriod | null;
};

export type ListCapacityRulesResult = {
  rules: CapacityRule[];
  count: number;
};

export type SaveCapacityRulePayload = {
  servicePeriodId?: string | null;
  dayOfWeek?: number | null;
  effectiveDate?: string | null;
  maxCovers?: number | null;
  maxParties?: number | null;
  notes?: string | null;
  label?: string | null;
  overrideType?: CapacityRuleDto['override_type'] | null;
};

export type CapacityOverride = {
  id: string;
  restaurantId: string;
  effectiveDate: string;
  servicePeriod: CapacityServicePeriod | null;
  servicePeriodId: string | null;
  dayOfWeek: number | null;
  maxCovers: number | null;
  maxParties: number | null;
  label: string | null;
  overrideType: CapacityRuleDto['override_type'];
  notes: string | null;
  createdAt: string | null;
};

type CapacityOverridesResponseDto = {
  overrides: Array<
    CapacityRuleDto & {
      restaurant_service_periods?: {
        id: string;
        name: string;
        start_time: string;
        end_time: string;
      } | null;
      created_at?: string | null;
    }
  >;
  range: {
    from: string;
    to: string;
  };
  count: number;
};

export type ListCapacityOverridesParams = {
  from?: string;
  to?: string;
};

export interface CapacityService {
  list(restaurantId: string): Promise<ListCapacityRulesResult>;
  save(restaurantId: string, payload: SaveCapacityRulePayload): Promise<CapacityRule>;
  delete(ruleId: string): Promise<void>;
  listOverrides(restaurantId: string, params?: ListCapacityOverridesParams): Promise<CapacityOverride[]>;
  exportOverbookingReport(restaurantId: string, params: { from: string; to: string }): Promise<Blob>;
}

export type CapacityServiceFactory = () => CapacityService;

export class NotImplementedCapacityService implements CapacityService {
  private error(message: string): never {
    throw new Error(`[ops][capacity] ${message}`);
  }

  list(): Promise<ListCapacityRulesResult> {
    this.error('list not implemented');
  }

  save(): Promise<CapacityRule> {
    this.error('save not implemented');
  }

  delete(): Promise<void> {
    this.error('delete not implemented');
  }

  listOverrides(): Promise<CapacityOverride[]> {
    this.error('listOverrides not implemented');
  }

  exportOverbookingReport(): Promise<Blob> {
    this.error('exportOverbookingReport not implemented');
  }
}

export function createCapacityService(factory?: CapacityServiceFactory): CapacityService {
  try {
    return factory ? factory() : createBrowserCapacityService();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[ops][capacity] failed to instantiate service', error.message);
    }
    return new NotImplementedCapacityService();
  }
}

export type CapacityServiceError = OpsServiceError | Error;

function mapServicePeriod(dto: CapacityRuleDto['restaurant_service_periods']): CapacityServicePeriod | null {
  if (!dto) {
    return null;
  }
  return {
    id: dto.id,
    name: dto.name,
    startTime: dto.start_time,
    endTime: dto.end_time,
  };
}

function mapRule(dto: CapacityRuleDto): CapacityRule {
  return {
    id: dto.id,
    restaurantId: dto.restaurant_id,
    servicePeriodId: dto.service_period_id,
    dayOfWeek: dto.day_of_week,
    effectiveDate: dto.effective_date,
    maxCovers: dto.max_covers,
    maxParties: dto.max_parties,
    notes: dto.notes,
    label: dto.label ?? null,
    overrideType: dto.override_type ?? null,
    servicePeriod: mapServicePeriod(dto.restaurant_service_periods ?? null),
  };
}

function mapOverride(dto: CapacityRuleDto & { created_at?: string | null }): CapacityOverride {
  return {
    id: dto.id,
    restaurantId: dto.restaurant_id,
    effectiveDate: dto.effective_date ?? '',
    servicePeriod: mapServicePeriod(dto.restaurant_service_periods ?? null),
    servicePeriodId: dto.service_period_id,
    dayOfWeek: dto.day_of_week,
    maxCovers: dto.max_covers,
    maxParties: dto.max_parties,
    label: dto.label ?? null,
    overrideType: dto.override_type ?? null,
    notes: dto.notes ?? null,
    createdAt: dto.created_at ?? null,
  };
}

export function createBrowserCapacityService(): CapacityService {
  return {
    async list(restaurantId) {
      const searchParams = new URLSearchParams({ restaurantId });
      const response = await fetchJson<CapacityRulesResponseDto>(`${OPS_CAPACITY_BASE}?${searchParams.toString()}`);
      return {
        rules: (response.rules ?? []).map(mapRule),
        count: response.count ?? response.rules?.length ?? 0,
      };
    },

    async save(restaurantId, payload) {
      const response = await fetchJson<UpsertCapacityRuleResponseDto>(OPS_CAPACITY_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          servicePeriodId: payload.servicePeriodId ?? null,
          dayOfWeek: payload.dayOfWeek ?? null,
          effectiveDate: payload.effectiveDate ?? null,
          maxCovers: payload.maxCovers ?? null,
          maxParties: payload.maxParties ?? null,
          notes: payload.notes ?? null,
          label: payload.label ?? null,
          overrideType: payload.overrideType ?? null,
        }),
      });
      return mapRule(response.rule);
    },

    async delete(ruleId) {
      await fetchJson<{ success: boolean }>(`${OPS_CAPACITY_RULE_DETAIL_BASE}/${ruleId}`, {
        method: 'DELETE',
      });
    },

    async listOverrides(restaurantId, params = {}) {
      const searchParams = new URLSearchParams({ restaurantId });
      if (params.from) searchParams.set('from', params.from);
      if (params.to) searchParams.set('to', params.to);

      const response = await fetchJson<CapacityOverridesResponseDto>(
        `${OPS_CAPACITY_OVERRIDES_BASE}?${searchParams.toString()}`
      );
      return (response.overrides ?? []).map((override) => mapOverride(override));
    },

    async exportOverbookingReport(restaurantId, params) {
      const searchParams = new URLSearchParams({
        restaurantId,
        from: params.from,
        to: params.to,
      });

      const response = await fetch(`${OPS_CAPACITY_EXPORT_BASE}?${searchParams.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        let message = 'Failed to export overbooking report.';
        try {
          const body = await response.json();
          if (body?.error) {
            message = body.error;
          }
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      return response.blob();
    },
  };
}
