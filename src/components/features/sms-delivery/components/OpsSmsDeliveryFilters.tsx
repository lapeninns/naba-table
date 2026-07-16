'use client';

import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  OPS_SMS_DELIVERY_CHANNEL_OPTIONS,
  OPS_SMS_DELIVERY_PAGE_SIZE_OPTIONS,
  OPS_SMS_DELIVERY_RANGE_OPTIONS,
  OPS_SMS_DELIVERY_STATUS_FILTERS,
} from '../opsSmsDeliveryDomain';

import type {
  OpsSmsDeliveryRange,
  SmsDeliveryChannelFilter,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';

export type OpsSmsDeliveryFiltersProps = {
  range: OpsSmsDeliveryRange;
  pageSize: number;
  channel: SmsDeliveryChannelFilter;
  selectedStatuses: SmsDeliveryStatus[];
  onRangeChange: (range: OpsSmsDeliveryRange) => void;
  onPageSizeChange: (pageSize: number) => void;
  onChannelChange: (channel: SmsDeliveryChannelFilter) => void;
  onClearStatuses: () => void;
  onToggleStatus: (status: SmsDeliveryStatus) => void;
};

export function OpsSmsDeliveryFilters({
  range,
  pageSize,
  channel,
  selectedStatuses,
  onRangeChange,
  onPageSizeChange,
  onChannelChange,
  onClearStatuses,
  onToggleStatus,
}: OpsSmsDeliveryFiltersProps) {
  return (
    <OpsPageToolbar
      sticky={false}
      filters={
        <>
          <Select
            value={channel}
            onValueChange={(value) => onChannelChange(value as SmsDeliveryChannelFilter)}
          >
            <SelectTrigger className="h-9 w-full sm:w-[170px]" aria-label="Select channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS_SMS_DELIVERY_CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={range}
            onValueChange={(value) => onRangeChange(value as OpsSmsDeliveryRange)}
          >
            <SelectTrigger className="h-9 w-full sm:w-[170px]" aria-label="Select date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS_SMS_DELIVERY_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS_SMS_DELIVERY_PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      actions={
        <>
          <Button
            type="button"
            variant={selectedStatuses.length === 0 ? 'default' : 'outline'}
            size="sm"
            onClick={onClearStatuses}
          >
            All
          </Button>
          {OPS_SMS_DELIVERY_STATUS_FILTERS.map((status) => {
            const active = selectedStatuses.includes(status.value);
            return (
              <Button
                key={status.value}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToggleStatus(status.value)}
              >
                {status.label}
              </Button>
            );
          })}
        </>
      }
    />
  );
}

export default OpsSmsDeliveryFilters;
