import { describe, expect, it } from 'vitest';

import { movedIds } from '@/components/features/menu/menuHierarchyOrder';
import {
  applyChildOrder,
  readChildOrder,
  restoreChildOrder,
  upsertMenu,
  upsertOption,
  type MenuHierarchyData,
} from '@src/hooks/ops/menuHierarchyCache';

function hierarchy(): MenuHierarchyData {
  return {
    menus: [
      {
        id: 'menu-1',
        displayOrder: 0,
        sections: [
          {
            id: 'section-1',
            displayOrder: 0,
            items: [
              {
                id: 'item-1',
                displayOrder: 0,
                options: [
                  { id: 'opt-1', displayOrder: 0 },
                  { id: 'opt-2', displayOrder: 1 },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as MenuHierarchyData;
}

describe('menuHierarchyCache', () => {
  it('restoreChildOrder puts back one parent exactly, leaving other parents untouched', () => {
    const target = {
      level: 'options',
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
    } as const;
    const base = hierarchy();
    base.menus[0]!.sections[0]!.items[0]!.options[1]!.displayOrder = 7;
    const snapshot = readChildOrder(base, target);
    expect(snapshot).toEqual([
      { id: 'opt-1', displayOrder: 0 },
      { id: 'opt-2', displayOrder: 7 },
    ]);

    const reordered = applyChildOrder(base, target, ['opt-2', 'opt-1']);
    const withOtherChange = applyChildOrder(reordered, { level: 'sections', menuId: 'menu-1' }, [
      'section-1',
    ]);
    const restored = restoreChildOrder(withOtherChange, target, snapshot!);

    expect(
      restored.menus[0]!.sections[0]!.items[0]!.options.map((o) => [o.id, o.displayOrder]),
    ).toEqual([
      ['opt-1', 0],
      ['opt-2', 7],
    ]);
    expect(restored.menus[0]!.sections).not.toBe(base.menus[0]!.sections);
    expect(readChildOrder(base, { level: 'items', menuId: 'menu-1', sectionId: 'gone' })).toBe(
      undefined,
    );
  });

  it('movedIds swaps neighbours and refuses out-of-range moves', () => {
    const entries = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(movedIds(entries, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(movedIds(entries, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(movedIds(entries, 0, -1)).toBeNull();
    expect(movedIds(entries, 2, 1)).toBeNull();
    expect(movedIds([{ id: 'a' }, {}], 0, 1)).toBeNull();
  });

  it('applyChildOrder renumbers options 0..n-1 and does not mutate the input', () => {
    const data = hierarchy();
    const next = applyChildOrder(
      data,
      { level: 'options', menuId: 'menu-1', sectionId: 'section-1', itemId: 'item-1' },
      ['opt-2', 'opt-1'],
    );

    expect(
      next.menus[0]!.sections[0]!.items[0]!.options.map((o) => [o.id, o.displayOrder]),
    ).toEqual([
      ['opt-2', 0],
      ['opt-1', 1],
    ]);
    expect(data.menus[0]!.sections[0]!.items[0]!.options[0]!.id).toBe('opt-1');
  });

  it('upsertMenu keeps cached sections because menu responses carry none', () => {
    const next = upsertMenu(hierarchy(), {
      id: 'menu-1',
      displayOrder: 0,
      active: false,
      sections: [],
    } as never);

    expect(next.menus[0]!.active).toBe(false);
    expect(next.menus[0]!.sections).toHaveLength(1);
  });

  it('upsertOption appends a new option in display order', () => {
    const next = upsertOption(hierarchy(), 'menu-1', 'section-1', 'item-1', {
      id: 'opt-3',
      displayOrder: 2,
    } as never);

    expect(next.menus[0]!.sections[0]!.items[0]!.options.map((o) => o.id)).toEqual([
      'opt-1',
      'opt-2',
      'opt-3',
    ]);
  });
});
