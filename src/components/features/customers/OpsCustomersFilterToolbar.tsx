'use client';

import { Loader2, Search, X } from 'lucide-react';

import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/typography';

import {
  LAST_VISIT_OPTIONS,
  MARKETING_OPTIONS,
  MIN_BOOKINGS_OPTIONS,
  SORT_OPTIONS,
} from './opsCustomersTypes';

import type {
  LastVisitFilter,
  MarketingFilter,
  OpsCustomersFilterBadge,
  SortOption,
} from './opsCustomersTypes';

type OpsCustomersFilterToolbarProps = {
  activeFilterBadges: OpsCustomersFilterBadge[];
  hasActiveFilters: boolean;
  isRefreshing: boolean;
  lastVisit: LastVisitFilter;
  marketingOptIn: MarketingFilter;
  minBookings: number;
  searchTerm: string;
  sortOption: SortOption;
  onClearFilterBadge: (key: OpsCustomersFilterBadge['key']) => void;
  onClearFilters: () => void;
  onLastVisitChange: (value: LastVisitFilter) => void;
  onMarketingOptInChange: (value: MarketingFilter) => void;
  onMinBookingsChange: (value: string) => void;
  onSearchTermChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
};

export function OpsCustomersFilterToolbar({
  activeFilterBadges,
  hasActiveFilters,
  isRefreshing,
  lastVisit,
  marketingOptIn,
  minBookings,
  searchTerm,
  sortOption,
  onClearFilterBadge,
  onClearFilters,
  onLastVisitChange,
  onMarketingOptInChange,
  onMinBookingsChange,
  onSearchTermChange,
  onSortChange,
}: OpsCustomersFilterToolbarProps) {
  return (
    <OpsPageToolbar
      sticky
      filters={
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              name="lastVisit"
              value={lastVisit}
              onValueChange={(value) => onLastVisitChange(value as LastVisitFilter)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[150px]">
                <SelectValue placeholder="Last visit" />
              </SelectTrigger>
              <SelectContent>
                {LAST_VISIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              name="marketingOptIn"
              value={marketingOptIn}
              onValueChange={(value) => onMarketingOptInChange(value as MarketingFilter)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[140px]">
                <SelectValue placeholder="Marketing" />
              </SelectTrigger>
              <SelectContent>
                {MARKETING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              name="minBookings"
              value={String(minBookings)}
              onValueChange={onMinBookingsChange}
            >
              <SelectTrigger className="h-9 w-full sm:w-[145px]">
                <SelectValue placeholder="Min bookings" />
              </SelectTrigger>
              <SelectContent>
                {MIN_BOOKINGS_OPTIONS.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count === 0 ? 'All bookings' : `≥ ${count} bookings`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              name="sort"
              value={sortOption}
              onValueChange={(value) => onSortChange(value as SortOption)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[165px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hasActiveFilters}
              onClick={onClearFilters}
            >
              <X className="mr-1 size-4" aria-hidden />
              Clear
            </Button>
          </div>
        </div>
      }
      search={
        <div className="relative w-full md:w-72 md:flex-none">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            name="search"
            value={searchTerm}
            onChange={(event) => {
              onSearchTermChange(event.target.value);
            }}
            placeholder="Search guests…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 touch-manipulation"
            aria-label="Search guests"
            autoComplete="off"
          />
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {activeFilterBadges.length > 0 ? (
          activeFilterBadges.map((badge) => (
            <Badge key={badge.key} variant="secondary" className="flex items-center gap-1 py-1">
              <span>{badge.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-5 rounded-full p-0 text-muted-foreground hover:bg-background/60"
                onClick={() => onClearFilterBadge(badge.key)}
                aria-label={`Remove ${badge.label} filter`}
              >
                <X aria-hidden />
              </Button>
            </Badge>
          ))
        ) : (
          <Text as="span" variant="caption">
            Tip: search + min bookings to surface VIP guests fast.
          </Text>
        )}

        {isRefreshing ? (
          <Text as="span" variant="caption" className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Updating results…
          </Text>
        ) : null}
      </div>
    </OpsPageToolbar>
  );
}
