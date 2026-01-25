export function isRealtimeFloorplanEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const flag = process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN;
  return flag !== 'false';
}
