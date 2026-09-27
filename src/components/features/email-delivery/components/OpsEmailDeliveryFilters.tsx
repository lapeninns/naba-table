'use client';

import { Search, X } from 'lucide-react';

import {
  COMMS_CONTROL_HEIGHT_CLASS,
  COMMS_FILTER_CONTROL_CLASS,
} from '@/components/features/communications-delivery/components/communicationsDeliveryClasses';
import { CommunicationsDeliveryStatusFilter } from '@/components/features/communications-delivery/components/CommunicationsDeliveryStatusFilter';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  EMAIL_DELIVERY_RANGE_OPTIONS,
  EMAIL_TYPE_OPTIONS,
  SEARCH_FIELD_LABELS,
  SEARCH_FIELD_PLACEHOLDERS,
  TEMPLATE_TYPE_OPTIONS,
  formatFilterOptionLabel,
  getEmailDeliveryStatusFilterOptions,
  isEmailDeliveryRange,
} from '../opsEmailDeliveryDomain';

import type { OpsEmailDeliverySearchField } from '../opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type OpsEmailDeliveryFiltersProps = {
  searchField: OpsEmailDeliverySearchField;
  searchValue: string;
  onSearchFieldChange: (field: OpsEmailDeliverySearchField) => void;
  onSearchValueChange: (value: string) => void;
  onSubmitSearch: () => void;
  range: OpsEmailDeliveryRange;
  onRangeChange: (range: OpsEmailDeliveryRange) => void;
  templateType: string | null;
  onTemplateTypeChange: (value: string | null) => void;
  emailType: string | null;
  onEmailTypeChange: (value: string | null) => void;
  statuses: EmailDeliveryStatus[];
  statusCounts?: Partial<Record<EmailDeliveryStatus, number>> | null;
  onToggleStatus: (status: EmailDeliveryStatus, enabled: boolean) => void;
  onClear: () => void;
};

export function OpsEmailDeliveryFilters({
  searchField,
  searchValue,
  onSearchFieldChange,
  onSearchValueChange,
  onSubmitSearch,
  range,
  onRangeChange,
  templateType,
  onTemplateTypeChange,
  emailType,
  onEmailTypeChange,
  statuses,
  statusCounts,
  onToggleStatus,
  onClear,
}: OpsEmailDeliveryFiltersProps) {
  const statusOptions = getEmailDeliveryStatusFilterOptions().map(({ status, label }) => ({
    value: status,
    label,
  }));

  return (
    <OpsPageToolbar
      sticky={false}
      filters={
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <Select
            value={range}
            onValueChange={(value) => {
              if (isEmailDeliveryRange(value)) onRangeChange(value);
            }}
          >
            <SelectTrigger
              className={cn(COMMS_FILTER_CONTROL_CLASS, 'lg:w-auto lg:min-w-[140px] max-w-full')}
              aria-label="Select time range"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_DELIVERY_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.ariaLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={templateType ?? '__all__'}
            onValueChange={(value) => onTemplateTypeChange(value === '__all__' ? null : value)}
          >
            <SelectTrigger
              className={cn(COMMS_FILTER_CONTROL_CLASS, 'lg:w-auto lg:min-w-[170px] max-w-full')}
              aria-label="Filter by template type"
            >
              <SelectValue placeholder="Template type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__all__">All templates</SelectItem>
                {TEMPLATE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {formatFilterOptionLabel(option)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={emailType ?? '__all__'}
            onValueChange={(value) => onEmailTypeChange(value === '__all__' ? null : value)}
          >
            <SelectTrigger
              className={cn(COMMS_FILTER_CONTROL_CLASS, 'lg:w-auto lg:min-w-[160px] max-w-full')}
              aria-label="Filter by email type"
            >
              <SelectValue placeholder="Email type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__all__">All types</SelectItem>
                {EMAIL_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {formatFilterOptionLabel(option)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <CommunicationsDeliveryStatusFilter<EmailDeliveryStatus>
            options={statusOptions}
            selected={statuses}
            counts={statusCounts}
            onToggle={onToggleStatus}
            className="sm:w-full lg:w-auto"
          />

          <Button
            type="button"
            variant="ghost"
            className={cn(
              COMMS_CONTROL_HEIGHT_CLASS,
              'w-full sm:col-span-2 sm:w-auto sm:justify-self-start',
            )}
            onClick={onClear}
            aria-label="Clear all filters"
          >
            <X data-icon="inline-start" aria-hidden />
            Clear
          </Button>
        </div>
      }
    >
      <div role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={searchField}
          onValueChange={(value) => onSearchFieldChange(value as OpsEmailDeliverySearchField)}
        >
          <SelectTrigger
            className={cn(COMMS_FILTER_CONTROL_CLASS, 'sm:w-auto sm:min-w-[150px] max-w-full')}
            aria-label="Search field"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(SEARCH_FIELD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            name="emailDeliverySearch"
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
            placeholder={SEARCH_FIELD_PLACEHOLDERS[searchField]}
            className={cn(COMMS_CONTROL_HEIGHT_CLASS, 'pl-9')}
            aria-label="Search email delivery attempts"
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmitSearch();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onSubmitSearch}
          className={cn(COMMS_CONTROL_HEIGHT_CLASS, 'w-full sm:w-auto')}
          aria-label="Search"
        >
          Search
        </Button>
      </div>
    </OpsPageToolbar>
  );
}
