'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormRoot } from '@/components/ui/form';
import { Text } from '@/components/ui/typography';
import {
  useOpsCreateRestaurantMenu,
  useOpsCreateRestaurantMenuSection,
  useOpsUpdateRestaurantMenu,
  useOpsUpdateRestaurantMenuSection,
} from '@/hooks/ops/useOpsMenuHierarchy';

import {
  buildMenuPayload,
  buildSectionPayload,
  menuInitialState,
  sectionInitialState,
  type MenuFormState,
  type SectionFormState,
} from './menuHierarchyDomain';
import { MenuDialogFields, SectionDialogFields } from './menuHierarchyMenuSectionFields';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuSection,
  MenuKind,
} from '@/server/menu-hierarchy/types';

export function MenuDialog({
  restaurantId,
  mode,
  menu,
  defaultMenuKind,
  onOpenChange,
}: {
  restaurantId: string;
  mode: 'create' | 'edit' | null;
  menu: CanonicalRestaurantMenu | null;
  defaultMenuKind: MenuKind;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<MenuFormState>(() => menuInitialState(menu, defaultMenuKind));
  const createMenu = useOpsCreateRestaurantMenu(restaurantId);
  const updateMenu = useOpsUpdateRestaurantMenu({ restaurantId, menuId: menu?.id });

  useEffect(() => {
    if (mode) setState(menuInitialState(menu, defaultMenuKind));
  }, [defaultMenuKind, menu, mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildMenuPayload(state);
    if (mode === 'edit' && menu?.id) {
      await updateMenu.mutateAsync(payload);
    } else {
      await createMenu.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const pending = createMenu.isPending || updateMenu.isPending;
  const error = createMenu.error ?? updateMenu.error;

  return (
    <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit menu' : 'Create menu'}</DialogTitle>
          <DialogDescription>
            Menu details that can be published to Google live here before sections and items.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-5" onSubmit={submit}>
          <MenuDialogFields setState={setState} state={state} />
          {error ? (
            <Text variant="caption" className="text-destructive">
              {error.message}
            </Text>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save menu'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}

export function SectionDialog({
  restaurantId,
  menu,
  mode,
  section,
  onOpenChange,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu | null;
  mode: 'create' | 'edit' | null;
  section: CanonicalRestaurantMenuSection | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<SectionFormState>(() => sectionInitialState(section));
  const createSection = useOpsCreateRestaurantMenuSection({ restaurantId, menuId: menu?.id });
  const updateSection = useOpsUpdateRestaurantMenuSection({
    restaurantId,
    menuId: menu?.id,
    sectionId: section?.id,
  });

  useEffect(() => {
    if (mode) setState(sectionInitialState(section));
  }, [mode, section]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!menu) return;
    if (mode === 'edit' && section?.id) {
      await updateSection.mutateAsync(buildSectionPayload(state, section.displayOrder));
    } else {
      await createSection.mutateAsync(buildSectionPayload(state, menu.sections.length));
    }
    onOpenChange(false);
  };

  const pending = createSection.isPending || updateSection.isPending;
  const error = createSection.error ?? updateSection.error;

  return (
    <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit section' : 'Create section'}</DialogTitle>
          <DialogDescription>
            Sections replace legacy category/subcategory grouping while preserving compatibility
            labels.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-4" onSubmit={submit}>
          <SectionDialogFields setState={setState} state={state} />
          {error ? (
            <Text variant="caption" className="text-destructive">
              {error.message}
            </Text>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !menu}>
              {pending ? 'Saving...' : mode === 'edit' ? 'Save section' : 'Create section'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}
