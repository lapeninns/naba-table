'use client';

import { Plus } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { menuErrorReasonCode } from './menuMutationFeedback';

import type { MenuKind } from '@/server/menu-hierarchy/types';

type PreferredMenuKind = Extract<MenuKind, 'food' | 'drinks'>;

export function SelectRestaurantMenuState() {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-6">
        <OpsEmptyState
          title="Select a restaurant"
          description="Choose an active restaurant before editing its menu structure."
        />
      </CardContent>
    </Card>
  );
}

export function MenuLoadErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  const code = menuErrorReasonCode(error);
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-6">
        <OpsEmptyState
          title="Menus could not be loaded"
          description={
            code
              ? `Your saved menus are unchanged. Reason code ${code}.`
              : 'Your saved menus are unchanged. Check your connection and try again.'
          }
          action={
            <Button type="button" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

export function MenuLoadingState() {
  return (
    <Card className="border-border/70 shadow-none" aria-busy="true">
      <CardContent className="flex flex-col gap-3 p-5">
        <span className="sr-only" role="status">
          Loading menus…
        </span>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </CardContent>
    </Card>
  );
}

export function EmptyMenuState({ onCreateMenu }: { readonly onCreateMenu: () => void }) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-6">
        <OpsEmptyState
          title="No menus yet"
          description="Create a menu, add sections such as Starters or Wine, then add items."
          action={
            <Button type="button" onClick={onCreateMenu}>
              <Plus data-icon="inline-start" aria-hidden />
              Create menu
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

export function EmptyPreferredMenuState({
  onCreateMenu,
  preferredMenuKind,
}: {
  readonly onCreateMenu: () => void;
  readonly preferredMenuKind: PreferredMenuKind;
}) {
  const menuLabel = preferredMenuKind === 'drinks' ? 'drinks' : 'food';

  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-6">
        <OpsEmptyState
          title={`No ${menuLabel} menu yet`}
          description={`Create a ${menuLabel} menu, add sections, then add items. Mixed menus show under both food and drinks.`}
          action={
            <Button type="button" onClick={onCreateMenu}>
              <Plus data-icon="inline-start" aria-hidden />
              Create {menuLabel} menu
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
