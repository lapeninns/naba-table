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
  'sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border/60 bg-background/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-[backdrop-filter]:bg-background/90 sm:flex-row sm:items-center sm:justify-between sm:px-4';

/** Canonical labels for settings save controls. One vocabulary across every settings route. */
export const SETTINGS_SAVE_COPY = {
  dirty: 'Unsaved changes',
  discard: 'Discard changes',
  saving: 'Saving…',
  discardConfirm: 'Discard your unsaved changes? This cannot be undone.',
  /** The exact toast after a staff member discards a draft. */
  discarded: 'Changes discarded.',
} as const;

export const SETTINGS_COMPACT_STATUS_ROW_CLASS =
  'flex flex-wrap items-center gap-2 text-xs text-muted-foreground';

export const SETTINGS_COMPACT_HELPER_TEXT_CLASS = 'text-xs leading-5 text-muted-foreground';

const SAVE_SCOPE_MESSAGES = {
  'availability-rules': 'Saves booking slot spacing and policy only.',
  'availability-schedule':
    'Saves weekly hours, service windows, date overrides, and booking types in this workspace.',
  'weekly-hours': 'Saves weekly opening hours only.',
  'service-windows': 'Saves lunch, dinner, and other service windows only.',
  'date-overrides': 'Saves date-specific overrides only.',
  'booking-occasions': 'Saves booking types and dining-duration bands only.',
  discovery: 'Saves this discovery panel only.',
  menu: 'Saves only the selected menu, section, item, or option.',
  tables: 'Saves only this table, zone, or inventory action.',
  team: 'Sends this invitation only.',
  'profile-brand': 'Saves local brand details only. Sync with Google remains optional.',
  'profile-contact': 'Saves local phone and address only. Sync with Google remains optional.',
  'profile-advanced': 'Saves timezone and external details only.',
  'profile-notifications': 'Saves manager alert preferences only.',
} as const;

export type SettingsSaveScope = keyof typeof SAVE_SCOPE_MESSAGES;

/** @deprecated Per-section save scopes are replaced by the page-level `SettingsSaveBar`. */
export function formatSaveScopeMessage(scope: SettingsSaveScope | string) {
  return SAVE_SCOPE_MESSAGES[scope as SettingsSaveScope] ?? `Saves ${scope} only.`;
}

export const SETTINGS_COMMAND_CENTER_LAYOUT_CLASS = 'flex min-w-0 flex-col gap-4';

/**
 * Entrance fade for settings content (tw-animate-css `enter` keyframes). Pure CSS, so there is no
 * inline `opacity: 0` to strand content before hydration; the keyframes only define `from` with
 * fill mode `none`, so the animation always ends on the element's own visible styles; and every
 * utility is `motion-safe:` gated, so `prefers-reduced-motion` users get no animation at all.
 */
export const SETTINGS_ENTER_FADE_CLASS =
  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-safe:ease-out';

/** Docked below settings chrome; does not scroll with page content. */
export const SETTINGS_COMMAND_CENTER_DOCKED_NAV_CLASS =
  'shrink-0 border-b border-border/60 bg-background';

/** Sticky section navbar when rendered inside the scroll region. */
export const SETTINGS_COMMAND_CENTER_RAIL_NAV_CLASS =
  'sticky top-0 z-10 mb-4 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90';

/**
 * Shares the shell gutter token so tabs align with the chrome title and page content. On short
 * landscape phones (height ≤ 500px) the vertical padding goes, so the docked chrome, rail and
 * save bar leave well over half the screen for content (RR7).
 */
export const SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS =
  'flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain px-[var(--ops-shell-gutter)] py-1 [scrollbar-width:thin] [@media(max-height:500px)]:py-0';

/** @deprecated Card rail wrapper replaced by SETTINGS_COMMAND_CENTER_RAIL_NAV_CLASS. */
export const SETTINGS_COMMAND_CENTER_RAIL_CARD_CLASS =
  'border-border/70 bg-card text-card-foreground shadow-sm';

/** @deprecated Use SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS. */
export const SETTINGS_COMMAND_CENTER_RAIL_GRID_CLASS = SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS;

/** 44px tall on every viewport: the rail is the primary in-page navigation on phones. */
export const SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS =
  'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-3 text-sm transition-[color,border-color,font-weight] duration-200 motion-reduce:transition-none';

/** Weight plus underline, so the current section is not indicated by colour alone. */
export const SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS =
  'border-primary font-semibold text-foreground shadow-none hover:bg-transparent';

export const SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS =
  'font-medium text-muted-foreground hover:border-border hover:bg-transparent hover:text-foreground';

/**
 * Edge cue with a chevron, shown only while a sideways strip (section rail, underline tabs) hides
 * items on that side (RR2). A solid background strip with a hairline divider rather than a
 * gradient (custom gradients need a named Luma recipe). Stops 1px short of the bottom so an
 * underline border stays visible.
 */
export const SETTINGS_OVERFLOW_FADE_CLASS =
  'pointer-events-none absolute top-0 bottom-px z-10 flex w-7 items-center bg-background text-muted-foreground';

export const SETTINGS_OVERFLOW_FADE_START_CLASS =
  'left-0 justify-start border-e border-border/60 ps-1';

export const SETTINGS_OVERFLOW_FADE_END_CLASS =
  'right-0 justify-end border-s border-border/60 pe-1';

/** @deprecated Use SETTINGS_OVERFLOW_FADE_CLASS (rendered by `SettingsOverflowFades`). */
export const SETTINGS_COMMAND_CENTER_RAIL_FADE_CLASS = SETTINGS_OVERFLOW_FADE_CLASS;

/**
 * Section card anatomy (ops-settings-contract §2): white header with a hairline divider,
 * text-base title, text-sm description and content padded `px-4 py-4 sm:px-5`.
 * Used by `SettingsCard`; titled panels inside workspaces reuse the title/description classes.
 */
export const SETTINGS_CARD_CLASS = 'w-full min-w-0 overflow-hidden border-border/70 shadow-none';

export const SETTINGS_CARD_HEADER_CLASS = 'border-b border-border/60 px-4 py-4 sm:px-5';

export const SETTINGS_CARD_TITLE_CLASS = 'text-base font-semibold leading-6 text-foreground';

export const SETTINGS_CARD_DESCRIPTION_CLASS =
  'max-w-prose text-sm leading-5 text-muted-foreground';

export const SETTINGS_CARD_CONTENT_CLASS = 'px-4 py-4 sm:px-5';

/** Two-column settings page: main column plus a 20rem aside from `xl`. DOM order is main, then aside. */
export const SETTINGS_ASIDE_GRID_CLASS =
  'grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]';

/** The aside column of `SETTINGS_ASIDE_GRID_CLASS`; sticky from `xl`. */
export const SETTINGS_ASIDE_CLASS = 'flex min-w-0 flex-col gap-4 xl:sticky xl:top-4';

/**
 * In-content Radix `TabsList` styled as the docked underline rail. Wrap it in
 * `SettingsOverflowFrame` so tabs that do not fit get an edge fade and the active tab stays in view.
 */
export const SETTINGS_TABS_LIST_CLASS =
  'flex h-auto w-full min-w-0 items-center justify-start gap-2 overflow-x-auto rounded-none border-b border-border/60 bg-transparent p-0 text-muted-foreground [scrollbar-width:thin]';

/** In-content Radix `TabsTrigger` matching the rail items; active state keyed on `data-state`. */
export const SETTINGS_TABS_TRIGGER_CLASS = `${SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS} ${SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS} min-h-0 min-w-0 bg-transparent py-0 shadow-none ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:hover:border-primary`;

/**
 * Muted track of `SettingsSegmentedControl`. One row while the segments fit; when they don't, the
 * segments wrap onto another line inside the track. Nothing is ever clipped or scrolled away (RR2).
 */
export const SETTINGS_SEGMENT_GROUP_CLASS =
  'inline-flex min-w-0 max-w-full flex-wrap items-center justify-start gap-0.5 rounded-lg bg-muted p-0.5';

/**
 * One segment. Selected is a raised white chip; never a primary fill. At least 44×44 on coarse
 * pointers (RR3); fine pointers keep the compact 32px height.
 */
export const SETTINGS_SEGMENT_ITEM_CLASS =
  'h-8 min-h-0 min-w-0 shrink-0 gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11';

/** Smaller segment for dense toolbars; still 44px on coarse pointers. */
export const SETTINGS_SEGMENT_ITEM_SM_CLASS = 'h-7 px-2 text-xs';

/** The one inline text-link style inside settings copy. */
export const SETTINGS_INLINE_LINK_CLASS =
  'font-medium text-primary underline-offset-4 hover:underline';

/** Page status row under the purpose line; shared by `SettingsStatusLine` and `SettingsStatusFacts`. */
export const SETTINGS_STATUS_ROW_CLASS =
  'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground';

/**
 * Settings form control on a coarse pointer (RR3): an `Input`, `SelectTrigger` or `Textarea` grows
 * to at least 44px tall; fine pointers keep the compact 36px control. Pages rarely need it, because
 * `SETTINGS_TOUCH_CONTROL_SCOPE_CLASS` on the settings content and dialogs already covers them.
 */
export const SETTINGS_TOUCH_CONTROL_CLASS = '[@media(pointer:coarse)]:min-h-11';

/** Icon-only button on a coarse pointer: 44×44 instead of the compact 36px (RR3). */
export const SETTINGS_TOUCH_ICON_BUTTON_CLASS =
  '[@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

/**
 * Scoped descendant rule for a settings container: on a coarse pointer every text input and select
 * trigger inside it is at least 44px tall (RR3). Applied by the settings shell's content area and
 * by `SettingsDialog`, so settings pages inherit it without touching `components/ui`. Visually
 * hidden inputs (`sr-only`), file, hidden, checkbox and radio inputs are left alone.
 */
export const SETTINGS_TOUCH_CONTROL_SCOPE_CLASS =
  '[@media(pointer:coarse)]:[&_[data-slot=input]:not(.sr-only):not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio])]:min-h-11 [@media(pointer:coarse)]:[&_button[role=combobox]]:min-h-11';
