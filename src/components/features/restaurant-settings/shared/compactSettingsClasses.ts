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
  'sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border/60 bg-background/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:flex-row sm:items-center sm:justify-between';

export const SETTINGS_COMPACT_STATUS_ROW_CLASS =
  'flex flex-wrap items-center gap-2 text-xs text-muted-foreground';

export const SETTINGS_COMPACT_HELPER_TEXT_CLASS = 'text-xs leading-5 text-muted-foreground';
