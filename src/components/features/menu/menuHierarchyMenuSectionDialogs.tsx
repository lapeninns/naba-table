'use client';

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { SettingsDialog } from '@/components/features/restaurant-settings/shared/SettingsDialog';
import { useSettingsDiscardGuard } from '@/components/features/restaurant-settings/shared/useSettingsDiscardGuard';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
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
  primaryLabel,
  sectionInitialState,
  type MenuFormState,
  type SectionFormState,
} from './menuHierarchyDomain';
import { DialogFooterActions } from './menuHierarchyFormControls';
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
  const formId = useId();
  const [state, setState] = useState<MenuFormState>(() => menuInitialState(menu, defaultMenuKind));
  const createMenu = useOpsCreateRestaurantMenu(restaurantId);
  const updateMenu = useOpsUpdateRestaurantMenu(restaurantId);
  const { reset: resetCreate } = createMenu;
  const { reset: resetUpdate } = updateMenu;

  useEffect(() => {
    if (!mode) return;
    setState(menuInitialState(menu, defaultMenuKind));
    // A new session of the dialog never shows the previous attempt's error.
    resetCreate();
    resetUpdate();
  }, [defaultMenuKind, menu, mode, resetCreate, resetUpdate]);

  const initial = useMemo(() => menuInitialState(menu, defaultMenuKind), [defaultMenuKind, menu]);
  const isDirty = Boolean(mode) && JSON.stringify(state) !== JSON.stringify(initial);
  const { guardOpenChange } = useSettingsDiscardGuard('menu-dialog', isDirty);
  const requestOpenChange = guardOpenChange(onOpenChange);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildMenuPayload(state);
    try {
      if (mode === 'edit' && menu?.id) {
        await updateMenu.mutateAsync({ menuId: menu.id, payload });
      } else {
        await createMenu.mutateAsync(payload);
      }
    } catch {
      // The mutation error renders beside the save action; the dialog keeps the draft.
      return;
    }
    const savedName = state.displayName.trim() || 'Menu';
    toast.success(mode === 'edit' ? `${savedName} saved.` : `${savedName} created.`);
    onOpenChange(false);
  };

  const pending = createMenu.isPending || updateMenu.isPending;
  const error = createMenu.error ?? updateMenu.error;

  return (
    <SettingsDialog
      open={Boolean(mode)}
      onOpenChange={requestOpenChange}
      size="lg"
      testId="menu-dialog"
      title={mode === 'edit' ? 'Menu settings' : 'New menu'}
      description="Saves when you select Save menu. Publishing to Google happens separately."
      footer={
        <DialogFooterActions error={error}>
          <Button type="button" variant="outline" onClick={() => requestOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? 'Saving…' : mode === 'edit' ? 'Save menu' : 'Create menu'}
          </Button>
        </DialogFooterActions>
      }
    >
      <FormRoot id={formId} className="flex flex-col gap-4" onSubmit={submit}>
        <MenuDialogFields setState={setState} state={state} />
      </FormRoot>
    </SettingsDialog>
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
  const formId = useId();
  const [state, setState] = useState<SectionFormState>(() => sectionInitialState(section));
  const createSection = useOpsCreateRestaurantMenuSection(restaurantId);
  const updateSection = useOpsUpdateRestaurantMenuSection(restaurantId);
  const { reset: resetCreate } = createSection;
  const { reset: resetUpdate } = updateSection;

  useEffect(() => {
    if (!mode) return;
    setState(sectionInitialState(section));
    resetCreate();
    resetUpdate();
  }, [mode, section, resetCreate, resetUpdate]);

  const initial = useMemo(() => sectionInitialState(section), [section]);
  const isDirty = Boolean(mode) && JSON.stringify(state) !== JSON.stringify(initial);
  const { guardOpenChange } = useSettingsDiscardGuard('menu-section-dialog', isDirty);
  const requestOpenChange = guardOpenChange(onOpenChange);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!menu?.id) return;
    try {
      if (mode === 'edit' && section?.id) {
        await updateSection.mutateAsync({
          menuId: menu.id,
          sectionId: section.id,
          payload: buildSectionPayload(state),
        });
      } else {
        // The server appends the new section (display order max + 1).
        await createSection.mutateAsync({ menuId: menu.id, payload: buildSectionPayload(state) });
      }
    } catch {
      return;
    }
    const savedName = state.displayName.trim() || 'Section';
    toast.success(mode === 'edit' ? `${savedName} saved.` : `${savedName} added.`);
    onOpenChange(false);
  };

  const pending = createSection.isPending || updateSection.isPending;
  const error = createSection.error ?? updateSection.error;

  return (
    <SettingsDialog
      open={Boolean(mode)}
      onOpenChange={requestOpenChange}
      size="md"
      testId="menu-section-dialog"
      title={
        mode === 'edit' && section ? `Edit ${primaryLabel(section, 'section')}` : 'Add section'
      }
      description="Saves when you select Save section. Publishing to Google happens separately."
      footer={
        <DialogFooterActions error={error}>
          <Button type="button" variant="outline" onClick={() => requestOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending || !menu}>
            {pending ? 'Saving…' : mode === 'edit' ? 'Save section' : 'Add section'}
          </Button>
        </DialogFooterActions>
      }
    >
      <FormRoot id={formId} className="flex flex-col gap-4" onSubmit={submit}>
        <SectionDialogFields setState={setState} state={state} />
      </FormRoot>
    </SettingsDialog>
  );
}
