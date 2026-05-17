import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_FOOTER_CLASS,
  OPS_CARD_HEADER_CLASS,
  OPS_PAGE_CONTENT_STACK_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';

export const SETTINGS_DENSE_MODE_CLASS = 'restaurant-settings-dense';

/** @deprecated Use OPS_PAGE_CONTENT_STACK_CLASS. */
export const SETTINGS_COMPACT_PAGE_CONTENT_CLASS = OPS_PAGE_CONTENT_STACK_CLASS;

/** @deprecated Use OPS_PAGE_CONTENT_STACK_CLASS with SETTINGS_DENSE_MODE_CLASS when needed. */
export const SETTINGS_COMPACT_ROUTE_STACK_CLASS = `${SETTINGS_DENSE_MODE_CLASS} ${OPS_PAGE_CONTENT_STACK_CLASS}`;

/** @deprecated Use OPS_CARD_CLASS. */
export const SETTINGS_COMPACT_CARD_CLASS = OPS_CARD_CLASS;

/** @deprecated Use OPS_CARD_HEADER_CLASS. */
export const SETTINGS_COMPACT_CARD_HEADER_CLASS = OPS_CARD_HEADER_CLASS;

/** @deprecated Use OPS_CARD_CONTENT_CLASS. */
export const SETTINGS_COMPACT_CARD_CONTENT_CLASS = OPS_CARD_CONTENT_CLASS;

/** @deprecated Use OPS_CARD_FOOTER_CLASS. */
export const SETTINGS_COMPACT_CARD_FOOTER_CLASS = OPS_CARD_FOOTER_CLASS;

export const SETTINGS_COMPACT_SECTION_HEADER_CLASS = 'flex flex-col gap-1 pb-2';

export const SETTINGS_COMPACT_ACTION_BAR_CLASS =
  'flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2 sm:flex-row sm:items-center sm:justify-between';

export const SETTINGS_COMPACT_FILTER_BAR_CLASS =
  'grid gap-3 rounded-md border border-border/60 bg-muted/30 p-3';

export const SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS =
  'sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border/60 bg-background/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-[backdrop-filter]:bg-background/90 sm:flex-row sm:items-center sm:justify-between';

export const SETTINGS_COMPACT_STATUS_ROW_CLASS =
  'flex flex-wrap items-center gap-2 text-xs text-muted-foreground';

export const SETTINGS_COMPACT_HELPER_TEXT_CLASS = 'text-xs leading-5 text-muted-foreground';

const SAVE_SCOPE_MESSAGES = {
  'availability-rules': 'Saves booking slot spacing and policy only.',
  'availability-schedule':
    'Saves weekly hours, service windows, date overrides, and booking types in this workspace.',
  discovery: 'Saves this discovery panel only.',
  menu: 'Saves only the selected menu, section, item, or option.',
  tables: 'Saves only this table, zone, or inventory action.',
  team: 'Sends this invitation only.',
} as const;

export type SettingsSaveScope = keyof typeof SAVE_SCOPE_MESSAGES;

export function formatSaveScopeMessage(scope: SettingsSaveScope | string) {
  return SAVE_SCOPE_MESSAGES[scope as SettingsSaveScope] ?? `Saves ${scope} only.`;
}

export const SETTINGS_COMMAND_CENTER_LAYOUT_CLASS = 'flex min-w-0 flex-col gap-4';

/** Docked below settings chrome; does not scroll with page content. */
export const SETTINGS_COMMAND_CENTER_DOCKED_NAV_CLASS =
  'shrink-0 border-b border-border/60 bg-background';

/** Sticky section navbar when rendered inside the scroll region. */
export const SETTINGS_COMMAND_CENTER_RAIL_NAV_CLASS =
  'sticky top-0 z-10 mb-4 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90';

export const SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS =
  'flex min-w-0 items-center gap-0.5 overflow-x-auto px-4 pb-px sm:px-6';

/** @deprecated Card rail wrapper replaced by SETTINGS_COMMAND_CENTER_RAIL_NAV_CLASS. */
export const SETTINGS_COMMAND_CENTER_RAIL_CARD_CLASS =
  'border-border/70 bg-card text-card-foreground shadow-sm';

/** @deprecated Use SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS. */
export const SETTINGS_COMMAND_CENTER_RAIL_GRID_CLASS = SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS;

export const SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-3 text-sm font-medium transition-[color,border-color] duration-200 motion-reduce:transition-none';

export const SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS =
  'border-primary text-foreground shadow-none hover:bg-transparent';

export const SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS =
  'text-muted-foreground hover:border-border/80 hover:bg-transparent hover:text-foreground';
