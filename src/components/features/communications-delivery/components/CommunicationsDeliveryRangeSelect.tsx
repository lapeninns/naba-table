'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { COMMS_CONTROL_HEIGHT_CLASS } from './communicationsDeliveryClasses';

import type { OpsEmailDeliveryRange } from '@/types/emailDelivery';

export function CommunicationsDeliveryRangeSelect({
  value,
  onChange,
  includeDay = true,
}: {
  value: OpsEmailDeliveryRange;
  onChange: (range: OpsEmailDeliveryRange) => void;
  includeDay?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === '24h' || next === '7d' || next === '30d') onChange(next);
      }}
    >
      <SelectTrigger aria-label="Date range" className={COMMS_CONTROL_HEIGHT_CLASS}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {includeDay ? <SelectItem value="24h">Last 24 hours</SelectItem> : null}
        <SelectItem value="7d">Last 7 days</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
      </SelectContent>
    </Select>
  );
}
