import {
  AVAILABILITY_SECTIONS,
  type AvailabilityCommandPayload,
  type AvailabilitySectionRevisions,
  type AvailabilitySnapshot,
} from '@/services/ops/availability';

import {
  buildOperatingHoursPayload,
  extractRequiredOccasionKeys,
} from '../availabilityScheduleManagerUtils';
import {
  buildAvailabilityOccasionSavePlan,
  buildAvailabilityServicePayload,
  buildAvailabilityTurnBandsPayload,
} from '../availabilitySchedulePayloadDomain';
import {
  getDirtyAvailabilityGroups,
  type AvailabilityPageDraft,
  type AvailabilitySaveGroup,
} from './availabilityPageDraft';

import type { ServicePeriodRow } from '@/services/ops/restaurants';

/**
 * How one "Save" on the Availability page reaches the server:
 * - `catalog`: booking-type (occasion) writes. Booking types are a global catalog that only
 *   Nabatable platform admins may change, so they are never part of the restaurant transaction,
 *   and they are planned only when `canEditCatalog` is true. Creates and updates run before the
 *   command (meal times and table times may refer to a new type); deletes run after it (the
 *   server refuses to delete a type that meal times still use, and the command may be what
 *   removes those meal times).
 * - `command`: everything the restaurant owns (hours and special dates, meal times, table times,
 *   the default table time and the booking rules) in ONE request and one database transaction.
 *   Only the parts that changed are sent, so an unrelated save never rewrites (and re-syncs to
 *   Google) hours or meal times.
 */
export type AvailabilitySavePlan = {
  /** Dirty groups this save covers, in display order. */
  groups: AvailabilitySaveGroup[];
  catalog: { upserts: boolean; deletes: boolean };
  command: AvailabilityCommandPayload | null;
  /** Groups the command covers (the catalog part of `types` excepted). */
  commandGroups: AvailabilitySaveGroup[];
};

const toInt = (value: string) => Number.parseInt(value, 10);

export function planAvailabilitySave({
  saved,
  draft,
  canEditCatalog,
  savedServicePeriods,
  expectedRevision,
  expectedRevisions,
}: {
  readonly saved: AvailabilityPageDraft;
  readonly draft: AvailabilityPageDraft;
  /** Platform admin: may create, edit and delete booking types. */
  readonly canEditCatalog: boolean;
  /** Meal times as stored, used to keep table times of types that still have meal times. */
  readonly savedServicePeriods: readonly ServicePeriodRow[];
  /** Whole-page revision; sent only when per-section revisions are unknown. */
  readonly expectedRevision?: string | null;
  /**
   * Per-section revisions of the settings `saved` was built from. Only the sections the command
   * writes are sent, so another manager's save of a different section is not a conflict.
   */
  readonly expectedRevisions?: AvailabilitySectionRevisions | null;
}): AvailabilitySavePlan {
  const groups = getDirtyAvailabilityGroups(saved, draft);
  const dirty = new Set(groups);
  const command: AvailabilityCommandPayload = {};
  const commandGroups: AvailabilitySaveGroup[] = [];

  if (dirty.has('hours')) {
    command.hours = buildOperatingHoursPayload(draft.weeklyRows, draft.overrideRows);
    commandGroups.push('hours');
  }

  if (dirty.has('meals')) {
    const occasionKeys = extractRequiredOccasionKeys(draft.occasions);
    command.servicePeriods = buildAvailabilityServicePayload({
      customRows: draft.customRows,
      dayConfigs: draft.dayConfigs,
      occasionKeys: {
        lunch: occasionKeys.lunch ?? 'lunch',
        dinner: occasionKeys.dinner ?? 'dinner',
      },
    });
    commandGroups.push('meals');
  }

  let catalog = { upserts: false, deletes: false };
  if (dirty.has('types')) {
    if (canEditCatalog) {
      const occasionPlan = buildAvailabilityOccasionSavePlan({
        draftOccasions: draft.occasions,
        originalOccasions: saved.occasions,
      });
      catalog = {
        upserts: occasionPlan.createInputs.length > 0 || occasionPlan.updateInputs.length > 0,
        deletes: occasionPlan.deleteKeys.length > 0,
      };
    }
    let typesInCommand = false;
    if (JSON.stringify(draft.turnBands) !== JSON.stringify(saved.turnBands)) {
      command.turnBands = buildAvailabilityTurnBandsPayload({
        occasionDrafts: canEditCatalog ? draft.occasions : saved.occasions,
        servicePeriods: command.servicePeriods ?? savedServicePeriods,
        turnBandsDraft: draft.turnBands,
      });
      typesInCommand = true;
    }
    if (
      draft.rules.reservationDefaultDurationMinutes !==
      saved.rules.reservationDefaultDurationMinutes
    ) {
      command.rules = {
        ...command.rules,
        reservationDefaultDurationMinutes: toInt(draft.rules.reservationDefaultDurationMinutes),
      };
      typesInCommand = true;
    }
    if (typesInCommand) {
      commandGroups.push('types');
    }
  }

  if (dirty.has('rules')) {
    const trimmedPolicy = draft.rules.bookingPolicy.trim();
    command.rules = {
      ...command.rules,
      bookingPolicy: trimmedPolicy.length > 0 ? trimmedPolicy : null,
      reservationIntervalMinutes: toInt(draft.rules.reservationIntervalMinutes),
      reservationLastSeatingBufferMinutes: toInt(draft.rules.reservationLastSeatingBufferMinutes),
      reservationLifecycleGraceMinutes: toInt(draft.rules.reservationLifecycleGraceMinutes),
    };
    commandGroups.push('rules');
  }

  const hasCommand = commandGroups.length > 0;
  if (hasCommand && expectedRevisions) {
    command.expectedRevisions = Object.fromEntries(
      AVAILABILITY_SECTIONS.filter((section) => command[section] !== undefined).map((section) => [
        section,
        expectedRevisions[section],
      ]),
    );
  } else if (hasCommand && expectedRevision) {
    command.expectedRevision = expectedRevision;
  }

  return {
    groups,
    catalog,
    command: hasCommand ? command : null,
    commandGroups,
  };
}

/**
 * The revisions the page's `saved` settings were built from: per section when the server sends
 * them, otherwise only the whole-page revision.
 */
export type AvailabilityBaseRevision = {
  readonly revision: string;
  readonly revisions: AvailabilitySectionRevisions | null;
};

export function availabilityBaseRevision(snapshot: AvailabilitySnapshot): AvailabilityBaseRevision {
  return { revision: snapshot.revision, revisions: snapshot.revisions ?? null };
}

/** True when both describe the same stored settings (per section when both have sections). */
export function sameAvailabilityRevision(
  a: AvailabilityBaseRevision | null,
  b: AvailabilityBaseRevision | null,
): boolean {
  if (!a || !b) return a === b;
  if (a.revisions && b.revisions) {
    const left = a.revisions;
    const right = b.revisions;
    return AVAILABILITY_SECTIONS.every((section) => left[section] === right[section]);
  }
  return a.revision === b.revision;
}

/**
 * The base after a successful save. Only the sections the command wrote advance to the stored
 * revisions: `saved` merges only those sections, so a section another manager changed meanwhile
 * keeps its old revision, is seen as newer on the next snapshot, and is rebased onto.
 */
export function advanceAvailabilityRevision(
  current: AvailabilityBaseRevision | null,
  command: AvailabilityCommandPayload,
  result: AvailabilitySnapshot,
): AvailabilityBaseRevision {
  const stored = availabilityBaseRevision(result);
  if (!current?.revisions || !stored.revisions) {
    return stored;
  }
  const storedRevisions = stored.revisions;
  const revisions: AvailabilitySectionRevisions = { ...current.revisions };
  for (const section of AVAILABILITY_SECTIONS) {
    if (command[section] !== undefined) revisions[section] = storedRevisions[section];
  }
  return { revision: stored.revision, revisions };
}
