import type { TableTimelineSegment } from '@/types/ops';

export type FloorPlanStatus = 'available' | 'reserved' | 'seated' | 'closing' | 'loading';
export type FloorPlanTableType = 'round' | 'rect' | 'booth';

export type FloorPlanTableRender = {
  id: string;
  tableNumber: string;
  capacity: number;
  xPercent: number;
  yPercent: number;
  rotation: number;
  displayStatus: FloorPlanStatus;
  displayType: FloorPlanTableType;
  partyName: string | null;
};

export type FloorPlanTableInspector = FloorPlanTableRender & {
  seatingType: string;
  zoneName: string | null;
  currentStatus: TableTimelineSegment;
  timeLabel: string | null;
};
