'use client';

import { Filter, Search, X } from 'lucide-react';
import { useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';
import { EMAIL_DELIVERY_STATUS_LABELS } from '@src/lib/email-delivery/presentation';

import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type SearchField = 'recipientEmail' | 'messageId' | 'bookingRef';

export const SEARCH_FIELD_LABELS: Record<SearchField, string> = {
  recipientEmail: 'Email',
  messageId: 'Message ID',
  bookingRef: 'Booking Ref',
};

export const SEARCH_FIELD_PLACEHOLDERS: Record<SearchField, string> = {
  recipientEmail: 'guest@example.com',
  messageId: 'msg-xxxx-xxxx',
  bookingRef: 'ABC123',
};

export const TEMPLATE_TYPE_OPTIONS = [
  'booking_confirmation',
  'request_received',
  'confirmation',
  'booking_update',
  'booking_cancellation',
  'booking_rejected',
  'restaurant_cancellation',
  'review_request',
  'reminder_24h',
  'reminder_short',
] as const;

export const EMAIL_TYPE_OPTIONS = [
  'booking_confirmation',
  'request_received',
  'confirmation',
  'created',
  'updated',
  'cancelled',
  'review_request',
  'reminder',
  'booking_rejected',
  'restaurant_cancellation',
] as const;

export type OpsEmailDeliveryFilterBarProps = {
  searchField: SearchField;
  searchValue: string;
  onSearchFieldChange: (field: SearchField) => void;
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

const STATUS_BADGE_COLORS: Record<EmailDeliveryStatus, string> = {
  sent: 'border-slate-200 bg-slate-50 text-slate-700',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  delivery_delayed: 'border-amber-200 bg-amber-50 text-amber-700',
  bounced: 'border-rose-200 bg-rose-50 text-rose-700',
  complained: 'border-rose-200 bg-rose-50 text-rose-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function OpsEmailDeliveryFilterBar({
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
}: OpsEmailDeliveryFilterBarProps) {
  const handleRangeChange = useCallback(
    (value: string) => {
      if (value !== '24h' && value !== '7d' && value !== '30d') return;
      const next = value as OpsEmailDeliveryRange;
      if (next === range) return;
      onRangeChange(next);
    },
    [onRangeChange, range],
  );

  return (
    <div className="space-y-3">
      {/* Row 1: Search field selector + input + Search button */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={searchField}
          onValueChange={(value) => onSearchFieldChange(value as SearchField)}
        >
          <SelectTrigger className="w-full sm:w-[150px]" aria-label="Search field">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recipientEmail">Email</SelectItem>
            <SelectItem value="messageId">Message ID</SelectItem>
            <SelectItem value="bookingRef">Booking Ref</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchValueChange(e.target.value)}
              placeholder={SEARCH_FIELD_PLACEHOLDERS[searchField]}
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
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

      {/* Row 2: Range toggle + Template/Email type selects + Status multi-select + Clear */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={handleRangeChange}
          className="justify-start"
          aria-label="Select time range"
        >
          <ToggleGroupItem value="24h" aria-label="Last 24 hours" className="text-xs px-3">
            24h
          </ToggleGroupItem>
          <ToggleGroupItem value="7d" aria-label="Last 7 days" className="text-xs px-3">
            7d
          </ToggleGroupItem>
          <ToggleGroupItem value="30d" aria-label="Last 30 days" className="text-xs px-3">
            30d
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="hidden sm:block h-6 w-px bg-border" aria-hidden />

        {/* Template type dropdown */}
        <Select
          value={templateType ?? '__all__'}
          onValueChange={(value) =>
            onTemplateTypeChange(value === '__all__' ? null : value)
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by template type">
            <SelectValue placeholder="Template type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All templates</SelectItem>
            {TEMPLATE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Email type dropdown */}
        <Select
          value={emailType ?? '__all__'}
          onValueChange={(value) =>
            onEmailTypeChange(value === '__all__' ? null : value)
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by email type">
            <SelectValue placeholder="Email type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {EMAIL_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="hidden sm:block h-6 w-px bg-border" aria-hidden />

        {/* Status multi-select popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" aria-label="Filter by status">
              <Filter className="h-4 w-4" aria-hidden />
              Status
              {statuses.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {statuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Filter by status</p>
            <div className="space-y-2">
              {EMAIL_DELIVERY_STATUS_VALUES.map((status) => {
                const checked = statuses.includes(status);
                const count = statusCounts?.[status];
                return (
                  <label
                    key={status}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(val) => onToggleStatus(status, Boolean(val))}
                      aria-label={EMAIL_DELIVERY_STATUS_LABELS[status]}
                    />
                    <Badge
                      variant="outline"
                      className={cn('text-[11px] px-1.5 py-0', STATUS_BADGE_COLORS[status])}
                    >
                      {EMAIL_DELIVERY_STATUS_LABELS[status]}
                    </Badge>
                    {typeof count === 'number' && (
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {count}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear button */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onClear}
          aria-label="Clear all filters"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  );
}
