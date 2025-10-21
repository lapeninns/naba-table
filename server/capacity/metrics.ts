export type CapacityMetricType = 'success' | 'conflict' | 'capacity_exceeded';

export type RecordCapacityMetricParams = {
  restaurantId: string;
  bookingDate: string;
  startTime?: string | null;
  metric: CapacityMetricType;
};

export async function recordCapacityMetric(_params: RecordCapacityMetricParams): Promise<void> {
  // Capacity metrics have been sunset; keep this hook as a no-op for backwards compatibility.
}
