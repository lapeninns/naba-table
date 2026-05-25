'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import type { OpsEmailDeliveryState } from '@/components/features/email-delivery/useOpsEmailDeliveryState';

type RefreshOption = 'off' | '30s' | '1m' | '5m';

export function OpsEmailDeliveryNoAccessState() {
  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
        <OpsEmptyState
          title="No restaurant access yet"
          description="Ask an owner or manager to send you an invitation so you can manage bookings."
          action={
            <Button asChild variant="secondary">
              <Link href={opsHref('/dashboard')} prefetch={false}>
                Return to ops home
              </Link>
            </Button>
          }
        />
      </section>
    </OpsPageShell>
  );
}

export function OpsEmailDeliveryHeader({ state }: { state: OpsEmailDeliveryState }) {
  return (
    <OpsPageHeader
      title="Email Delivery"
      subtitle="Deliverability dashboard for booking emails (Resend)."
      meta={
        <div className="flex flex-wrap items-center gap-2">
          {state.availableRestaurants.length > 1 ? (
            <Select
              value={state.effectiveRestaurantId ?? ''}
              onValueChange={state.handleRestaurantChange}
            >
              <SelectTrigger className="h-8 w-full sm:w-[240px]" aria-label="Restaurant switcher">
                <SelectValue placeholder="Select restaurant" />
              </SelectTrigger>
              <SelectContent>
                {state.availableRestaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : state.restaurantDetails.data ? (
            <Badge variant="outline" className="text-xs">
              {state.restaurantDetails.data.name}
            </Badge>
          ) : null}
          <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
            {state.timezone}
          </Badge>
        </div>
      }
      secondaryActions={
        <Button asChild variant="outline" size="sm">
          <Link href="/app/bookings" prefetch={false}>
            Go to bookings
          </Link>
        </Button>
      }
    />
  );
}

export function OpsEmailDeliveryAutoRefreshControls({ state }: { state: OpsEmailDeliveryState }) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Auto-refresh
          </div>
          <ToggleGroup
            type="single"
            value={state.queryState.refresh}
            onValueChange={(value) => {
              if (!isRefreshOption(value)) return;
              state.queryState.applyRefresh(value);
            }}
            className="justify-start rounded-full border border-border bg-background p-1"
            aria-label="Auto-refresh interval"
          >
            {(['off', '30s', '1m', '5m'] satisfies RefreshOption[]).map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className="rounded-full px-4 text-xs font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                aria-label={`Refresh every ${state.formatRefreshLabel(option)}`}
              >
                {option === 'off' ? 'Off' : state.formatRefreshLabel(option)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          {state.autoRefreshActive ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Auto-refresh {state.formatRefreshLabel(state.queryState.refresh)}
              </Badge>
              <span className="text-sm text-muted-foreground">{state.refreshIndicatorText}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Auto-refresh is off.</span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border bg-background text-foreground hover:bg-muted"
            onClick={state.handleManualRefresh}
            disabled={state.manualRefreshBusy}
            aria-label="Refresh current tab"
          >
            <RefreshCw
              data-icon="inline-start"
              className={cn(state.manualRefreshBusy && 'animate-spin')}
              aria-hidden
            />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}

function isRefreshOption(value: string): value is RefreshOption {
  return value === 'off' || value === '30s' || value === '1m' || value === '5m';
}
