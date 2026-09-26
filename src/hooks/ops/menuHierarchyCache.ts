/**
 * Pure updates of the cached menu hierarchy (`{ menus }`), applied with `setQueryData` from the
 * canonical entity a mutation returns, or optimistically for reorder. Every helper returns a new
 * object and leaves the input untouched.
 */
import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
  MenuReorderTarget,
} from '@/server/menu-hierarchy/types';

export type MenuHierarchyData = { menus: CanonicalRestaurantMenu[] };

type Ordered = { id?: string; displayOrder: number };

function byDisplayOrder<T extends Ordered>(entries: readonly T[]): T[] {
  return [...entries].sort((left, right) => left.displayOrder - right.displayOrder);
}

function upsertById<T extends Ordered>(
  entries: readonly T[],
  entry: T,
  merge: (existing: T, next: T) => T = (_existing, next) => next,
): T[] {
  const index = entries.findIndex((candidate) => candidate.id === entry.id);
  if (index === -1) return byDisplayOrder([...entries, entry]);
  const next = [...entries];
  next[index] = merge(entries[index]!, entry);
  return byDisplayOrder(next);
}

function mapMenu(
  data: MenuHierarchyData,
  menuId: string,
  update: (menu: CanonicalRestaurantMenu) => CanonicalRestaurantMenu,
): MenuHierarchyData {
  return { ...data, menus: data.menus.map((menu) => (menu.id === menuId ? update(menu) : menu)) };
}

function mapSection(
  data: MenuHierarchyData,
  menuId: string,
  sectionId: string,
  update: (section: CanonicalRestaurantMenuSection) => CanonicalRestaurantMenuSection,
): MenuHierarchyData {
  return mapMenu(data, menuId, (menu) => ({
    ...menu,
    sections: menu.sections.map((section) =>
      section.id === sectionId ? update(section) : section,
    ),
  }));
}

function mapItem(
  data: MenuHierarchyData,
  menuId: string,
  sectionId: string,
  itemId: string,
  update: (item: CanonicalRestaurantMenuItem) => CanonicalRestaurantMenuItem,
): MenuHierarchyData {
  return mapSection(data, menuId, sectionId, (section) => ({
    ...section,
    items: section.items.map((item) => (item.id === itemId ? update(item) : item)),
  }));
}

/** Menu responses carry no sections: keep the cached ones. */
export function upsertMenu(data: MenuHierarchyData, menu: CanonicalRestaurantMenu) {
  return {
    ...data,
    menus: upsertById(data.menus, menu, (existing, next) => ({
      ...next,
      sections: existing.sections,
    })),
  };
}

export function removeMenu(data: MenuHierarchyData, menuId: string): MenuHierarchyData {
  return { ...data, menus: data.menus.filter((menu) => menu.id !== menuId) };
}

/** Section responses carry no items: keep the cached ones. */
export function upsertSection(
  data: MenuHierarchyData,
  menuId: string,
  section: CanonicalRestaurantMenuSection,
): MenuHierarchyData {
  return mapMenu(data, menuId, (menu) => ({
    ...menu,
    sections: upsertById(menu.sections, section, (existing, next) => ({
      ...next,
      items: existing.items,
    })),
  }));
}

export function removeSection(
  data: MenuHierarchyData,
  menuId: string,
  sectionId: string,
): MenuHierarchyData {
  return mapMenu(data, menuId, (menu) => ({
    ...menu,
    sections: menu.sections.filter((section) => section.id !== sectionId),
  }));
}

/** Item responses are canonical, including options and extensions. */
export function upsertItem(
  data: MenuHierarchyData,
  menuId: string,
  sectionId: string,
  item: CanonicalRestaurantMenuItem,
): MenuHierarchyData {
  return mapSection(data, menuId, sectionId, (section) => ({
    ...section,
    items: upsertById(section.items, item),
  }));
}

export function removeItem(
  data: MenuHierarchyData,
  menuId: string,
  sectionId: string,
  itemId: string,
): MenuHierarchyData {
  return mapSection(data, menuId, sectionId, (section) => ({
    ...section,
    items: section.items.filter((item) => item.id !== itemId),
  }));
}

export function upsertOption(
  data: MenuHierarchyData,
  menuId: string,
  sectionId: string,
  itemId: string,
  option: CanonicalRestaurantMenuOption,
): MenuHierarchyData {
  return mapItem(data, menuId, sectionId, itemId, (item) => ({
    ...item,
    options: upsertById(item.options, option),
  }));
}

export function removeOption(
  data: MenuHierarchyData,
  menuId: string,
  sectionId: string,
  itemId: string,
  optionId: string,
): MenuHierarchyData {
  return mapItem(data, menuId, sectionId, itemId, (item) => ({
    ...item,
    options: item.options.filter((option) => option.id !== optionId),
  }));
}

function applyOrder<T extends Ordered>(entries: readonly T[], orderedIds: readonly string[]): T[] {
  const position = new Map(orderedIds.map((id, index) => [id, index]));
  const known = entries.filter((entry) => entry.id && position.has(entry.id));
  const unknown = entries.filter((entry) => !entry.id || !position.has(entry.id));
  return [
    ...known
      .sort((left, right) => position.get(left.id!)! - position.get(right.id!)!)
      .map((entry, index) => ({ ...entry, displayOrder: index })),
    ...unknown.map((entry, index) => ({ ...entry, displayOrder: known.length + index })),
  ];
}

/** Renumbers one parent's children 0..n-1 in `orderedIds` order (optimistic reorder). */
export function applyChildOrder(
  data: MenuHierarchyData,
  target: MenuReorderTarget,
  orderedIds: readonly string[],
): MenuHierarchyData {
  switch (target.level) {
    case 'sections':
      return mapMenu(data, target.menuId, (menu) => ({
        ...menu,
        sections: applyOrder(menu.sections, orderedIds),
      }));
    case 'items':
      return mapSection(data, target.menuId, target.sectionId, (section) => ({
        ...section,
        items: applyOrder(section.items, orderedIds),
      }));
    case 'options':
      return mapItem(data, target.menuId, target.sectionId, target.itemId, (item) => ({
        ...item,
        options: applyOrder(item.options, orderedIds),
      }));
  }
}

/** One parent's children as `{ id, displayOrder }`, in display order (reorder rollback). */
export type ChildOrderSnapshot = ReadonlyArray<{ id: string; displayOrder: number }>;

function snapshotOrder(entries: readonly Ordered[]): ChildOrderSnapshot {
  return byDisplayOrder(entries).flatMap((entry) =>
    entry.id ? [{ id: entry.id, displayOrder: entry.displayOrder }] : [],
  );
}

/** Reads the current order of the reorder target's children; undefined if the parent is gone. */
export function readChildOrder(
  data: MenuHierarchyData,
  target: MenuReorderTarget,
): ChildOrderSnapshot | undefined {
  const menu = data.menus.find((candidate) => candidate.id === target.menuId);
  if (!menu) return undefined;
  if (target.level === 'sections') return snapshotOrder(menu.sections);
  const section = menu.sections.find((candidate) => candidate.id === target.sectionId);
  if (!section) return undefined;
  if (target.level === 'items') return snapshotOrder(section.items);
  const item = section.items.find((candidate) => candidate.id === target.itemId);
  return item ? snapshotOrder(item.options) : undefined;
}

function restoreOrder<T extends Ordered>(entries: readonly T[], snapshot: ChildOrderSnapshot): T[] {
  const saved = new Map(snapshot.map((entry) => [entry.id, entry.displayOrder]));
  return byDisplayOrder(
    entries.map((entry) => {
      const displayOrder = entry.id ? saved.get(entry.id) : undefined;
      return displayOrder === undefined ? entry : { ...entry, displayOrder };
    }),
  );
}

/**
 * Puts back one parent's children order from {@link readChildOrder}, leaving every other part of
 * the hierarchy (including other reorders still in flight) untouched.
 */
export function restoreChildOrder(
  data: MenuHierarchyData,
  target: MenuReorderTarget,
  snapshot: ChildOrderSnapshot,
): MenuHierarchyData {
  switch (target.level) {
    case 'sections':
      return mapMenu(data, target.menuId, (menu) => ({
        ...menu,
        sections: restoreOrder(menu.sections, snapshot),
      }));
    case 'items':
      return mapSection(data, target.menuId, target.sectionId, (section) => ({
        ...section,
        items: restoreOrder(section.items, snapshot),
      }));
    case 'options':
      return mapItem(data, target.menuId, target.sectionId, target.itemId, (item) => ({
        ...item,
        options: restoreOrder(item.options, snapshot),
      }));
  }
}
