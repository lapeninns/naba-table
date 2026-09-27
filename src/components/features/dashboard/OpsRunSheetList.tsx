import { cn } from '@/lib/utils';

import styles from './OpsBookingsPrintView.module.css';
import {
  RunSheetDietTags,
  RunSheetGuestCell,
  RunSheetStatusTags,
  RunSheetUnassignedTag,
  describeGroup,
  hasDietFlags,
} from './OpsRunSheetParts';

import type { OpsRunSheet, RunSheetPreferences } from './opsBookingsPrintViewDomain';

/**
 * Phone-sized reading of the same sheet. Screen only; printing always uses the A4 pages.
 * Render it inside the `listView` wrapper, which maps the sheet's tag colours to app tokens.
 */
export function OpsRunSheetList({
  sheet,
  preferences,
}: {
  sheet: OpsRunSheet;
  preferences: RunSheetPreferences;
}) {
  const { columns } = preferences;
  const stats: [string, number][] = [
    ['Bookings', sheet.stats.bookings],
    ['Covers', sheet.stats.covers],
    ['Allergy flags', sheet.stats.allergyFlags],
    ['Lunch covers', sheet.stats.lunchCovers],
    ['Dinner covers', sheet.stats.dinnerCovers],
    ['Unassigned', sheet.stats.unassigned],
  ];

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-3 rounded-lg border border-border bg-background px-3.5">
        {stats.map(([label, value], index) => (
          <div key={label} className={cn('py-2.5', index >= 3 && 'border-t border-border')}>
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {sheet.groups.map((group) => (
        <section key={group.key} aria-label={group.label ?? 'Bookings'}>
          {group.label ? (
            <h3 className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-foreground pb-2 pt-1 text-sm font-bold">
              {group.label}
              <span className="text-[13px] font-medium text-muted-foreground">
                {describeGroup(group)}
              </span>
            </h3>
          ) : null}
          <ul className="grid gap-2.5 min-[540px]:grid-cols-2">
            {group.rows.map((row) => {
              const showDiet = columns.diet && hasDietFlags(row);
              return (
                <li
                  key={row.id}
                  className={cn(
                    'grid gap-2 rounded-lg border border-border bg-background px-3.5 py-3',
                    row.category === 'finished' && 'bg-muted',
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-base font-bold tabular-nums">
                      {row.startLabel}
                      {row.endLabel ? (
                        <span className="text-[13px] font-medium text-muted-foreground">
                          {' '}
                          – {row.endLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto flex items-baseline gap-3 text-[13px]">
                      <span>
                        <b className="font-mono">{row.partySize}</b>{' '}
                        {row.partySize === 1 ? 'guest' : 'guests'}
                      </span>
                      {row.tableNumbers.length > 0 ? (
                        <span>
                          Table <b className="font-mono">{row.tableNumbers.join(' + ')}</b>
                        </span>
                      ) : row.isUnassigned ? (
                        <RunSheetUnassignedTag />
                      ) : null}
                    </span>
                  </div>
                  <div className="text-[15px]">
                    <RunSheetGuestCell row={row} columns={columns} />
                  </div>
                  {columns.status || showDiet ? (
                    <div className={styles.tags}>
                      {columns.status ? <RunSheetStatusTags row={row} /> : null}
                      {showDiet ? <RunSheetDietTags row={row} /> : null}
                    </div>
                  ) : null}
                  {columns.notes && row.notes ? (
                    <p className="text-[13px]">
                      <span className="font-medium text-muted-foreground">Notes: </span>
                      {row.notes}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
