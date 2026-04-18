import type { OccasionService, OpsOccasion } from '@/services/ops/occasions';

const initialOccasions: OpsOccasion[] = [
  {
    key: 'dining',
    label: 'Dining',
    shortLabel: 'Dining',
    description: 'Standard dining reservation.',
    availability: [],
    defaultDurationMinutes: 90,
    displayOrder: 1,
    isActive: true,
    isBuiltin: true,
  },
  {
    key: 'lunch',
    label: 'Lunch',
    shortLabel: 'Lunch',
    description: 'Lunch reservation occasion.',
    availability: [],
    defaultDurationMinutes: 90,
    displayOrder: 2,
    isActive: true,
    isBuiltin: true,
  },
  {
    key: 'dinner',
    label: 'Dinner',
    shortLabel: 'Dinner',
    description: 'Dinner reservation occasion.',
    availability: [],
    defaultDurationMinutes: 120,
    displayOrder: 3,
    isActive: true,
    isBuiltin: true,
  },
  {
    key: 'tasting_menu',
    label: 'Chef’s Tasting Menu (Long Title That Wraps On Mobile)',
    shortLabel: 'Tasting',
    description: 'Long-form dining experience.',
    availability: [],
    defaultDurationMinutes: 150,
    displayOrder: 4,
    isActive: true,
    isBuiltin: false,
  },
];

export class DevOccasionService implements OccasionService {
  private occasions: OpsOccasion[];

  constructor() {
    this.occasions = initialOccasions.slice();
  }

  async listOccasions(): Promise<OpsOccasion[]> {
    return this.occasions.slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }

  async createOccasion(input: {
    key: string;
    label: string;
    shortLabel?: string;
    description?: string | null;
    availability?: unknown[];
    defaultDurationMinutes?: number;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<OpsOccasion> {
    const existing = this.occasions.find((o) => o.key === input.key);
    if (existing) {
      throw new Error('[dev][occasionService] occasion key already exists');
    }
    const next: OpsOccasion = {
      key: input.key,
      label: input.label,
      shortLabel: input.shortLabel ?? input.label,
      description: input.description ?? null,
      // Dev harness does not need to validate/interpret backend availability rules.
      // An empty array is valid and avoids typing mismatches from `unknown[]`.
      availability: [],
      defaultDurationMinutes: input.defaultDurationMinutes ?? 90,
      displayOrder: input.displayOrder ?? this.occasions.length + 1,
      isActive: input.isActive ?? true,
      isBuiltin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    };
    this.occasions = [...this.occasions, next];
    return next;
  }

  async updateOccasion(
    key: string,
    input: Partial<{
      label: string;
      shortLabel: string;
      description: string | null;
      availability: unknown[];
      defaultDurationMinutes: number;
      displayOrder: number;
      isActive: boolean;
    }>,
  ): Promise<OpsOccasion> {
    const existing = this.occasions.find((o) => o.key === key);
    if (!existing) {
      throw new Error('[dev][occasionService] occasion not found');
    }
    const next: OpsOccasion = {
      ...existing,
      label: input.label ?? existing.label,
      shortLabel: input.shortLabel ?? existing.shortLabel,
      description: input.description ?? existing.description,
      // Keep existing availability in dev to avoid spreading `unknown[]` into the typed model.
      availability: existing.availability,
      defaultDurationMinutes: input.defaultDurationMinutes ?? existing.defaultDurationMinutes,
      displayOrder: input.displayOrder ?? existing.displayOrder,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date().toISOString(),
    };
    this.occasions = this.occasions.map((o) => (o.key === key ? next : o));
    return next;
  }

  async deleteOccasion(key: string): Promise<void> {
    const existing = this.occasions.find((o) => o.key === key);
    if (!existing) return;
    if (existing.isBuiltin) {
      throw new Error('[dev][occasionService] cannot delete builtin occasions');
    }
    this.occasions = this.occasions.filter((o) => o.key !== key);
  }
}

export function createDevOccasionService(): OccasionService {
  return new DevOccasionService();
}
