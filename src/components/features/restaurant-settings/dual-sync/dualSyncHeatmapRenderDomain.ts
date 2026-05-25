import {
  HEATMAP_BUCKETS,
  HEATMAP_BUCKET_LABEL,
  HEATMAP_BUCKET_TONE,
  type DualSyncHeatmapBucket,
  type DualSyncHeatmapCounts,
} from './heatmap';

export interface DualSyncHeatmapSegmentModel {
  readonly bucket: DualSyncHeatmapBucket;
  readonly label: string;
  readonly title: string;
  readonly toneClassName: string;
  readonly widthPercent: number;
}

export interface DualSyncHeatmapLegendItemModel {
  readonly bucket: DualSyncHeatmapBucket;
  readonly value: number;
  readonly shortLabel: string;
  readonly toneClassName: string;
}

export interface DualSyncHeatmapRenderModel {
  readonly isEmpty: boolean;
  readonly emptyLabel: string;
  readonly ariaLabel: string;
  readonly segments: ReadonlyArray<DualSyncHeatmapSegmentModel>;
  readonly legendItems: ReadonlyArray<DualSyncHeatmapLegendItemModel>;
  readonly inactiveOnlyLabel: string | null;
}

export function buildDualSyncHeatmapRenderModel(
  counts: DualSyncHeatmapCounts,
): DualSyncHeatmapRenderModel {
  const isEmpty = counts.total === 0;
  const segments = isEmpty ? [] : buildHeatmapSegments(counts);
  const legendItems = buildHeatmapLegendItems(counts);

  return {
    isEmpty,
    emptyLabel: 'No fields',
    ariaLabel: `Field state breakdown: ${HEATMAP_BUCKETS.map(
      (bucket) => `${HEATMAP_BUCKET_LABEL[bucket]} ${counts[bucket]}`,
    ).join(', ')}`,
    segments,
    legendItems,
    inactiveOnlyLabel:
      !isEmpty && legendItems.length === 0 && counts.inactive === counts.total
        ? 'all inactive'
        : null,
  };
}

function buildHeatmapSegments(
  counts: DualSyncHeatmapCounts,
): ReadonlyArray<DualSyncHeatmapSegmentModel> {
  return HEATMAP_BUCKETS.flatMap((bucket) => {
    const value = counts[bucket];
    if (value === 0) return [];
    const label = HEATMAP_BUCKET_LABEL[bucket];
    return [
      {
        bucket,
        label,
        title: `${label}: ${value}`,
        toneClassName: HEATMAP_BUCKET_TONE[bucket],
        widthPercent: (value / counts.total) * 100,
      },
    ];
  });
}

function buildHeatmapLegendItems(
  counts: DualSyncHeatmapCounts,
): ReadonlyArray<DualSyncHeatmapLegendItemModel> {
  return HEATMAP_BUCKETS.flatMap((bucket) => {
    const value = counts[bucket];
    if (value === 0 || bucket === 'inactive') return [];
    return [
      {
        bucket,
        value,
        shortLabel: shortHeatmapBucketLabel(bucket),
        toneClassName: HEATMAP_BUCKET_TONE[bucket],
      },
    ];
  });
}

function shortHeatmapBucketLabel(bucket: DualSyncHeatmapBucket): string {
  switch (bucket) {
    case 'in_sync':
      return 'sync';
    case 'drift':
      return 'drift';
    case 'conflict':
      return 'cnflct';
    case 'pending':
      return 'pndg';
    case 'failed':
      return 'fail';
    case 'inactive':
      return 'inact';
  }
}
