'use client';

import { X } from 'lucide-react';

import {
  COMMS_CONTROL_HEIGHT_CLASS,
  COMMS_FILTER_CONTROL_CLASS,
} from '@/components/features/communications-delivery/components/communicationsDeliveryClasses';
import { CommunicationsDeliveryStatusFilter } from '@/components/features/communications-delivery/components/CommunicationsDeliveryStatusFilter';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <Select
            value={range}
            onValueChange={(value) => onRangeChange(value as OpsSmsDeliveryRange)}
          >
            <SelectTrigger
              className={cn(COMMS_FILTER_CONTROL_CLASS, 'lg:w-auto lg:min-w-[150px] max-w-full')}
              aria-label="Select date range"
            >
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
            value={channel}
            onValueChange={(value) => onChannelChange(value as SmsDeliveryChannelFilter)}
          >
            <SelectTrigger
              className={cn(COMMS_FILTER_CONTROL_CLASS, 'lg:w-auto lg:min-w-[150px] max-w-full')}
              aria-label="Select channel"
            >
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
          <CommunicationsDeliveryStatusFilter
            options={OPS_SMS_DELIVERY_STATUS_FILTERS}
            selected={selectedStatuses}
            onToggle={(status) => onToggleStatus(status)}
            className="sm:w-full lg:w-auto"
          />
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              className={cn(COMMS_FILTER_CONTROL_CLASS, 'lg:w-auto lg:min-w-[120px] max-w-full')}
              aria-label="Rows per page"
            >
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
          <Button
            type="button"
            variant="ghost"
            className={cn(
              COMMS_CONTROL_HEIGHT_CLASS,
              'w-full sm:col-span-2 sm:w-auto sm:justify-self-start',
            )}
            disabled={selectedStatuses.length === 0}
            onClick={onClearStatuses}
          >
            <X data-icon="inline-start" aria-hidden />
            Show all statuses
          </Button>
        </div>
      }
    />
  );
}

export default OpsSmsDeliveryFilters;
