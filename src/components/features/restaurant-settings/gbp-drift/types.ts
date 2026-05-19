import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary, DualSyncPublishResponse } from '@/services/ops/dual-sync';
import type { ReactNode } from 'react';

export type GbpDriftFilter = 'drifted_only' | 'all';

export type GbpDriftOpenOptions = {
  readonly sectionKey?: DualSyncSectionKey;
  readonly sectionKeys?: ReadonlyArray<DualSyncSectionKey>;
  readonly fieldKey?: string;
  readonly filter?: GbpDriftFilter;
};

export type GbpDriftFieldView = {
  readonly field: DualSyncFieldSummary & { readonly sectionKey: DualSyncSectionKey };
  readonly fieldKey: string;
  readonly sectionKey: DualSyncSectionKey;
  readonly label: string;
  readonly helpText: string | null;
  readonly localValue: unknown;
  readonly gbpValue: unknown;
  readonly hasDraftOverride: boolean;
  readonly savedNeedsReview: boolean;
  readonly liveMatches: boolean;
  readonly liveStatus: 'synced' | 'drifted';
  readonly effectiveStatus: 'synced' | 'drifted';
  readonly canImport: boolean;
};

export type GbpDriftContextValue = {
  readonly restaurantId: string | null;
  readonly isLinked: boolean;
  readonly isLoading: boolean;
  readonly fieldViews: ReadonlyArray<GbpDriftFieldView>;
  readonly fieldViewByKey: ReadonlyMap<string, GbpDriftFieldView>;
  readonly totalDriftCount: number;
  readonly driftCountBySection: Readonly<Record<DualSyncSectionKey, number>>;
  readonly registerDraftOverride: (fieldKey: string, value: unknown | null) => void;
  readonly clearDraftOverrides: (fieldKeys?: ReadonlyArray<string>) => void;
  readonly openCompare: (options?: GbpDriftOpenOptions) => void;
  readonly closeCompare: () => void;
  readonly compareDialogOpen: boolean;
  readonly compareOptions: GbpDriftOpenOptions;
  readonly applyFieldFromGoogle: (fieldKey: string) => Promise<DualSyncPublishResponse | null>;
  readonly applyAllFromGoogle: (
    options?: GbpDriftOpenOptions,
  ) => Promise<DualSyncPublishResponse | null>;
  readonly isApplying: boolean;
};

export type GbpDriftProviderProps = {
  readonly restaurantId: string | null;
  readonly children: ReactNode;
};
