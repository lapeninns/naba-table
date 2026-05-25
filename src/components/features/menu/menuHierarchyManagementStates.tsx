'use client';

import { Plus } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import type { MenuKind } from '@/server/menu-hierarchy/types';

type PreferredMenuKind = Extract<MenuKind, 'food' | 'drinks'>;

export function SelectRestaurantMenuState() {
  return (
    <Card className="border-border/70 shadow-sm">
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
  errorMessage,
  onRetry,
}: {
  readonly errorMessage: string;
  readonly onRetry: () => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-6">
        <OpsEmptyState
          title="Unable to load menus"
          description={errorMessage}
          action={
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

export function MenuLoadingState() {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5 text-sm text-muted-foreground">Loading menus...</CardContent>
    </Card>
  );
}

export function EmptyMenuState({ onCreateMenu }: { readonly onCreateMenu: () => void }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-6">
        <OpsEmptyState
          title="No menus yet"
          description="Create the first menu for this restaurant."
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
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-6">
        <OpsEmptyState
          title={`No ${menuLabel} menu`}
          description={`Create a ${menuLabel} menu before editing sections and items.`}
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
