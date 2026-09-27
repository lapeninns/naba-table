'use client';

import { Plus } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_CARD_CONTENT_CLASS,
  SETTINGS_CARD_HEADER_CLASS,
  SettingsLoadErrorAlert,
  SettingsNoRestaurantState,
} from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { MenuKind } from '@/server/menu-hierarchy/types';

type PreferredMenuKind = Extract<MenuKind, 'food' | 'drinks'>;

export const MENU_LOAD_ERROR_TITLE = 'Couldn’t load menus';

export function SelectRestaurantMenuState() {
  return <SettingsNoRestaurantState task="edit its menus" />;
}

export function MenuLoadErrorState({
  error,
  onRetry,
  retrying,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
  readonly retrying?: boolean;
}) {
  return (
    <SettingsLoadErrorAlert
      title={MENU_LOAD_ERROR_TITLE}
      error={error}
      onRetry={onRetry}
      retrying={retrying}
      message="Your saved menus are unchanged."
    />
  );
}

/** Placeholder shaped like the selected-menu card, so the loaded menu does not jump. */
export function MenuLoadingState() {
  return (
    <Card variant="compact" className={SETTINGS_CARD_CLASS} role="status" aria-busy="true">
      <span className="sr-only">Loading menus…</span>
      <div className={cn(SETTINGS_CARD_HEADER_CLASS, 'flex flex-col gap-2')}>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className={cn(SETTINGS_CARD_CONTENT_CLASS, 'flex flex-col gap-3')}>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    </Card>
  );
}

export function EmptyMenuState({ onCreateMenu }: { readonly onCreateMenu: () => void }) {
  return (
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
  );
}
