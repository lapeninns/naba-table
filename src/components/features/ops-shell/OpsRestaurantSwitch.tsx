'use client';

import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useOpsAccountSnapshot, useOpsSession } from '@/contexts/ops-session';
import { cn } from '@/lib/utils';
import { debounce } from '@/utils/debounceThrottle';

const FALLBACK_INITIALS = 'SR';
const FALLBACK_RESTAURANT_NAME = 'Unknown restaurant';

function computeInitials(name: string | null): string {
  if (!name) {
    return FALLBACK_INITIALS;
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return FALLBACK_INITIALS;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
  }

  const capitals = trimmed.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return `${capitals[0]}${capitals[1]}`;
  }

  if (trimmed.length >= 2) {
    return `${trimmed[0]}${trimmed[trimmed.length - 1]}`.toUpperCase();
  }

  return trimmed[0]?.toUpperCase() ?? FALLBACK_INITIALS;
}

function normalizeRestaurantName(name: string | null | undefined): string {
  if (typeof name !== 'string') {
    return FALLBACK_RESTAURANT_NAME;
  }

  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_RESTAURANT_NAME;
}

type OpsRestaurantSwitchProps = {
  className?: string;
};

export function OpsRestaurantSwitch({ className }: OpsRestaurantSwitchProps) {
  const { memberships, activeMembership, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const account = useOpsAccountSnapshot();

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const updateSearch = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearch(value);
      }, 200),
    [],
  );

  const initials = useMemo(() => computeInitials(activeMembership?.restaurantName ?? account.restaurantName), [
    activeMembership?.restaurantName,
    account.restaurantName,
  ]);

  const metaLine = useMemo(() => {
    const email = account.userEmail?.trim();
    const role = activeMembership?.role ?? account.role;
    if (email && role) {
      return `${email} (${role})`;
    }
    if (email) {
      return email;
    }
    return role ?? 'Operations';
  }, [account.role, account.userEmail, activeMembership?.role]);

  const restaurantName =
    normalizeRestaurantName(
      activeMembership?.restaurantName ?? account.restaurantName ?? memberships[0]?.restaurantName,
    );

  const filteredMemberships = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return memberships;
    }

    const needle = debouncedSearch.trim().toLowerCase();
    return memberships.filter((membership) =>
      normalizeRestaurantName(membership.restaurantName).toLowerCase().includes(needle),
    );
  }, [debouncedSearch, memberships]);

  const handleSelect = (restaurantId: string) => {
    setActiveRestaurantId(restaurantId);
    setOpen(false);
    setSearchTerm('');
  };

  if (memberships.length <= 1) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-sm',
          className,
        )}
      >
        <span className="inline-flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight" title={restaurantName}>
            {restaurantName}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/70" title={metaLine ?? undefined}>
            {metaLine}
          </p>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar p-3 text-left text-sidebar-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar touch-manipulation',
            className,
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight" title={restaurantName}>
              {restaurantName}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70" title={metaLine ?? undefined}>
              {metaLine}
            </p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/80" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        className="w-64 p-0"
        sideOffset={8}
        aria-label="Switch restaurant"
        forceMount
      >
        <DropdownMenuLabel className="px-3 py-2 text-xs text-sidebar-foreground/70">Switch restaurant</DropdownMenuLabel>
        <div className="flex items-center gap-2 px-3 pb-2">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => {
              const value = event.target.value;
              setSearchTerm(value);
              updateSearch(value);
            }}
            name="restaurant-search"
            autoComplete="off"
            placeholder="Search by name…"
            className="h-8 border-0 bg-transparent px-0 text-sm text-foreground shadow-none focus-visible:ring-0"
            aria-label="Search restaurants"
          />
        </div>
        <DropdownMenuSeparator />
        <div role="listbox" aria-activedescendant={activeRestaurantId ?? undefined} className="max-h-64 overflow-y-auto">
          {filteredMemberships.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">No matches. Try a different search.</div>
          ) : (
            filteredMemberships.map((membership) => {
              const selected = membership.restaurantId === activeRestaurantId;
              return (
                <DropdownMenuItem
                  key={membership.restaurantId}
                  onSelect={(event) => {
                    event.preventDefault();
                    handleSelect(membership.restaurantId);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground focus:text-foreground"
                  aria-selected={selected}
                  data-active={selected ? '' : undefined}
                  role="option"
                  id={membership.restaurantId}
                >
                  <Check
                    className={cn('size-4 shrink-0 text-sidebar-primary', selected ? 'opacity-100' : 'opacity-0')}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">
                    {normalizeRestaurantName(membership.restaurantName)}
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {membership.role}
                  </Badge>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
