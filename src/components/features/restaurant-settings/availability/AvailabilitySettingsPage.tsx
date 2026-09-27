'use client';

import { AlertTriangle, Eye, Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsSession } from '@/contexts/ops-session';
import { cn } from '@/lib/utils';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { AVAILABILITY_ANCHORS } from '../availabilityAnchors';
import { AvailabilityOccasionsEditor } from '../AvailabilityOccasionsEditor';
import { updateTurnBandsDraft } from '../availabilityScheduleDraftDomain';
import { extractRequiredOccasionKeys } from '../availabilityScheduleManagerUtils';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '../routes';
import {
  AVAILABILITY_SAVE_GROUP_NAMES,
  MEAL_KEYS,
  WEEK_ORDER,
  copyWeekday,
  createOverrideRow,
  formatOverrideDate,
  isWeekdayEdited,
  patchMeal,
  patchWeekday,
  undoAvailabilityGroup,
  undoWeekday,
  withRequiredBookingTypes,
  type AvailabilityPageDraft,
  type AvailabilitySaveGroup,
  type MealKey,
} from './availabilityPageDraft';
import { availabilityFieldId, countErrors } from './availabilityPageValidation';
import {
  nextDateForWeekday,
  previewAvailabilityDate,
  type AvailabilityPreviewSource,
} from './availabilityPreviewModel';
import {
  SETTINGS_ASIDE_CLASS,
  SETTINGS_ASIDE_GRID_CLASS,
  SETTINGS_CARD_CLASS,
  SETTINGS_CARD_CONTENT_CLASS,
  SETTINGS_CARD_HEADER_CLASS,
  SETTINGS_TOUCH_CONTROL_SCOPE_CLASS,
  SETTINGS_TOUCH_ICON_BUTTON_CLASS,
} from '../shared/compactSettingsClasses';
import { RestaurantSettingsCommandCenter } from '../shared/RestaurantSettingsCommandCenter';
import { SettingsCard } from '../shared/SettingsCard';
import { SettingsLoadErrorAlert } from '../shared/SettingsLoadErrorAlert';
import { SettingsNoRestaurantState } from '../shared/SettingsNoRestaurantState';
import { SettingsRefreshErrorAlert } from '../shared/SettingsRefreshErrorAlert';
import { SettingsReviewChangesDialog } from '../shared/SettingsReviewChangesDialog';
import { AVAILABILITY_SAVE_CONFLICT_MESSAGE, SettingsSaveBar } from '../shared/SettingsSaveBar';
import { formatSettingsSectionList, pluralise } from '../shared/settingsSaveSequence';
import {
  scrollToSettingsSection,
  type RestaurantSettingsCommandRailItem,
} from '../shared/SettingsSectionNav';
import { SettingsSectionStates } from '../shared/settingsSectionStates';
import { SettingsStatusLine } from '../shared/SettingsStatusLine';
import { useSettingsSectionSpy } from '../shared/useSettingsSectionSpy';
import { DAYS_OF_WEEK, type OverrideRow } from '../types';
import {
  buildAvailabilityAttention,
  type AvailabilityAttentionAction,
} from './availabilityAttention';
import { AvailabilityAttentionSection } from './AvailabilityAttentionSection';
import { describeAvailabilitySaveFailure } from './availabilitySaveErrorCopy';
import { BookingPreviewPanel } from './BookingPreviewPanel';
import { BOOKING_RULES_SECTION_ID, BookingRulesSection } from './BookingRulesSection';
import { CopyWeekdayDialog } from './CopyWeekdayDialog';
import { DefaultTableTimeField } from './DefaultTableTimeField';
import {
  SPECIAL_DATES_SECTION_ID,
  SpecialDateDialog,
  SpecialDatesSection,
} from './SpecialDatesSection';
import {
  useAvailabilityPageController,
  type AvailabilityRebaseNotice,
} from './useAvailabilityPageController';
import {
  WEEKLY_HOURS_SECTION_ID,
  WeeklyHoursSection,
  type WeekdayView,
} from './WeeklyHoursSection';

const BOOKING_TYPES_SECTION_ID = AVAILABILITY_ANCHORS.bookingOccasions;
const SECTION_IDS = [
  WEEKLY_HOURS_SECTION_ID,
  SPECIAL_DATES_SECTION_ID,
  BOOKING_RULES_SECTION_ID,
  BOOKING_TYPES_SECTION_ID,
];

/** Deep links and former routes, mapped to the section that replaced them. */
const ANCHOR_SECTIONS: Record<string, string> = {
  [AVAILABILITY_ANCHORS.weeklyHours]: WEEKLY_HOURS_SECTION_ID,
  [AVAILABILITY_ANCHORS.availabilitySchedule]: WEEKLY_HOURS_SECTION_ID,
  [AVAILABILITY_ANCHORS.serviceWindows]: WEEKLY_HOURS_SECTION_ID,
  [AVAILABILITY_ANCHORS.specialDates]: SPECIAL_DATES_SECTION_ID,
  'date-overrides': SPECIAL_DATES_SECTION_ID,
  [AVAILABILITY_ANCHORS.bookingRules]: BOOKING_RULES_SECTION_ID,
  [AVAILABILITY_ANCHORS.bookingOccasions]: BOOKING_TYPES_SECTION_ID,
};

const route = RESTAURANT_SETTINGS_ROUTE_MAP.availability;

function afterRender(callback: () => void) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
}

function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.closest('details')?.setAttribute('open', '');
  element.scrollIntoView({ block: 'center' });
  element.focus({ preventScroll: true });
}

export function AvailabilitySettingsPage({ restaurantId }: { restaurantId: string | null }) {
  const { permissions } = useOpsSession();
  const controller = useAvailabilityPageController(restaurantId, {
    canEditCatalog: permissions.isPlatformAdmin,
  });
  const saveFailureCopy = describeAvailabilitySaveFailure(controller.saveFailure?.reasonCode);
  const [openDays, setOpenDays] = useState<ReadonlySet<number>>(new Set());
  const [copyFrom, setCopyFrom] = useState<number | null>(null);
  const [dateDialog, setDateDialog] = useState<{
    row: OverrideRow;
    isNew: boolean;
    revealErrors: boolean;
  } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const [editRequest, setEditRequest] = useState<{ key: string; nonce: number } | null>(null);
  const activeSection = useSettingsSectionSpy(SECTION_IDS);

  const { draft, saved, updateDraft, errors, visibleErrors } = controller;
  const today = getTodayInTimezone(controller.timezone);

  const hasType = useCallback(
    (meal: MealKey) => Boolean(draft && extractRequiredOccasionKeys(draft.occasions)[meal]),
    [draft],
  );

  const parsedBuffer = (source: AvailabilityPageDraft | null) => {
    const value = Number.parseInt(source?.rules.reservationLastSeatingBufferMinutes ?? '', 10);
    return Number.isFinite(value) ? value : null;
  };
  const lastSeatingBuffer = parsedBuffer(draft) ?? parsedBuffer(saved);

  const previewSources = useMemo(() => {
    if (!draft || !saved) return null;
    const base = {
      savedServicePeriods: controller.savedServicePeriods,
      savedRules: saved.rules,
      timezone: controller.timezone,
    };
    const draftSource: AvailabilityPreviewSource = {
      ...base,
      draft,
      mealsDirty: controller.dirtyGroups.includes('meals'),
    };
    const savedSource: AvailabilityPreviewSource = { ...base, draft: saved, mealsDirty: false };
    return { draftSource, savedSource };
  }, [controller.dirtyGroups, controller.savedServicePeriods, controller.timezone, draft, saved]);

  const attentionItems = useMemo(() => {
    if (!draft || !previewSources) return [];
    const counts = new Map<string, number>();
    for (const dayOfWeek of WEEK_ORDER) {
      const result = previewAvailabilityDate(
        previewSources.draftSource,
        nextDateForWeekday(today, dayOfWeek),
        2,
        { ignoreOverride: true },
      );
      for (const meal of MEAL_KEYS) {
        counts.set(
          `${dayOfWeek}-${meal}`,
          result.offered.filter((slot) => slot.bookingOption === meal).length,
        );
      }
    }
    return buildAvailabilityAttention({
      draft,
      errors,
      offeredCount: (dayOfWeek, meal) => counts.get(`${dayOfWeek}-${meal}`) ?? 0,
      googleDriftCount: controller.googleDrift.fields.length,
      canEditCatalog: controller.canEditCatalog,
    });
  }, [
    controller.canEditCatalog,
    controller.googleDrift.fields.length,
    draft,
    errors,
    previewSources,
    today,
  ]);

  const weekdays: WeekdayView[] = useMemo(() => {
    if (!draft || !saved) return [];
    return draft.weeklyRows.flatMap((row) => {
      const day = draft.dayConfigs.find((item) => item.dayOfWeek === row.dayOfWeek);
      if (!day) return [];
      return [
        {
          row,
          day,
          edited: isWeekdayEdited(saved, draft, row.dayOfWeek),
          issueCount: countErrors(errors, `w${row.dayOfWeek}-`),
          googleDiffers:
            controller.googleDrift.getField(`operatingHours.weekly.${row.dayOfWeek}`) !== null,
        },
      ];
    });
  }, [controller.googleDrift, draft, errors, saved]);

  const openDay = useCallback((dayOfWeek: number) => {
    setOpenDays((current) => (current.has(dayOfWeek) ? current : new Set(current).add(dayOfWeek)));
  }, []);

  const focusIssue = useCallback(
    (key: string) => {
      const weekday = /^w(\d)-(.+)$/.exec(key);
      if (weekday) {
        openDay(Number(weekday[1]));
        afterRender(() => focusField(availabilityFieldId(key)));
        return;
      }
      if (key.startsWith('o-') && draft) {
        const row = draft.overrideRows.find((item) => key.startsWith(`o-${item.id}-`));
        scrollToSettingsSection(SPECIAL_DATES_SECTION_ID);
        if (row) {
          setDateDialog({ row, isNew: false, revealErrors: true });
        }
        return;
      }
      if (key.startsWith('r-')) {
        afterRender(() => focusField(availabilityFieldId(key)));
        return;
      }
      const bandKey = /^t-(.+)-bands$/.exec(key)?.[1];
      if (bandKey) {
        scrollToSettingsSection(BOOKING_TYPES_SECTION_ID);
        setEditRequest({ key: bandKey, nonce: Date.now() });
        return;
      }
      scrollToSettingsSection(BOOKING_TYPES_SECTION_ID);
    },
    [draft, openDay],
  );

  const showFirstIssue = useCallback(() => {
    controller.showAllErrors();
    const first = controller.orderedErrorKeys[0];
    if (first) focusIssue(first);
  }, [controller, focusIssue]);

  const save = useCallback(async () => {
    const result = await controller.save();
    if (result.blockedBy) {
      focusIssue(result.blockedBy);
    } else if (!result.ok) {
      afterRender(() =>
        document
          .querySelector<HTMLButtonElement>('[data-slot="settings-save-bar"] button:last-of-type')
          ?.focus(),
      );
    }
  }, [controller, focusIssue]);

  // Deep links: #anchors (including those former routes redirect to) open their section.
  const handledHashRef = useRef(false);
  useEffect(() => {
    if (!draft || handledHashRef.current) return;
    handledHashRef.current = true;
    const hash = window.location.hash.replace(/^#/, '');
    const section = ANCHOR_SECTIONS[hash];
    if (!section) return;
    if (hash === AVAILABILITY_ANCHORS.serviceWindows) {
      const firstOpen = WEEK_ORDER.find(
        (dayOfWeek) => !draft.weeklyRows.find((row) => row.dayOfWeek === dayOfWeek)?.isClosed,
      );
      if (firstOpen !== undefined) {
        openDay(firstOpen);
        afterRender(() => focusField(availabilityFieldId(`w${firstOpen}-lunch-on`)));
        return;
      }
    }
    afterRender(() => scrollToSettingsSection(section));
  }, [draft, openDay]);

  const handleAttentionAction = useCallback(
    (action: AvailabilityAttentionAction) => {
      switch (action.kind) {
        case 'first-issue':
          showFirstIssue();
          break;
        case 'create-required-types':
          updateDraft((current) => ({
            ...current,
            occasions: withRequiredBookingTypes(current.occasions),
          }));
          toast.success('Lunch and Dinner added. Save changes to create them.');
          break;
        case 'open-day':
          openDay(action.dayOfWeek);
          afterRender(() => {
            document
              .getElementById(`availability-day-${action.dayOfWeek}`)
              ?.scrollIntoView({ block: 'start' });
            focusField(availabilityFieldId(`w${action.dayOfWeek}-open`));
          });
          break;
        case 'edit-type':
          scrollToSettingsSection(BOOKING_TYPES_SECTION_ID);
          setEditRequest({ key: action.key, nonce: Date.now() });
          break;
        case 'google':
        case 'none':
          break;
      }
    },
    [openDay, showFirstIssue, updateDraft],
  );

  if (!restaurantId || controller.loadError || !draft || !saved || !previewSources) {
    return (
      <RestaurantSettingsCommandCenter title={route.title} description={route.description}>
        <SettingsSectionStates
          restaurantId={restaurantId}
          isLoading={!controller.loadError}
          error={controller.loadError}
          noRestaurant={
            <SettingsNoRestaurantState task="manage its availability and booking types" />
          }
          loading={<AvailabilityPageSkeleton />}
          errorState={(loadError) => (
            <SettingsLoadErrorAlert
              title="Couldn’t load availability settings"
              error={loadError}
              onRetry={controller.retryLoad}
            />
          )}
        >
          {() => <AvailabilityPageSkeleton />}
        </SettingsSectionStates>
      </RestaurantSettingsCommandCenter>
    );
  }

  const hoursChanges = controller.changeGroups.find((group) => group.id === 'hours')?.changes ?? [];
  const specialChangeCount = hoursChanges.filter((change) =>
    change.label.startsWith('Special date'),
  ).length;
  const weekdayEditCount = weekdays.filter((view) => view.edited).length;
  const rulesChanges =
    controller.changeGroups.find((group) => group.id === 'rules')?.changes.length ?? 0;
  const typesChanges =
    controller.changeGroups.find((group) => group.id === 'types')?.changes.length ?? 0;
  const badgeFor = (issues: number, edits: number): RestaurantSettingsCommandRailItem['badge'] =>
    issues > 0
      ? { label: String(issues), tone: 'issue', srLabel: pluralise(issues, 'issue') }
      : edits > 0
        ? { label: String(edits), tone: 'edited', srLabel: `${edits} unsaved` }
        : null;
  const railItems: RestaurantSettingsCommandRailItem[] = [
    {
      label: 'Weekly hours',
      targetId: WEEKLY_HOURS_SECTION_ID,
      isActive: activeSection === WEEKLY_HOURS_SECTION_ID,
      badge: badgeFor(
        countErrors(errors, (key) => /^w\d-/.test(key)),
        weekdayEditCount,
      ),
    },
    {
      label: 'Special dates',
      targetId: SPECIAL_DATES_SECTION_ID,
      isActive: activeSection === SPECIAL_DATES_SECTION_ID,
      badge: badgeFor(countErrors(errors, 'o-'), specialChangeCount),
    },
    {
      label: 'Booking rules',
      targetId: BOOKING_RULES_SECTION_ID,
      isActive: activeSection === BOOKING_RULES_SECTION_ID,
      badge: badgeFor(
        countErrors(errors, (key) => key.startsWith('r-') && key !== 'r-duration'),
        rulesChanges,
      ),
    },
    {
      label: 'Booking types',
      targetId: BOOKING_TYPES_SECTION_ID,
      isActive: activeSection === BOOKING_TYPES_SECTION_ID,
      badge: badgeFor(
        countErrors(
          errors,
          (key) => key.startsWith('t-') || key === 'types-required' || key === 'r-duration',
        ),
        typesChanges,
      ),
    },
  ];

  const openDayCount = draft.weeklyRows.filter((row) => !row.isClosed).length;
  const upcomingDates = draft.overrideRows.filter((row) => row.effectiveDate >= today).length;
  const issueCount = Object.keys(errors).length;
  const dirtySectionNames = controller.dirtyGroups.map(
    (group) => AVAILABILITY_SAVE_GROUP_NAMES[group],
  );

  const previewPanel = (bare: boolean) => (
    <BookingPreviewPanel
      draftSource={previewSources.draftSource}
      savedSource={previewSources.savedSource}
      isDirty={controller.isDirty}
      today={today}
      occasions={draft.occasions}
      bare={bare}
    />
  );

  const specialDatePreview = (row: OverrideRow) =>
    row.effectiveDate
      ? previewAvailabilityDate(
          {
            ...previewSources.draftSource,
            draft: {
              ...draft,
              overrideRows: [...draft.overrideRows.filter((item) => item.id !== row.id), row],
            },
          },
          row.effectiveDate,
          2,
        )
      : null;

  return (
    <RestaurantSettingsCommandCenter
      title={route.title}
      description={route.description}
      primaryAction={
        <Button
          ref={previewButtonRef}
          type="button"
          variant="outline"
          className="xl:hidden"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye data-icon="inline-start" aria-hidden />
          Preview guest times
        </Button>
      }
      status={
        <SettingsStatusLine
          changeCount={controller.changeCount}
          issueCount={issueCount}
          progress={controller.saveProgress}
          failure={controller.saveFailure}
          lastSavedAt={controller.lastSavedAt}
        >
          <span className="tabular-nums">
            Open {pluralise(openDayCount, 'day')} a week ·{' '}
            {pluralise(upcomingDates, 'upcoming special date')}
          </span>
        </SettingsStatusLine>
      }
      railTitle="Sections on this page"
      railItems={railItems}
    >
      {controller.refreshError ? (
        <SettingsRefreshErrorAlert error={controller.refreshError} onRetry={controller.retryLoad} />
      ) : null}
      {controller.saveFailure && saveFailureCopy ? (
        <Alert variant="destructive" role="alert" data-testid="availability-save-failure">
          <AlertTriangle aria-hidden />
          <AlertTitle>{controller.saveFailure.failedSection} not saved</AlertTitle>
          <AlertDescription>{saveFailureCopy}</AlertDescription>
        </Alert>
      ) : null}
      {controller.rebaseNotice ? (
        <AvailabilityRebaseAlert
          notice={controller.rebaseNotice}
          onDismiss={controller.dismissRebaseNotice}
        />
      ) : null}
      {draft.customRows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pluralise(draft.customRows.length, 'other service period')} (not a weekday’s lunch or
          dinner) are kept as they are when you save meal times.
        </p>
      ) : null}
      <div className={SETTINGS_ASIDE_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-4">
          <AvailabilityAttentionSection items={attentionItems} onAction={handleAttentionAction} />
          <WeeklyHoursSection
            weekdays={weekdays}
            openDays={openDays}
            errors={visibleErrors}
            hasType={hasType}
            restaurantIntervalMinutes={draft.rules.reservationIntervalMinutes}
            lastSeatingBuffer={lastSeatingBuffer}
            onToggleDay={(dayOfWeek) =>
              setOpenDays((current) => {
                const next = new Set(current);
                if (next.has(dayOfWeek)) next.delete(dayOfWeek);
                else next.add(dayOfWeek);
                return next;
              })
            }
            onWeekdayChange={(dayOfWeek, patch) =>
              updateDraft((current) => patchWeekday(current, dayOfWeek, patch))
            }
            onMealChange={(dayOfWeek, meal, patch) =>
              updateDraft((current) => patchMeal(current, dayOfWeek, meal, patch))
            }
            onTouch={controller.markTouched}
            onCopyDay={setCopyFrom}
            onUndoDay={(dayOfWeek) => {
              updateDraft((current) => undoWeekday(saved, current, dayOfWeek));
              toast.success(`${DAYS_OF_WEEK[dayOfWeek]} is back to its saved settings.`);
            }}
          />
          <SpecialDatesSection
            rows={draft.overrideRows}
            savedRows={saved.overrideRows}
            today={today}
            errors={errors}
            previewFor={specialDatePreview}
            onAdd={() =>
              setDateDialog({ row: createOverrideRow(), isNew: true, revealErrors: false })
            }
            onEdit={(id) => {
              const row = draft.overrideRows.find((item) => item.id === id);
              if (row) setDateDialog({ row, isNew: false, revealErrors: false });
            }}
            onRemove={(id) => {
              const row = draft.overrideRows.find((item) => item.id === id);
              updateDraft((current) => ({
                ...current,
                overrideRows: current.overrideRows.filter((item) => item.id !== id),
              }));
              afterRender(() =>
                document.querySelector<HTMLButtonElement>('[data-special-date-add]')?.focus(),
              );
              if (row) {
                toast.success(
                  `${formatOverrideDate(row.effectiveDate)} removed. Save changes to apply, or undo it in Review changes.`,
                );
              }
            }}
          />
          <BookingRulesSection
            rules={draft.rules}
            weeklyRows={draft.weeklyRows}
            edited={controller.dirtyGroups.includes('rules')}
            errors={visibleErrors}
            onChange={(patch) =>
              updateDraft((current) => ({ ...current, rules: { ...current.rules, ...patch } }))
            }
            onTouch={controller.markTouched}
          />
          <SettingsCard
            id={BOOKING_TYPES_SECTION_ID}
            region
            titleId="availability-types-heading"
            title="Booking types and table times"
            description="What guests book and how long a table is held for each party size."
            contentClassName="p-0 @container sm:p-0"
          >
            <DefaultTableTimeField
              value={draft.rules.reservationDefaultDurationMinutes}
              errors={visibleErrors}
              onChange={(value) =>
                updateDraft((current) => ({
                  ...current,
                  rules: { ...current.rules, reservationDefaultDurationMinutes: value },
                }))
              }
              onTouch={controller.markTouched}
            />
            <AvailabilityOccasionsEditor
              occasions={draft.occasions}
              savedOccasions={saved.occasions}
              savedTurnBands={saved.turnBands}
              turnBands={draft.turnBands}
              turnBandDefaults={controller.turnBandDefaults}
              editRequest={editRequest}
              canEditCatalog={controller.canEditCatalog}
              onChange={(occasions) => updateDraft((current) => ({ ...current, occasions }))}
              onTurnBandsChange={(key, bands) =>
                updateDraft((current) => ({
                  ...current,
                  turnBands: updateTurnBandsDraft(current.turnBands, key, bands),
                }))
              }
            />
          </SettingsCard>
        </div>
        <aside aria-label="Booking preview" className={cn(SETTINGS_ASIDE_CLASS, 'hidden xl:flex')}>
          {previewPanel(false)}
        </aside>
      </div>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-none gap-0 overflow-hidden p-0 sm:max-w-md"
          onCloseAutoFocus={(event) => {
            // The sheet opens from a button outside it, so return focus there explicitly.
            event.preventDefault();
            previewButtonRef.current?.focus();
          }}
        >
          {/* Pinned header; only the preview scrolls, so the title and close stay in reach on a
              landscape phone. */}
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-4 pr-14 [@media(max-height:500px)]:py-2.5">
            <SheetTitle>Preview guest times</SheetTitle>
            <SheetDescription>Configuration preview only</SheetDescription>
          </SheetHeader>
          <div
            data-slot="availability-preview-sheet-body"
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain',
              SETTINGS_TOUCH_CONTROL_SCOPE_CLASS,
            )}
          >
            {previewOpen ? previewPanel(true) : null}
          </div>
        </SheetContent>
      </Sheet>

      <SpecialDateDialog
        open={dateDialog !== null}
        row={dateDialog?.row ?? null}
        isNew={dateDialog?.isNew ?? true}
        revealErrors={dateDialog?.revealErrors ?? false}
        today={today}
        otherDates={draft.overrideRows
          .filter((row) => row.id !== dateDialog?.row.id)
          .map((row) => row.effectiveDate)}
        onOpenChange={(open) => {
          if (!open) setDateDialog(null);
        }}
        previewFor={specialDatePreview}
        onApply={(row) => {
          const isNew = dateDialog?.isNew ?? true;
          updateDraft((current) => ({
            ...current,
            overrideRows: current.overrideRows.some((item) => item.id === row.id)
              ? current.overrideRows.map((item) => (item.id === row.id ? row : item))
              : [...current.overrideRows, row],
          }));
          setDateDialog(null);
          toast.success(
            `${formatOverrideDate(row.effectiveDate)} ${isNew ? 'added' : 'updated'}. Save changes to apply it.`,
          );
        }}
      />

      <CopyWeekdayDialog
        fromDay={copyFrom}
        onOpenChange={(open) => {
          if (!open) setCopyFrom(null);
        }}
        onCopy={(fromDay, toDays) => {
          updateDraft((current) => copyWeekday(current, fromDay, toDays));
          setCopyFrom(null);
          toast.success(
            `Copied to ${toDays.map((day) => DAYS_OF_WEEK[day]).join(', ')}. Save changes to apply.`,
          );
        }}
      />

      <SettingsReviewChangesDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        groups={controller.changeGroups}
        onUndoGroup={(groupId) =>
          updateDraft((current) =>
            undoAvailabilityGroup(saved, current, groupId as AvailabilitySaveGroup),
          )
        }
        onSave={() => void save()}
      />

      <SettingsSaveBar
        changeCount={controller.changeCount}
        sectionNames={dirtySectionNames}
        issueCount={issueCount}
        progress={controller.saveProgress}
        failure={controller.saveFailure}
        onSave={() => void save()}
        onDiscard={controller.discard}
        onShowFirstIssue={showFirstIssue}
        onReview={() => setReviewOpen(true)}
        conflictMessage={AVAILABILITY_SAVE_CONFLICT_MESSAGE}
        onReloadLatest={controller.reloadLatest}
        isReloadingLatest={controller.isReloadingLatest}
      />
    </RestaurantSettingsCommandCenter>
  );
}

/**
 * Newer saved settings were loaded under unsaved edits (another manager, a Google import, or after
 * a refused save). Staff edits are kept; sections both sides changed are named, because saving
 * replaces the other change there.
 */
function AvailabilityRebaseAlert({
  notice,
  onDismiss,
}: {
  notice: AvailabilityRebaseNotice;
  onDismiss: () => void;
}) {
  const names = (groups: readonly AvailabilitySaveGroup[]) =>
    formatSettingsSectionList(groups.map((group) => AVAILABILITY_SAVE_GROUP_NAMES[group]));
  const hasConflicts = notice.conflicts.length > 0;
  return (
    <Alert
      variant={hasConflicts ? 'warning' : 'default'}
      role="status"
      // Room for the 32px dismiss button, 44px on touch (RR3/RR4).
      className="pr-12 [@media(pointer:coarse)]:pr-14"
      data-testid="availability-rebase-notice"
    >
      {hasConflicts ? <AlertTriangle aria-hidden /> : <Info aria-hidden />}
      <AlertTitle>Someone else saved changes while you were editing</AlertTitle>
      <AlertDescription>
        {notice.changed.length > 0
          ? `Loaded the latest ${names(notice.changed)}. `
          : 'Loaded the latest saved settings. '}
        {hasConflicts
          ? `You also changed ${names(notice.conflicts)}: your edits are kept and will replace theirs when you save. Review changes before saving.`
          : 'Your edits are kept. Review them, then save again.'}
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn('absolute right-2 top-2 min-h-0 min-w-0', SETTINGS_TOUCH_ICON_BUTTON_CLASS)}
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X aria-hidden />
      </Button>
    </Alert>
  );
}

function AvailabilityPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <span className="sr-only">Loading availability settings</span>
      <Card variant="compact" className={SETTINGS_CARD_CLASS}>
        <div className={cn(SETTINGS_CARD_HEADER_CLASS, 'flex flex-col gap-2')}>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <div className={cn(SETTINGS_CARD_CONTENT_CLASS, 'flex flex-col gap-3')}>
          {WEEK_ORDER.map((day) => (
            <Skeleton key={day} className="h-11 w-full" />
          ))}
        </div>
      </Card>
      <Card variant="compact" className={SETTINGS_CARD_CLASS}>
        <div className={cn(SETTINGS_CARD_HEADER_CLASS, 'flex flex-col gap-2')}>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </div>
        <div className={SETTINGS_CARD_CONTENT_CLASS}>
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    </div>
  );
}
