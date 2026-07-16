'use client';

import { Filter, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={searchField}
          onValueChange={(value) => onSearchFieldChange(value as OpsEmailDeliverySearchField)}
        >
          <SelectTrigger className="w-full sm:w-[150px]" aria-label="Search field">
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

        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              name="emailDeliverySearch"
              value={searchValue}
              onChange={(event) => onSearchValueChange(event.target.value)}
              placeholder={SEARCH_FIELD_PLACEHOLDERS[searchField]}
              className="pl-9"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSubmitSearch();
                }
              }}
              aria-label="Search email delivery attempts"
            />
          </div>
          <Button type="button" onClick={onSubmitSearch} aria-label="Search">
            Search
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(value) => {
            if (isEmailDeliveryRange(value)) onRangeChange(value);
          }}
          className="justify-start"
          aria-label="Select time range"
        >
          {EMAIL_DELIVERY_RANGE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              aria-label={option.ariaLabel}
              className="px-3 text-xs"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Separator orientation="vertical" className="hidden h-6 sm:block" decorative />

        <Select
          value={templateType ?? '__all__'}
          onValueChange={(value) => onTemplateTypeChange(value === '__all__' ? null : value)}
        >
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by template type">
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
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by email type">
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

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" aria-label="Filter by status">
              <Filter data-icon="inline-start" aria-hidden />
              Status
              {statuses.length > 0 ? (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {statuses.length}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Filter by status</p>
            <div className="flex flex-col gap-2">
              {getEmailDeliveryStatusFilterOptions().map(({ status, label }) => {
                const checked = statuses.includes(status);
                const count = statusCounts?.[status];
                return (
                  <Label key={status} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => onToggleStatus(status, Boolean(value))}
                      aria-label={label}
                    />
                    <span className="text-sm">{label}</span>
                    {typeof count === 'number' ? (
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    ) : null}
                  </Label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear all filters">
          <X data-icon="inline-start" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  );
}
