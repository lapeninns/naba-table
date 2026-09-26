'use client';

import { AlertTriangle, Eye, Info, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { AVAILABILITY_ANCHORS } from '../availabilityAnchors';
import { AvailabilityOccasionsEditor } from '../AvailabilityOccasionsEditor';
import { updateTurnBandsDraft } from '../availabilityScheduleDraftDomain';
import { extractRequiredOccasionKeys } from '../availabilityScheduleManagerUtils';
import { getRestaurantSettingsAvailabilityAlias, RESTAURANT_SETTINGS_ROUTE_MAP } from '../routes';
import { RestaurantSettingsCommandCenter } from '../shared/RestaurantSettingsCommandCenter';
import { SettingsRefreshErrorAlert } from '../shared/SettingsRefreshErrorAlert';
import { SettingsReviewChangesDialog } from '../shared/SettingsReviewChangesDialog';
import { SettingsSaveBar } from '../shared/SettingsSaveBar';
import { getSettingsSaveReasonCode, pluralise } from '../shared/settingsSaveSequence';
import {
  scrollToSettingsSection,
  type RestaurantSettingsCommandRailItem,
} from '../shared/SettingsSectionNav';
import { SettingsStatusLine } from '../shared/SettingsStatusLine';
import { useSettingsSectionSpy } from '../shared/useSettingsSectionSpy';
import { DAYS_OF_WEEK, type OverrideRow } from '../types';
import {
  buildAvailabilityAttention,
  type AvailabilityAttentionAction,
} from './availabilityAttention';
import { AvailabilityAttentionSection } from './AvailabilityAttentionSection';
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
import { BookingPreviewPanel } from './BookingPreviewPanel';
import { BOOKING_RULES_SECTION_ID, BookingRulesSection } from './BookingRulesSection';
import { CopyWeekdayDialog } from './CopyWeekdayDialog';
import { DefaultTableTimeField } from './DefaultTableTimeField';
import {
  SPECIAL_DATES_SECTION_ID,
  SpecialDateDialog,
  SpecialDatesSection,
} from './SpecialDatesSection';
import { useAvailabilityPageController } from './useAvailabilityPageController';
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
  const controller = useAvailabilityPageController(restaurantId);
  const pathname = usePathname();
  const alias = getRestaurantSettingsAvailabilityAlias(pathname);
  const [aliasDismissed, setAliasDismissed] = useState(false);
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
    });
  }, [controller.googleDrift.fields.length, draft, errors, previewSources, today]);

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

  // Deep links: former routes and #anchors open the section that replaced them.
  const handledHashRef = useRef(false);
  useEffect(() => {
    if (!draft || handledHashRef.current) return;
    handledHashRef.current = true;
    const hash = alias?.availabilityAnchor ?? window.location.hash.replace(/^#/, '');
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
  }, [alias?.availabilityAnchor, draft, openDay]);

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
          break;
      }
    },
    [openDay, showFirstIssue, updateDraft],
  );

  if (!restaurantId) {
    return (
      <OpsEmptyState
        title="No restaurant selected"
        description="Choose a restaurant to manage its availability and booking types."
      />
    );
  }

  if (controller.loadError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertTitle>Availability settings couldn’t load</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>
            Your saved settings are unchanged. Reason code{' '}
            <span className="font-mono">{getSettingsSaveReasonCode(controller.loadError)}</span>
          </span>
          <Button type="button" variant="outline" size="sm" onClick={controller.retryLoad}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!draft || !saved || !previewSources) {
    return <AvailabilityPageSkeleton />;
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
      {alias && !aliasDismissed ? (
        <Alert variant="info" role="status" className="pr-12">
          <Info aria-hidden />
          <AlertTitle>{alias.title} is part of Availability.</AlertTitle>
          <AlertDescription>
            You opened <span className="font-mono">/app/settings/restaurant/{alias.slug}</span>, so
            we’ve taken you to that section.
          </AlertDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 top-2"
            aria-label="Dismiss"
            onClick={() => setAliasDismissed(true)}
          >
            <X aria-hidden />
          </Button>
        </Alert>
      ) : null}
      {draft.customRows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pluralise(draft.customRows.length, 'other service period')} (not a weekday’s lunch or
          dinner) are kept as they are when you save meal times.
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21.25rem] xl:items-start">
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
          <Card
            id={BOOKING_TYPES_SECTION_ID}
            aria-labelledby="availability-types-heading"
            className="scroll-mt-4 overflow-hidden border-border/70 pb-0 shadow-none"
          >
            <CardHeader className="flex flex-col gap-1 px-4 pt-4 sm:px-5">
              <CardTitle
                id="availability-types-heading"
                role="heading"
                aria-level={2}
                className="text-base leading-6"
              >
                Booking types and table times
              </CardTitle>
              <CardDescription>
                What guests book and how long a table is held for each party size.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
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
                onChange={(occasions) => updateDraft((current) => ({ ...current, occasions }))}
                onTurnBandsChange={(key, bands) =>
                  updateDraft((current) => ({
                    ...current,
                    turnBands: updateTurnBandsDraft(current.turnBands, key, bands),
                  }))
                }
              />
            </CardContent>
          </Card>
        </div>
        <aside aria-label="Booking preview" className="hidden xl:sticky xl:top-0 xl:block">
          {previewPanel(false)}
        </aside>
      </div>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-none gap-0 overflow-y-auto p-0 sm:max-w-md"
          onCloseAutoFocus={(event) => {
            // The sheet opens from a button outside it, so return focus there explicitly.
            event.preventDefault();
            previewButtonRef.current?.focus();
          }}
        >
          <SheetHeader className="border-b border-border/60 px-4 py-4 pr-12">
            <SheetTitle>Preview guest times</SheetTitle>
            <SheetDescription>Configuration preview only</SheetDescription>
          </SheetHeader>
          {previewOpen ? previewPanel(true) : null}
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
      />
    </RestaurantSettingsCommandCenter>
  );
}

function AvailabilityPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <span className="sr-only">Loading availability settings</span>
      <Skeleton className="h-5 w-full max-w-xl" />
      <Card className="border-border/70 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4">
          <Skeleton className="h-5 w-48" />
          {WEEK_ORDER.map((day) => (
            <Skeleton key={day} className="h-11 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card className="border-border/70 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
