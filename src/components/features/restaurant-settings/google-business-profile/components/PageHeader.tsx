'use client';

import { ExternalLink, MoreHorizontal, RefreshCcw, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { StatusBadge, connectionStatusBadge } from './StatusBadge';
import { formatLastSync } from '../lib/formatters';


import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

type PageHeaderProps = {
  status: GoogleBusinessProfileConnection['status'];
  lastPullAt: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  manageOnGoogleHref: string | null;
  canDisconnect: boolean;
  onDisconnect: () => void;
  isDisconnecting: boolean;
};

export function PageHeader({
  status,
  lastPullAt,
  onRefresh,
  isRefreshing,
  manageOnGoogleHref,
  canDisconnect,
  onDisconnect,
  isDisconnecting,
}: PageHeaderProps) {
  const badge = connectionStatusBadge(status);
  const showOverflow = Boolean(manageOnGoogleHref) || canDisconnect;

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Google Business Profile
          </h1>
          <StatusBadge tone={badge.tone} label={badge.label} />
        </div>
        <p className="text-sm text-muted-foreground">
          Last sync: <span className="text-foreground">{formatLastSync(lastPullAt)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCcw className={cn('mr-2 size-4', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>

        {showOverflow ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="More actions"
                className="px-2"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {manageOnGoogleHref ? (
                <DropdownMenuItem asChild>
                  <a href={manageOnGoogleHref} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 size-4" />
                    Manage on Google
                  </a>
                </DropdownMenuItem>
              ) : null}
              {manageOnGoogleHref && canDisconnect ? <DropdownMenuSeparator /> : null}
              {canDisconnect ? (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    onDisconnect();
                  }}
                  disabled={isDisconnecting}
                  className="text-red-600 focus:text-red-700"
                >
                  <Unplug className="mr-2 size-4" />
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect Google'}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
