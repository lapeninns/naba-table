import { describe, expect, it } from 'vitest';

import {
  SETTINGS_ASIDE_CLASS,
  SETTINGS_ASIDE_GRID_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
  SETTINGS_INLINE_LINK_CLASS,
  SETTINGS_SAVE_COPY,
  SETTINGS_TABS_TRIGGER_CLASS,
  SETTINGS_TOUCH_CONTROL_CLASS,
  SETTINGS_TOUCH_CONTROL_SCOPE_CLASS,
  SETTINGS_TOUCH_ICON_BUTTON_CLASS,
  SETTINGS_SAVE_BAR_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS,
} from '@/components/features/restaurant-settings/shared';

describe('compactSettingsClasses', () => {
  it('@contract defines the shared aside grid, inline link and discard copy', () => {
    expect(SETTINGS_ASIDE_GRID_CLASS).toBe(
      'grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]',
    );
    expect(SETTINGS_ASIDE_CLASS).toBe('flex min-w-0 flex-col gap-4 xl:sticky xl:top-4');
    expect(SETTINGS_INLINE_LINK_CLASS).toBe(
      'font-medium text-primary underline-offset-4 hover:underline',
    );
    expect(SETTINGS_SAVE_COPY.discarded).toBe('Changes discarded.');
  });

  it('@contract builds tab triggers from the rail item recipe with a primary active underline', () => {
    expect(SETTINGS_TABS_TRIGGER_CLASS.startsWith(SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS)).toBe(
      true,
    );
    expect(SETTINGS_TABS_TRIGGER_CLASS).toContain('data-[state=active]:border-primary');
    expect(SETTINGS_TABS_TRIGGER_CLASS).toContain('shrink-0');
  });

  it('@a11y scopes 44px touch sizes to coarse pointers only (RR3)', () => {
    expect(SETTINGS_TOUCH_CONTROL_CLASS).toBe('[@media(pointer:coarse)]:min-h-11');
    expect(SETTINGS_TOUCH_ICON_BUTTON_CLASS).toContain('[@media(pointer:coarse)]:size-11');
    for (const token of SETTINGS_TOUCH_CONTROL_SCOPE_CLASS.split(' ')) {
      expect(token.startsWith('[@media(pointer:coarse)]:')).toBe(true);
    }
    // Visually hidden and non-text inputs are never enlarged.
    expect(SETTINGS_TOUCH_CONTROL_SCOPE_CLASS).toContain(':not(.sr-only):not([type=file])');
  });

  it('@contract tightens the docked rail and save bar on short landscape phones (RR7)', () => {
    expect(SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS).toContain('[@media(max-height:500px)]:py-0');
    expect(SETTINGS_SAVE_BAR_CLASS).toContain('[@media(max-height:500px)]:py-1.5');
    expect(SETTINGS_SAVE_BAR_CLASS).toContain('[@media(max-height:500px)]:flex-row');
  });
});
